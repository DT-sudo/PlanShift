"""Manager calendar and shift/position writes; employee calendar and availability."""

from __future__ import annotations
from datetime import date, datetime, timedelta

from django.contrib import messages
from django.core.exceptions import ValidationError
from django.db.models.deletion import ProtectedError
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from apps.accounts.views import employee_required, manager_required
from apps.accounts.models import User, UserRole
from apps.shell import first_form_error, flash_redirect, render_app
from apps.realtime.events import notify_managers

from .forms import PositionForm
from .models import Assignment, EmployeeUnavailability, Position, Shift
from .services import (
    position_options,
    publish_shift,
    publish_shifts_in_period,
    save_shift,
    shift_fields,
    shifts_for_employee,
    shifts_for_manager,
)

# Open calendars and analytics dashboards re-fetch their data when a shift is written.
SHIFTS_CHANGED = {"type": "shifts.changed"}

# ── Query parameters and periods ────────────────────────────────────────────


def _parse_date(value: str | None, default: date | None) -> date | None:
    """Parse YYYY-MM-DD, return default if missing or invalid."""
    try:
        return datetime.strptime((value or "").strip(), "%Y-%m-%d").date()
    except ValueError:
        return default


def _parse_id(value: str | None) -> int | None:
    return int(value) if value and value.isdigit() else None


def _month_bounds(anchor: date) -> tuple[date, date]:
    start = anchor.replace(day=1)
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, next_month - timedelta(days=1)


CALENDAR_VIEWS = ("month", "week")


def _calendar_view(request: HttpRequest) -> str:
    """"month" or "week": the one asked for, else the manager's last choice.

    Kept in the session, so the redirect after a save or delete lands on the same view.
    """
    view = request.GET.get("view") or request.POST.get("view")
    if view in CALENDAR_VIEWS:
        request.session["calendar_view"] = view
        return view
    return request.session.get("calendar_view", "month")


def _period(view: str, anchor: date) -> tuple[date, date]:
    """The visible days: the anchor's month, or its Monday-to-Sunday week."""
    if view == "week":
        start = anchor - timedelta(days=anchor.weekday())
        return start, start + timedelta(days=6)
    return _month_bounds(anchor)


def _manager_shift_or_404(request: HttpRequest, shift_id: int) -> Shift:
    return get_object_or_404(Shift, pk=shift_id, created_by=request.user)


def _active_employees():
    return User.objects.filter(role=UserRole.EMPLOYEE, is_active=True).order_by("last_name", "first_name", "username")


def _calendar_url(shift: Shift) -> str:
    """The manager calendar showing the shift's month."""
    return f"{reverse('manager_shifts')}?date={shift.date.isoformat()}"


def _shift_payload(shift_qs) -> list[dict]:
    return [
        {
            "id": s.id,
            **shift_fields(s),
            "position_id": s.position_id,
            "capacity": s.capacity,
            "assigned_employee_ids": [a.employee_id for a in s.assignments.all()],
            "status": s.status,
            "is_past": s.is_past,
        }
        for s in shift_qs.prefetch_related("assignments")
    ]


def _unavailability_payload(*, since: date) -> dict[str, list[str]]:
    """Unavailable days per active employee from `since` on, keyed by employee id."""
    days: dict[str, list[str]] = {}
    rows = EmployeeUnavailability.objects.filter(date__gte=since, employee__is_active=True).values_list(
        "employee_id", "date"
    )
    for employee_id, day in rows:
        days.setdefault(str(employee_id), []).append(day.isoformat())
    return days


@manager_required
@require_GET
def manager_shifts(request: HttpRequest) -> HttpResponse:
    today = timezone.localdate()
    anchor = _parse_date(request.GET.get("date"), today)
    view = _calendar_view(request)
    start, end = _period(view, anchor)

    position_id = _parse_id(request.GET.get("position"))
    status = (request.GET.get("status") or "").lower()
    understaffed = request.GET.get("show") == "understaffed"

    shift_qs = shifts_for_manager(
        manager_id=request.user.id,
        start=start,
        end=end,
        position_id=position_id,
        status=status or None,
        understaffed_only=understaffed,
    )
    employees = _active_employees().select_related("position")

    return render_app(
        request,
        page="manager-shifts",
        title="Shift Management",
        nav_active="manager_shifts",
        data={
            "view": view,
            "anchor": anchor.isoformat(),
            "start": start.isoformat(),
            "end": end.isoformat(),
            "today": today.isoformat(),
            "positions": position_options(),
            "employees": [
                {
                    "id": e.id,
                    "name": e.display_name,
                    "position_id": e.position_id,
                    "position": e.position.name if e.position else "",
                }
                for e in employees
            ],
            "unavailability": _unavailability_payload(since=min(start, today)),
            "shifts": _shift_payload(shift_qs),
            "filters": {"position": position_id or "", "status": status, "understaffed": understaffed},
            "urls": {
                "create": reverse("create_shift"),
                "update": reverse("update_shift", args=[0]),
                "delete": reverse("delete_shift", args=[0]),
                "publish": reverse("publish_shift", args=[0]),
                "publishAll": reverse("publish_all_shifts"),
            },
        },
    )


