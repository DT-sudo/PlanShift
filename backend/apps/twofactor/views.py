"""The sign-in code step, and the Security card of Account settings (the "Minor: 2FA" module)."""

from __future__ import annotations
from typing import Any

from django.contrib import messages
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.urls import reverse
from apps.shell import field_errors, flash_redirect

from . import services, totp
from .forms import ConfirmSetupForm, ReauthenticateForm
SETUP_SECRET = "twofactor_setup_secret"
NEW_RECOVERY_CODES = "twofactor_recovery_codes"


SETTINGS_SECTIONS = {"2fa_start", "2fa_cancel", "2fa_confirm", "2fa_disable", "2fa_recovery"}


def settings_action(request: HttpRequest, section: str) -> tuple[HttpResponse | None, dict[str, str]]:
    """Handle a Security card POST: a redirect when done, otherwise the field errors to show in place."""
    user = request.user
    back = reverse("account_settings") + "#security"
    enabled = services.is_enabled(user)
    secret = request.session.get(SETUP_SECRET)

    if section == "2fa_start" and not enabled:
        request.session[SETUP_SECRET] = totp.new_secret()
    elif section == "2fa_cancel":
        request.session.pop(SETUP_SECRET, None)
    elif section == "2fa_confirm" and not enabled and secret:
        form = ConfirmSetupForm(secret, request.POST)
        if not form.is_valid():
            return None, field_errors(form)
        request.session[NEW_RECOVERY_CODES] = services.enable(user, secret, form.step)
        del request.session[SETUP_SECRET]
        return flash_redirect(request, messages.SUCCESS, "Two-factor authentication is on.", back), {}
    elif section in ("2fa_disable", "2fa_recovery") and enabled:
        form = ReauthenticateForm(user, request.POST)
        if not form.is_valid():
            return None, field_errors(form)
        if section == "2fa_disable":
            services.disable(user)
            return flash_redirect(request, messages.SUCCESS, "Two-factor authentication is off.", back), {}
        request.session[NEW_RECOVERY_CODES] = services.replace_recovery_codes(user)
        return flash_redirect(request, messages.SUCCESS, "New recovery codes created. The old ones no longer work.", back), {}
    return redirect(back), {}


def settings_data(request: HttpRequest, errors: dict[str, str]) -> dict[str, Any]:
    user = request.user
    enabled = services.is_enabled(user)
    secret = None if enabled else request.session.get(SETUP_SECRET)
    setup = None
    if secret:
        uri = totp.provisioning_uri(secret, user.email)
        setup = {"secret": secret, "qr": totp.qr_data_uri(uri), "uri": uri}
    return {
        "enabled": enabled,
        "enabledAt": user.totp_device.confirmed_at.isoformat() if enabled else None,
        "recoveryCodesLeft": services.recovery_codes_left(user) if enabled else 0,
        "setup": setup,
        "recoveryCodes": request.session.pop(NEW_RECOVERY_CODES, None),
        "errors": errors,
    }
