from __future__ import annotations

from django.conf import settings
from django.db import models


class TOTPDevice(models.Model):
    """A confirmed authenticator app. Its existence is what "2FA is on" means for a user."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="totp_device")
    secret = models.CharField(max_length=64)
    confirmed_at = models.DateTimeField(auto_now_add=True)
    last_used_step = models.BigIntegerField(default=-1)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"TOTP for {self.user}"


class RecoveryCode(models.Model):
    """A one-time code for when the phone is lost. Only a keyed hash is stored."""

    device = models.ForeignKey(TOTPDevice, on_delete=models.CASCADE, related_name="recovery_codes")
    code_hash = models.CharField(max_length=64)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["device", "code_hash"], name="unique_recovery_code_per_device")]