@manager_required
@require_POST
def save_shift_view(request: HttpRequest, shift_id: int | None = None) -> HttpResponse:
    is_update = shift_id is not None
    shift = _manager_shift_or_404(request, shift_id) if is_update else Shift(created_by=request.user)
    try:
        saved = save_shift(shift, request.POST)
    except ValidationError as exc:
        return flash_redirect(request, messages.ERROR, " ".join(exc.messages), "manager_shifts")
    return flash_redirect(
        request, messages.SUCCESS, "Shift updated." if is_update else "Shift created.", _calendar_url(saved)
    )


@manager_required
@require_POST
def delete_shift(request: HttpRequest, shift_id: int) -> HttpResponse:
    shift = _manager_shift_or_404(request, shift_id)
    shift.delete()
    return flash_redirect(request, messages.SUCCESS, "Shift deleted.", "manager_shifts")


@manager_required
@require_POST
def publish_shift_view(request: HttpRequest, shift_id: int) -> HttpResponse:
    shift = _manager_shift_or_404(request, shift_id)
    publish_shift(shift)
    return flash_redirect(request, messages.SUCCESS, "Shift published.", _calendar_url(shift))


@manager_required
@require_POST
def publish_all_shifts(request: HttpRequest) -> HttpResponse:
    """Publish all draft shifts in the visible month or week."""
    start, end = _period(_calendar_view(request), _parse_date(request.POST.get("date"), timezone.localdate()))
    published = publish_shifts_in_period(manager_id=request.user.id, start=start, end=end)
    if published:
        count = len(published)
        text = ("Published %(count)d shift." if count == 1 else "Published %(count)d shifts.") % {"count": count}
        return flash_redirect(request, messages.SUCCESS, text, "manager_shifts")
    return flash_redirect(request, messages.INFO, "No draft shifts to publish.", "manager_shifts")


# ── Positions ───────────────────────────────────────────────────────────────


@manager_required
@require_POST
def position_create(request: HttpRequest) -> HttpResponse:
    form = PositionForm(request.POST)
    if not form.is_valid():
        return flash_redirect(request, messages.ERROR, first_form_error(form, "Could not create position."), "manager_employees")
    position = form.save()
    notify(managers(), "position.created", actor=request.user, name=position.name)
    return flash_redirect(request, messages.SUCCESS, "Position created: %(name)s." % {"name": position.name}, "manager_employees")


@manager_required
@require_POST
def position_delete(request: HttpRequest, position_id: int) -> HttpResponse:
    position = get_object_or_404(Position, pk=position_id)
    try:
        position.delete()
    except ProtectedError:
        return flash_redirect(
            request, messages.ERROR, "Cannot delete position: it is referenced by existing data.", "manager_employees"
        )
    notify(managers(), "position.deleted", actor=request.user, level="warning", name=position.name)
    return flash_redirect(request, messages.SUCCESS, "Position deleted: %(name)s." % {"name": position.name}, "manager_employees")


@employee_required
@require_GET
def employee_shifts_view(request: HttpRequest) -> HttpResponse:
    today = timezone.localdate()
    anchor = _parse_date(request.GET.get("date"), today)
    start, end = _month_bounds(anchor)

    unavailable = EmployeeUnavailability.objects.filter(
        employee_id=request.user.id, date__gte=start, date__lte=end
    ).values_list("date", flat=True)

    return render_app(
        request,
        page="employee-shifts",
        title="My Shifts",
        nav_active="employee_shifts",
        data={
            "anchor": anchor.isoformat(),
            "today": today.isoformat(),
            "shifts": [
                {"id": s.id, **shift_fields(s), "is_past": s.is_past}
                for s in shifts_for_employee(employee_id=request.user.id, start=start, end=end)
            ],
            "unavailable": [day.isoformat() for day in unavailable],
            "urls": {"toggleUnavailability": reverse("employee_unavailability_toggle")},
        },
    )


@employee_required
@require_POST
def employee_unavailability_toggle(request: HttpRequest) -> JsonResponse:
    day = _parse_date(request.POST.get("date"), None)
    if day is None:
        return JsonResponse({"ok": False, "error": "Enter a valid date."}, status=400)
    if day <= timezone.localdate():
        return JsonResponse(
            {"ok": False, "error": "Only dates from tomorrow onwards can be marked as unavailable."}, status=400
        )
    if Assignment.objects.filter(employee_id=request.user.id, shift__date=day).exists():
        return JsonResponse({"ok": False, "error": "You have a shift assigned on this day."}, status=400)

    existing = EmployeeUnavailability.objects.filter(employee_id=request.user.id, date=day)
    unavailable = not existing.exists()
    if unavailable:
        EmployeeUnavailability.objects.create(employee_id=request.user.id, date=day)
    else:
        existing.delete()

    notify_managers(
        {
            "type": "unavailability.changed",
            "employeeId": request.user.id,
            "employeeName": request.user.display_name,
            "date": day.isoformat(),
            "unavailable": unavailable,
        }
    )
    return JsonResponse({"ok": True, "date": day.isoformat(), "unavailable": unavailable})
