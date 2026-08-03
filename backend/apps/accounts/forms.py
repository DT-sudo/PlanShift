from __future__ import annotations

from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.utils.translation import gettext_lazy as _


def _split_full_name(full_name: str) -> tuple[str, str]:
    first, _, last = (full_name or "").strip().partition(" ")
    return first, last.strip()


class EmailAuthenticationForm(AuthenticationForm):
    """Login by email address.

    Every account's `username` mirrors its lowercased email, so lowercasing the
    input and handing it to Django's default backend is the whole email login.
    """

    username = forms.EmailField(label="Email", max_length=254)

    error_messages = {**AuthenticationForm.error_messages, "invalid_login": "Incorrect email or password."}

    def clean_username(self) -> str:
        return (self.cleaned_data.get("username") or "").strip().lower()
