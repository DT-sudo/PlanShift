"""Sign-up, login, logout, demo logins, and the manager-side employee directory."""

from __future__ import annotations

from functools import wraps

from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import ProtectedError
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.shell import field_errors, first_form_error, flash_redirect, render_app
from apps.scheduling.services import position_options

from .forms import EmailAuthenticationForm, EmployeeForm
from .models import User


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


manager_required = _role_required("is_manager", "employee_shifts")
employee_required = _role_required("is_employee", "manager_shifts")


@require_http_methods(["GET", "POST"])
def login_view(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("home")

    form = EmailAuthenticationForm(request, data=request.POST or None)
    if request.method == "POST" and form.is_valid():
        login(request, form.get_user())
        return redirect("home")

    errors = field_errors(form)
    if "username" in errors:
        errors["email"] = errors.pop("username")

    urls = {"login": reverse("login"), "signup": reverse("signup")}

    return render_app(
        request,
        page="login",
        title="Sign in",
        data={
            "email": form["username"].value() or "",
            "error": " ".join(form.non_field_errors()),
            "fieldErrors": errors,
            "urls": urls,
        },
    )


@login_required
@require_POST
def logout_view(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect("login")


@login_required
def home(request: HttpRequest) -> HttpResponse:
    """Send each role to its own landing page."""
    return redirect("manager_shifts" if request.user.is_manager else "employee_shifts")


def _managed_user_or_404(request: HttpRequest, user_id: int) -> User:
    return get_object_or_404(request.user.managed_users(), pk=user_id)


def _account_form(request: HttpRequest):
    """Admins also pick the role; a manager's form always makes an employee (the model's default role)."""
    return EmployeeForm


def _set_generated_password(request: HttpRequest, employee: User) -> None:
    """Give the employee a fresh random password and keep it in the session to show once."""
    password = User.generate_password()
    employee.set_password(password)
    employee.save()
    request.session["one_time_credentials"] = {"login": employee.email, "password": password}


def _back(request: HttpRequest, level: int, text: str) -> HttpResponse:
    return flash_redirect(request, level, text, "manager_employees")


@manager_required
@require_GET
def manager_employees(request: HttpRequest) -> HttpResponse:
    return render_app(
        request,
        page="manager-employees",
        title="Employee Management",
        nav_active="manager_employees",
        data={
            "employees": [
                {
                    "id": e.id,
                    "employeeId": e.employee_id,
                    "fullName": e.display_name,
                    "email": e.email,
                    "role": e.role,
                    "roleLabel": e.get_role_display(),
                    "positionId": e.position_id,
                    "position": e.position.name if e.position else "",
                }
                for e in request.user.managed_users().select_related("position")
            ],
            "roles": None,
            "positions": position_options(),
            "credentials": request.session.pop("one_time_credentials", None),
            "urls": {
                "create": reverse("manager_employees_create"),
                "update": reverse("employee_update", args=[0]),
                "delete": reverse("employee_delete", args=[0]),
            },
        },
    )


@manager_required
@require_POST
def manager_employees_create(request: HttpRequest) -> HttpResponse:
    form = _account_form(request)(request.POST)
    if not form.is_valid():
        return _back(request, messages.ERROR, first_form_error(form, "Please fix the errors and try again."))

    account = form.save(commit=False)
    _set_generated_password(request, account)
    return _back(request, messages.SUCCESS, "%(role)s created." % {"role": account.get_role_display()})


@manager_required
@require_POST
def employee_update(request: HttpRequest, user_id: int) -> HttpResponse:
    account = _managed_user_or_404(request, user_id)
    form = _account_form(request)(request.POST, instance=account)
    if not form.is_valid():
        return _back(request, messages.ERROR, first_form_error(form, "Could not update the account."))
    account = form.save()
    return _back(request, messages.SUCCESS, "%(role)s updated." % {"role": account.get_role_display()})


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
    label, email, role = account.display_name, account.email, account.role
    role_label = str(account.get_role_display())
    try:
        account.delete()
    except ProtectedError:
        return _back(request, messages.ERROR, "Cannot delete %(name)s: they still have shifts. Reassign or delete them first." % {"name": label})
    return _back(request, messages.SUCCESS, "Deleted %(role)s: %(name)s." % {"role": role_label.lower(), "name": label})
