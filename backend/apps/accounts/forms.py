from __future__ import annotations

from django import forms
from django.contrib.auth.forms import AuthenticationForm, BaseUserCreationForm, PasswordChangeForm
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from .models import ASSIGNABLE_ROLES, Position, User, UserRole


def _split_full_name(full_name: str) -> tuple[str, str]:
    first, _, last = (full_name or "").strip().partition(" ")
    return first, last.strip()


class NameAndEmailForm(forms.Form):
    """The full name and email every account form asks for; the email doubles as the login username."""

    full_name = forms.CharField(label=_("Full name"), max_length=150)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["email"].required = True

    def clean_full_name(self) -> str:
        full_name = " ".join((self.cleaned_data.get("full_name") or "").split())
        if len(full_name) < 2:
            raise ValidationError(_("Enter your full name."))
        return full_name

    def clean_email(self) -> str:
        """The lowercased email, refused when another account already signs in with it."""
        email = (self.cleaned_data.get("email") or "").strip().lower()
        if User.objects.filter(username=email).exclude(pk=self.instance.pk).exists():
            raise ValidationError(_("An account with this email already exists."))
        return email


class EmailAuthenticationForm(AuthenticationForm):
    """Login by email address.

    Every account's `username` mirrors its lowercased email, so lowercasing the
    input and handing it to Django's default backend is the whole email login.
    """

    username = forms.EmailField(label=_("Email"), max_length=254)

    error_messages = {**AuthenticationForm.error_messages, "invalid_login": _("Incorrect email or password.")}

    def clean_username(self) -> str:
        return (self.cleaned_data.get("username") or "").strip().lower()


class SignUpForm(NameAndEmailForm, BaseUserCreationForm):
    """Public registration: a registration request, not a working account.

    The account signs in, but as a guest who can reach nothing until an admin approves
    it as a manager or an employee (`apps.accounts.views.registration_approve`). Django's
    creation form handles the two password fields and runs the password validators
    against the instance.
    """

    class Meta:
        model = User
        fields = ["email"]

    def _post_clean(self) -> None:
        self.instance.first_name, self.instance.last_name = _split_full_name(self.cleaned_data.get("full_name", ""))
        self.instance.username = self.cleaned_data.get("email", "")
        self.instance.role = UserRole.GUEST
        super()._post_clean()


class AccountForm(NameAndEmailForm, forms.ModelForm):
    """Base for forms that save an account's name and email."""

    def save(self, commit=True) -> User:
        user = super().save(commit=False)
        user.first_name, user.last_name = _split_full_name(self.cleaned_data["full_name"])
        user.username = self.cleaned_data["email"]
        if commit:
            user.save()
        return user


class PositionForm(forms.ModelForm):
    class Meta:
        model = Position
        fields = ["name"]
        error_messages = {
            "name": {
                "required": _("Enter a position name."),
                "unique": _("A position with this name already exists."),
            }
        }


class RoleAndPositionMixin:
    """The role an admin gives an account, and the position that only employees have.

    The role field is the only way to make someone a manager; a position is a job title that gets
    scheduled, nothing more. Guest is never offered: that is where sign-up puts an account, not a
    role to hand out.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["role"].choices = [(role.value, role.label) for role in ASSIGNABLE_ROLES]

    def clean(self) -> dict:
        cleaned = super().clean()
        role, position = cleaned.get("role"), cleaned.get("position")
        if role == UserRole.EMPLOYEE:
            if not position:
                self.add_error("position", _("Employees need a position."))
        elif role:
            cleaned["position"] = None

        return cleaned

class UserForm(RoleAndPositionMixin, AccountForm):
    """The admin's create/edit of any account: name, email, role and (for employees) position."""

    class Meta:
        model = User
        fields = ["email", "role", "position"]


class ApproveRequestForm(RoleAndPositionMixin, forms.ModelForm):
    """Approving a registration request: the guest's name and email stay as they signed up."""

    class Meta:
        model = User
        fields = ["role", "position"]


class RequiredPasswordChangeForm(PasswordChangeForm):
    """Replacing a password someone else chose: the current one, then a new one that differs from it."""

    def clean(self) -> dict:
        cleaned = super().clean()
        new = cleaned.get("new_password1")
        if new and self.user.check_password(new):
            self.add_error("new_password1", _("Choose a password different from the one you were given."))
        return cleaned

    def save(self, commit=True) -> User:
        self.user.must_change_password = False
        return super().save(commit=commit)
