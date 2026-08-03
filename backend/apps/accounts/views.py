"""Sign-up, login, logout, demo logins, and the manager-side employee directory."""

from __future__ import annotations

from functools import wraps

from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.views.decorators.http import require_http_methods, require_POST
from apps.shell import field_errors, render_app

from .forms import EmailAuthenticationForm


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
