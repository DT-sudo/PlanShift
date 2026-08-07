"""Manager calendar and shift/position writes; employee calendar and availability."""

from __future__ import annotations
from datetime import date, datetime, timedelta
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET

from apps.accounts.views import manager_required
from apps.accounts.models import User, UserRole
from apps.shell import render_app
from .models import EmployeeUnavailability, Shift
from .services import position_options, shift_fields, shifts_for_manager

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
            },
        },
    )
