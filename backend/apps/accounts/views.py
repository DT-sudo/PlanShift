"""Sign-up, login, logout, demo logins, the required password change, registration requests,
and the admin-side account and position directory."""

from __future__ import annotations

from functools import wraps

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import ProtectedError
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils.translation import gettext as _
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.notifications.services import admins, managers, notify
from apps.privacy.emails import send_account_deleted_email, send_registration_declined_email
from apps.realtime.events import DIRECTORY_CHANGED, REGISTRATION_APPROVED, notify_everyone, push_to_user
from apps.shell import field_errors, first_form_error, flash_redirect, render_app
from apps.scheduling import notices
from apps.scheduling.management.commands.seed_demo import DEMO_ACCOUNTS, DEMO_EMPLOYEE_EMAIL
from apps.scheduling.services import position_options
from apps.twofactor import services as two_factor
from apps.twofactor.views import begin_login

from .forms import ApproveRequestForm, EmailAuthenticationForm, PositionForm, SignUpForm, UserForm
from .models import ASSIGNABLE_ROLES, Position, User, UserRole


def _role_required(attr: str, other_home: str):
    """Require login and a role; a signed-in user of the other role goes to their own home."""

    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect("login")
            if not getattr(request.user, attr):
                return redirect(other_home)
            return view(request, *args, **kwargs)

        return wrapped

    return decorator
from .security import end_sessions, end_sessions_for, end_this_session, log_security
from .services import announce_waiting_requests, delete_position, position_options, release_from_upcoming


def _home_page(user) -> str:
    """The page that holds this account's own work: accounts, the schedule, your shifts, or the waiting room."""
    if user.is_admin:
        return "admin_users"
    if user.is_guest:
        return "registration_pending"
    return "manager_shifts" if user.is_manager else "employee_shifts"


def _requires(allowed):
    """Require login and a role; anyone else is sent to their own home page."""

    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect("login")
            if not allowed(request.user):
                return redirect(_home_page(request.user))
            return view(request, *args, **kwargs)

        return wrapped

    return decorator


admin_required = _requires(lambda user: user.is_admin)
manager_required = _requires(lambda user: user.is_manager and not user.is_admin)
employee_required = _requires(lambda user: user.is_employee)
colleague_required = _requires(lambda user: user.role in (UserRole.MANAGER, UserRole.EMPLOYEE))
guest_required = _requires(lambda user: user.is_guest)


