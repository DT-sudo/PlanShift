"""Two-factor authentication: turning it on and off, checking codes, recovery codes."""

from __future__ import annotations

import enum
import secrets
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from apps.accounts.models import User

from . import totp
from .models import RecoveryCode, TOTPDevice

MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION = timedelta(minutes=5)
LOCKED_MESSAGE = "Too many incorrect codes. Wait 5 minutes, then try again."

RECOVERY_CODE_COUNT = 10
RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


class Result(enum.Enum):
    CODE = "code"
    RECOVERY_CODE = "recovery_code"
    INVALID = "invalid"
    LOCKED = "locked"

    @property
    def ok(self) -> bool:
        return self in (Result.CODE, Result.RECOVERY_CODE)


def is_enabled(user: User) -> bool:
    return hasattr(user, "totp_device")


def normalize(code: str) -> str:
    """Codes are accepted with spaces or dashes ("123 456", "abcde-fghjk") and in any case."""
    return "".join((code or "").split()).replace("-", "").lower()


def _hash(code: str) -> str:
    return salted_hmac("apps.twofactor.RecoveryCode", normalize(code), algorithm="sha256").hexdigest()


def _replace_recovery_codes(device: TOTPDevice) -> list[str]:
    codes = []
    while len(codes) < RECOVERY_CODE_COUNT:
        raw = "".join(secrets.choice(RECOVERY_ALPHABET) for _index in range(10))
        code = f"{raw[:5]}-{raw[5:]}"
        if code not in codes:
            codes.append(code)
    device.recovery_codes.all().delete()
    RecoveryCode.objects.bulk_create(RecoveryCode(device=device, code_hash=_hash(code)) for code in codes)
    return codes


def recovery_codes_left(user: User) -> int:
    return RecoveryCode.objects.filter(device__user=user, used_at=None).count()


@transaction.atomic
def enable(user: User, secret: str, step: int) -> list[str]:
    """Save the confirmed secret and return fresh recovery codes, the only time they exist in clear."""
    device = TOTPDevice.objects.create(user=user, secret=secret, last_used_step=step)
    codes = _replace_recovery_codes(device)
    return codes


@transaction.atomic
def verify(user: User, code: str) -> Result:
    """Check an authenticator code or a recovery code, counting failures towards the lock.

    The row is locked for the check, so two requests racing with the same code
    can't both pass and failures can't be lost between them.
    """
    device = TOTPDevice.objects.select_for_update().filter(user=user).first()
    if device is None:
        return Result.INVALID

    now = timezone.now()
    if device.locked_until:
        if device.locked_until > now:
            return Result.LOCKED
        device.locked_until, device.failed_attempts = None, 0

    code = normalize(code)
    result = Result.INVALID
    if code.isdigit() and len(code) == totp.DIGITS:
        step = totp.matching_step(device.secret, code, after=device.last_used_step)
        if step is not None:
            device.last_used_step = step
            result = Result.CODE
    elif code and device.recovery_codes.filter(code_hash=_hash(code), used_at=None).update(used_at=now):
        result = Result.RECOVERY_CODE

    if result.ok:
        device.failed_attempts = 0
    else:
        device.failed_attempts += 1
        if device.failed_attempts >= MAX_FAILED_ATTEMPTS:
            device.locked_until = now + LOCK_DURATION
            result = Result.LOCKED
    device.save(update_fields=["last_used_step", "failed_attempts", "locked_until"])
    return result
