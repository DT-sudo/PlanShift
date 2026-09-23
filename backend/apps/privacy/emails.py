"""Confirmation emails for the GDPR self-service actions in this app, and for a declined registration.

Uses Django's console email backend by default (prints to the server log),
so this works out of the box without SMTP credentials. Set EMAIL_* in .env
for a real deployment - see config/settings.py.

Each email is written in its recipient's language, which is not always the
language of whoever caused it (an admin deleting an account). Sending is
best-effort (`send_email`).
"""

from __future__ import annotations

from django.utils import timezone
from django.utils.formats import date_format
from django.utils.translation import gettext as _

from apps.i18n.languages import speaking
from apps.notifications.services import send_email


def send_data_export_email(user) -> None:
    with speaking(user.language):
        when = date_format(timezone.localtime(), "DATETIME_FORMAT")
        send_email(
            user.email,
            _("Your ft_transcendence data export"),
            _(
                "Hi %(name)s,\n\n"
                "A copy of your personal data was just downloaded from your ft_transcendence account (%(when)s).\n\n"
                "If this wasn't you, someone else may have access to your account - sign in and change your "
                "password, or contact your manager immediately.\n\n"
                "\u2014 ft_transcendence"
            )
            % {"name": user.display_name, "when": when},
        )


def send_registration_declined_email(email: str, name: str, language: str = "") -> None:
    with speaking(language):
        send_email(
            email,
            _("Your ft_transcendence registration was declined"),
            _(
                "Hi %(name)s,\n\n"
                "An administrator declined your request to join ft_transcendence, so the account you signed up with "
                "and everything you entered have been deleted.\n\n"
                "If you think this is a mistake, contact your organisation's manager.\n\n"
                "\u2014 ft_transcendence"
            )
            % {"name": name},
        )


def send_account_deleted_email(email: str, name: str, language: str = "") -> None:
    with speaking(language):
        send_email(
            email,
            _("Your ft_transcendence account has been deleted"),
            _(
                "Hi %(name)s,\n\n"
                "Your ft_transcendence account and the personal data associated with it (profile, shift assignments "
                "and unavailability) have been permanently deleted, as you requested.\n\n"
                "If you did not request this, contact your organisation's manager immediately.\n\n"
                "\u2014 ft_transcendence"
            )
            % {"name": name},
        )
