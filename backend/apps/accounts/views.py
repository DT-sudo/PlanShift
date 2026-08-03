"""Sign-up, login, logout, demo logins, and the manager-side employee directory."""

from __future__ import annotations

from django.contrib.auth import login
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.views.decorators.http import require_http_methods
from apps.shell import field_errors, render_app

from .forms import EmailAuthenticationForm


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