@require_http_methods(["GET", "POST"])
def login_view(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("home")

    form = EmailAuthenticationForm(request, data=request.POST or None)
    if request.method == "POST":
        if form.is_valid():
            log_security("login.password_ok", request, actor=form.get_user())
            return begin_login(request, form.get_user())
        log_security("login.failed", request, email=form["username"].value() or "-")

    errors = field_errors(form)
    if "username" in errors:
        errors["email"] = errors.pop("username")

    urls = {"login": reverse("login"), "signup": reverse("signup")}
    if settings.ENABLE_DEMO_LOGIN:
        urls.update({f"demo{role.title()}": reverse("demo_login", args=[role]) for role in DEMO_ACCOUNTS})

    return render_app(
        request,
        page="login",
        title=_("Sign in"),
        data={
            "showDemo": settings.ENABLE_DEMO_LOGIN,
            "email": form["username"].value() or "",
            "error": " ".join(form.non_field_errors()),
            "fieldErrors": errors,
            "urls": urls,
        },
    )


@require_http_methods(["GET", "POST"])
def signup_view(request: HttpRequest) -> HttpResponse:
    """Register: email + password (hashed by Django's PBKDF2), signed in as a guest until an admin approves."""
    if request.user.is_authenticated:
        return redirect("home")

    posted = request.method == "POST"
    form = SignUpForm(request.POST or None)
    if posted and form.is_valid():
        user = form.save()
        login(request, user)
        log_security("signup", request, actor=user, role=user.role)
        notify(admins(), "registration.requested", actor=user, name=user.display_name, email=user.email)
        _directory_changed()
        announce_waiting_requests()
        messages.success(
            request,
            _("Welcome, %(name)s. Your registration request was sent to an administrator.") % {"name": user.get_full_name()},
        )
        return redirect("home")

    return render_app(
        request,
        page="signup",
        title=_("Create account"),
        data={
            "values": {
                "fullName": request.POST.get("full_name", ""),
                "email": request.POST.get("email", ""),
            },
            "error": " ".join(form.non_field_errors()) if posted else "",
            "fieldErrors": field_errors(form) if posted else {},
            "urls": {"signup": reverse("signup"), "login": reverse("login")},
        },
    )


@login_required
@require_POST
def logout_view(request: HttpRequest) -> HttpResponse:
    end_this_session(request)
    log_security("logout", request)
    logout(request)
    return redirect("login")


@login_required
def home(request: HttpRequest) -> HttpResponse:
    """Send each role to its own landing page."""
    return redirect("manager_shifts" if request.user.is_manager else "employee_shifts")


@guest_required
@require_GET
def registration_pending(request: HttpRequest) -> HttpResponse:
    """A guest's only page: their request, waiting for an admin."""
    return render_app(
        request,
        page="registration-pending",
        title=_("Waiting for approval"),
        data={
            "email": request.user.email,
            "requestedAt": request.user.date_joined.isoformat(),
            "urls": {"home": reverse("home")},
        },
    )


@require_GET
def demo_login(request: HttpRequest, role: str) -> HttpResponse:
    """Sign in as one of the accounts `seed_demo` creates, without a password (but not without a 2FA code)."""
    if not settings.ENABLE_DEMO_LOGIN:
        return redirect("login")
    email = DEMO_ACCOUNTS.get(role, DEMO_EMPLOYEE_EMAIL)
    user = User.objects.filter(username=email, is_active=True).first()
    if user is None:
        messages.error(request, _("Demo accounts are missing. Run `python manage.py seed_demo` first."))
        return redirect("login")
    log_security("login.demo", request, actor=user, role=role)
    return begin_login(request, user)


def _managed_user_or_404(request: HttpRequest, user_id: int) -> User:
    """An account on the Users page. Registration requests are answered on the Requests page instead."""
    return get_object_or_404(request.user.managed_users().exclude(role=UserRole.GUEST), pk=user_id)


def _account_form(request: HttpRequest):
    """Admins also pick the role; a manager's form always makes an employee (the model's default role)."""
    return UserForm if request.user.is_admin else EmployeeForm


def _set_generated_password(request: HttpRequest, employee: User) -> None:
    """Give the employee a fresh random password and keep it in the session to show once.

    The admin has seen it, so it only opens the page that replaces it (`must_change_password`).
    """
    password = User.generate_password()
    employee.set_password(password)
    employee.must_change_password = True
    employee.save()
    request.session["one_time_credentials"] = {"login": employee.email, "password": password}


def _role_options() -> list[dict]:
    return [{"id": role.value, "name": role.label} for role in ASSIGNABLE_ROLES]


def _back(request: HttpRequest, level: int, text: str) -> HttpResponse:
    return flash_redirect(request, level, text, "admin_users")


@manager_required
@require_GET
def manager_employees(request: HttpRequest) -> HttpResponse:
    is_admin = request.user.is_admin

    return render_app(
        request,
        page="manager-employees",
        title=_("User Management") if is_admin else _("Employee Management"),
        nav_active="manager_employees",
        data={
            "employees": [
                {
                    "id": e.id,
                    "employeeId": e.employee_id,
                    "fullName": e.display_name,
                    "avatarUrl": e.avatar_url,
                    "profileUrl": reverse("profile", args=[e.id]),
                    "email": e.email,
                    "role": e.role,
                    "roleLabel": e.get_role_display(),
                    "positionId": e.position_id,
                    "position": e.position.name if e.position else "",
                    "twoFactor": two_factor.is_enabled(e),
                }
                for e in request.user.managed_users().select_related("position", "totp_device")
            ],
            "roles": [{"id": value, "name": label} for value, label in UserRole.choices] if is_admin else None,
            "positions": position_options(),
            "credentials": request.session.pop("one_time_credentials", None),
            "urls": {
                "positionCreate": reverse("position_create"),
                "positionDelete": reverse("position_delete", args=[0]),
            },
        },
    )


@manager_required
@require_POST
def manager_employees_create(request: HttpRequest) -> HttpResponse:
    form = _account_form(request)(request.POST)
    if not form.is_valid():
        return _back(request, messages.ERROR, first_form_error(form, _("Please fix the errors and try again.")))

    account = form.save(commit=False)
    _set_generated_password(request, account)
    notify(managers(), "account.added", actor=request.user, role=account.role, name=account.display_name)
    return _back(request, messages.SUCCESS, _("%(role)s created.") % {"role": account.get_role_display()})


@manager_required
@require_POST
def employee_update(request: HttpRequest, user_id: int) -> HttpResponse:
    account = _managed_user_or_404(request, user_id)
    form = _account_form(request)(request.POST, instance=account)
    if not form.is_valid():
        return _back(request, messages.ERROR, first_form_error(form, _("Could not update the account.")))
    account = form.save()
    if form.has_changed():
        actor = request.user
        notify(managers(), "account.updated", actor=actor, role=account.role, name=account.display_name)
        if "role" in form.changed_data:
            notify([account], "account.role_changed", actor=actor, by=actor.display_name, role=account.role)
        else:
            notify([account], "account.details_updated", actor=actor, by=actor.display_name)
    return _back(request, messages.SUCCESS, _("%(role)s updated.") % {"role": account.get_role_display()})


@manager_required
@require_POST
def reset_employee_password(request: HttpRequest, user_id: int) -> HttpResponse:
    employee = _managed_user_or_404(request, user_id)
    _set_generated_password(request, employee)
    notify([employee], "account.password_reset", actor=request.user, level="warning", by=request.user.display_name)
    return _back(request, messages.SUCCESS, _("Password reset."))


@manager_required
@require_POST
def reset_employee_two_factor(request: HttpRequest, user_id: int) -> HttpResponse:
    """Turn off 2FA for someone who lost both their phone and their recovery codes; they are told by email."""
    account = _managed_user_or_404(request, user_id)
    if not two_factor.disable(account, actor=request.user):
        return _back(request, messages.ERROR, _("%(name)s doesn't use two-factor authentication.") % {"name": account.display_name})
    return _back(request, messages.SUCCESS, _("Two-factor authentication reset for %(name)s.") % {"name": account.display_name})


@manager_required
@require_POST
def employee_delete(request: HttpRequest, user_id: int) -> HttpResponse:
    """Erase an employee's account on the manager's initiative.

    This is the other door to the same GDPR erasure right as
    `apps.privacy.delete_my_account` - the Privacy Policy tells users they can
    ask their manager to delete their account directly instead of using the
    self-service page - so it closes with the same confirmation email, sent
    to the employee (not the manager) once the data is actually gone.
    """
    account = _managed_user_or_404(request, user_id)
    label, email, role, language = account.display_name, account.email, account.role, account.language
    role_label = str(account.get_role_display())
    try:
        account.delete()
    except ProtectedError:
        return _back(request, messages.ERROR, _("Cannot delete %(name)s: they still have shifts. Reassign or delete them first.") % {"name": label})
    send_account_deleted_email(email, label, language)
    notify(managers(), "account.deleted", actor=request.user, level="warning", role=role, name=label)
    return _back(request, messages.SUCCESS, _("Deleted %(role)s: %(name)s.") % {"role": role_label.lower(), "name": label})


def _directory_changed() -> None:
    """Every open page re-reads itself: the accounts and positions directory is shared by all three roles."""
    notify_everyone(DIRECTORY_CHANGED)


@admin_required
@require_GET
def admin_users(request: HttpRequest) -> HttpResponse:
    return render_app(
        request,
        page="admin-users",
        title=_("User Management"),
        nav_active="admin_users",
        data={
            "employees": [
                {
                    "id": e.id,
                    "employeeId": e.employee_id,
                    "fullName": e.display_name,
                    "avatarUrl": e.avatar_url,
                    "profileUrl": reverse("profile", args=[e.id]),
                    "email": e.email,
                    "role": e.role,
                    "roleLabel": e.get_role_display(),
                    "positionId": e.position_id,
                    "position": e.position.name if e.position else "",
                    "twoFactor": two_factor.is_enabled(e),
                }
                for e in request.user.managed_users().exclude(role=UserRole.GUEST).select_related("position", "totp_device")
            ],
            "roles": _role_options(),
            "positions": position_options(),
            "credentials": request.session.pop("one_time_credentials", None),
            "urls": {
                "create": reverse("admin_user_create"),
                "update": reverse("admin_user_update", args=[0]),
                "delete": reverse("admin_user_delete", args=[0]),
                "resetPassword": reverse("admin_user_reset_password", args=[0]),
                "resetTwoFactor": reverse("admin_user_reset_two_factor", args=[0]),
                "positionCreate": reverse("position_create"),
                "positionDelete": reverse("position_delete", args=[0]),
            },
        },
    )


@admin_required
@require_POST
def admin_user_create(request: HttpRequest) -> HttpResponse:
    form = UserForm(request.POST)
    if not form.is_valid():
        return _back(request, messages.ERROR, first_form_error(form, _("Please fix the errors and try again.")))

    account = form.save(commit=False)
    _set_generated_password(request, account)
    notify(managers(), "account.added", actor=request.user, role=account.role, name=account.display_name)
    _directory_changed()
    log_security("account.created", request, target=account, role=account.role)
    return _back(request, messages.SUCCESS, _("%(role)s created.") % {"role": account.get_role_display()})


@admin_required
@require_POST
def admin_user_update(request: HttpRequest, user_id: int) -> HttpResponse:
    account = _managed_user_or_404(request, user_id)
    was_role, was_position = account.role, account.position

    form = UserForm(request.POST, instance=account)
    if not form.is_valid():
        return _back(request, messages.ERROR, first_form_error(form, _("Could not update the account.")))
    account = form.save()

    role_changed = account.role != was_role
    position_changed = account.position_id != (was_position.pk if was_position else None)
    position = account.position.name if account.position else None

    if role_changed or position_changed:
        release_from_upcoming(account, actor=request.user)
        end_sessions(account, reason="role_changed" if role_changed else "position_changed", request=request)
    if role_changed:
        log_security("account.role_changed", request, target=account, was=was_role, now=account.role)

    if form.has_changed():
        actor = request.user
        others = set(managers()) - {account.pk}
        notify(others, "account.updated", actor=actor, role=account.role, name=account.display_name)
        if role_changed:
            notify(
                [account],
                "account.role_changed",
                actor=actor,
                level="warning",
                by=actor.display_name,
                was=was_role,
                role=account.role,
                position=position,
            )
        elif position_changed and position:
            notify(
                [account],
                "account.position_changed",
                actor=actor,
                level="warning",
                by=actor.display_name,
                was=was_position.name if was_position else None,
                position=position,
            )
        else:
            notify([account], "account.details_updated", actor=actor, by=actor.display_name)
        _directory_changed()
        log_security("account.updated", request, target=account, fields=",".join(form.changed_data) or "-")
    return _back(request, messages.SUCCESS, _("%(role)s updated.") % {"role": account.get_role_display()})


@admin_required
@require_POST
def admin_user_reset_password(request: HttpRequest, user_id: int) -> HttpResponse:
    employee = _managed_user_or_404(request, user_id)
    _set_generated_password(request, employee)
    end_sessions(employee, reason="password_reset", request=request)
    notify([employee], "account.password_reset", actor=request.user, level="warning", by=request.user.display_name)
    return _back(request, messages.SUCCESS, _("Password reset."))


@admin_required
@require_POST
def admin_user_reset_two_factor(request: HttpRequest, user_id: int) -> HttpResponse:
    """Turn off 2FA for someone who lost both their phone and their recovery codes; they are told by email."""
    account = _managed_user_or_404(request, user_id)
    if not two_factor.disable(account, actor=request.user):
        return _back(request, messages.ERROR, _("%(name)s doesn't use two-factor authentication.") % {"name": account.display_name})
    _directory_changed()
    log_security("account.two_factor_reset", request, target=account)
    return _back(request, messages.SUCCESS, _("Two-factor authentication reset for %(name)s.") % {"name": account.display_name})


@admin_required
@require_POST
def admin_user_delete(request: HttpRequest, user_id: int) -> HttpResponse:
    """Erase an account on the admin's initiative.

    This is the other door to the same GDPR erasure right as
    `apps.privacy.delete_my_account` - the Privacy Policy tells users they can
    ask their manager to delete their account directly instead of using the
    self-service page - so it closes with the same confirmation email, sent
    to the employee (not the manager) once the data is actually gone.
    """
    account = _managed_user_or_404(request, user_id)
    account_id = account.pk
    label, email, role, language = account.display_name, account.email, account.role, account.language
    role_label = str(account.get_role_display())
    release_from_upcoming(account, actor=request.user, tell_account=False)
    had_assignments = account.assignments.exists()
    account.delete()
    end_sessions_for(account_id, reason="account_deleted", request=request)
    send_account_deleted_email(email, label, language)
    notify(managers(), "account.deleted", actor=request.user, level="warning", role=role, name=label)
    _directory_changed()
    if had_assignments:
        notices.shifts_changed()
    log_security("account.deleted", request, account=account_id, role=role)
    return _back(request, messages.SUCCESS, _("Deleted %(role)s: %(name)s.") % {"role": role_label.lower(), "name": label})


def _request_or_404(request: HttpRequest, user_id: int) -> User:
    return get_object_or_404(request.user.managed_users().filter(role=UserRole.GUEST), pk=user_id)


def _back_to_requests(request: HttpRequest, level: int, text: str) -> HttpResponse:
    return flash_redirect(request, level, text, "registration_requests")


@admin_required
@require_GET
def registration_requests(request: HttpRequest) -> HttpResponse:
    """Everyone who signed up and is waiting, oldest first: approve with a role, or decline."""
    guests = request.user.managed_users().filter(role=UserRole.GUEST).order_by("date_joined")
    return render_app(
        request,
        page="registration-requests",
        title=_("Registration requests"),
        nav_active="registration_requests",
        data={
            "requests": [
                {
                    "id": guest.id,
                    "fullName": guest.display_name,
                    "avatarUrl": guest.avatar_url,
                    "email": guest.email,
                    "requestedAt": guest.date_joined.isoformat(),
                }
                for guest in guests
            ],
            "roles": _role_options(),
            "positions": position_options(),
            "urls": {
                "approve": reverse("registration_approve", args=[0]),
                "decline": reverse("registration_decline", args=[0]),
            },
        },
    )


@admin_required
@require_POST
def registration_approve(request: HttpRequest, user_id: int) -> HttpResponse:
    """Turn a guest into a manager or an employee; their waiting page moves on to their new home page."""
    account = _request_or_404(request, user_id)
    form = ApproveRequestForm(request.POST, instance=account)
    if not form.is_valid():
        return _back_to_requests(request, messages.ERROR, first_form_error(form, _("Could not approve the request.")))
    account = form.save()

    actor = request.user
    position = account.position.name if account.position else None
    notify(
        [account],
        "registration.approved",
        actor=actor,
        by=actor.display_name,
        role=account.role,
        position=position,
    )
    notify(set(managers()) - {account.pk}, "account.added", actor=actor, role=account.role, name=account.display_name)
    push_to_user(account.pk, REGISTRATION_APPROVED)
    _directory_changed()
    announce_waiting_requests()
    log_security("registration.approved", request, target=account, role=account.role)
    return _back_to_requests(
        request,
        messages.SUCCESS,
        _("%(name)s approved as %(role)s.") % {"name": account.display_name, "role": account.get_role_display()},
    )


@admin_required
@require_POST
def registration_decline(request: HttpRequest, user_id: int) -> HttpResponse:
    """Refuse a request: the account and everything it entered are erased, and they are told by email."""
    account = _request_or_404(request, user_id)
    account_id, label, email, language = account.pk, account.display_name, account.email, account.language
    account.delete()
    end_sessions_for(account_id, reason="registration_declined", request=request)
    send_registration_declined_email(email, label, language)
    _directory_changed()
    announce_waiting_requests()
    log_security("registration.declined", request, account=account_id)
    return _back_to_requests(request, messages.SUCCESS, _("Request from %(name)s declined.") % {"name": label})


@admin_required
@require_POST
def position_create(request: HttpRequest) -> HttpResponse:
    form = PositionForm(request.POST)
    if not form.is_valid():
        return _back(request, messages.ERROR, first_form_error(form, _("Could not create position.")))
    position = form.save()
    notify(managers(), "position.created", actor=request.user, name=position.name)
    _directory_changed()
    log_security("position.created", request, position=position.pk)
    return _back(request, messages.SUCCESS, _("Position created: %(name)s.") % {"name": position.name})


@admin_required
@require_POST
def position_delete(request: HttpRequest, position_id: int) -> HttpResponse:
    position = get_object_or_404(Position, pk=position_id)
    delete_position(position, actor=request.user)
    _directory_changed()
    log_security("position.deleted", request, position=position_id)
    return _back(request, messages.SUCCESS, _("Position deleted: %(name)s.") % {"name": position.name})
