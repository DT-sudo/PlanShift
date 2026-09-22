"""Scheduling rules and writes. Views parse requests and render; the rules live here."""

from __future__ import annotations

from collections import Counter
from datetime import date

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from django.utils.formats import date_format
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy

from apps.accounts.models import User, UserRole

from .forms import ShiftForm
from .models import MIDNIGHT, Assignment, EmployeeUnavailability, Shift, ShiftStatus, clock


def shift_fields(shift: Shift) -> dict:
    """The fields every shift payload shares: its day, HH:MM times and position name."""
    return {
        "date": shift.date.isoformat(),
        "start_time": clock(shift.start_time),
        "end_time": clock(shift.end_time, end=True),
        "position": shift.position_name,
    }


class ShiftError(ValidationError):
    """A shift save the rules refused, and where the form should say so: the field it concerns
    (None for the form as a whole) and, for a rule about one employee, which one."""

    def __init__(self, message, *, field: str | None = None, employee_id: int | None = None):
        super().__init__(message)
        self.field, self.employee_id = field, employee_id


def _employee_error(message, employee_id: int) -> ShiftError:
    return ShiftError(message, field="employee_ids", employee_id=employee_id)


def _check_position_match(shift: Shift, employee_ids: list[int]) -> None:
    valid = set(
        User.objects.filter(
            id__in=employee_ids, role=UserRole.EMPLOYEE, is_active=True, position_id=shift.position_id
        ).values_list("id", flat=True)
    )
    wrong = next((employee_id for employee_id in employee_ids if employee_id not in valid), None)
    if wrong is not None:
        raise _employee_error(_("Selected employees must match the shift position."), wrong)


def _check_capacity(shift: Shift, employee_ids: list[int]) -> None:
    if len(employee_ids) > shift.capacity:
        raise ShiftError(_("Cannot assign more employees than shift capacity."), field="capacity")


def _check_availability(shift: Shift, employee_ids: list[int]) -> None:
    unavailable = (
        EmployeeUnavailability.objects.filter(employee_id__in=employee_ids, date=shift.date)
        .values_list("employee_id", flat=True)
        .first()
    )
    if unavailable is not None:
        message = _("Employee is unavailable on %(day)s.") % {"day": date_format(shift.date, "D j M Y")}
        raise _employee_error(message, unavailable)


def _check_no_overlap(shift: Shift, employee_ids: list[int]) -> None:
    overlapping = models.Q(shift__end_time__gt=shift.start_time) | models.Q(shift__end_time=MIDNIGHT)
    if shift.end_time != MIDNIGHT:
        overlapping &= models.Q(shift__start_time__lt=shift.end_time)
    conflict = (
        Assignment.objects.filter(overlapping, employee_id__in=employee_ids, shift__date=shift.date)
        .exclude(shift_id=shift.id)
        .select_related("shift")
        .order_by("shift__start_time")
        .first()
    )
    if conflict:
        other = conflict.shift
        message = _("Employee already assigned to: %(position)s %(start)s–%(end)s (%(day)s)") % {
            "position": other.position_name,
            "start": clock(other.start_time),
            "end": clock(other.end_time, end=True),
            "day": date_format(other.date, "j M"),
        }
        raise _employee_error(message, conflict.employee_id)


def assign_employees_to_shift(shift: Shift, employee_ids: list[int]) -> None:
    """Replace the shift's assignments after running the four scheduling rules."""
    employee_ids = list(dict.fromkeys(employee_ids))
    if employee_ids:
        _check_position_match(shift, employee_ids)
        _check_capacity(shift, employee_ids)
        _check_availability(shift, employee_ids)
        _check_no_overlap(shift, employee_ids)
    Assignment.objects.filter(shift=shift).delete()
    Assignment.objects.bulk_create([Assignment(shift=shift, employee_id=eid) for eid in employee_ids])


STALE_SHIFT = gettext_lazy("Someone else changed this shift while you were editing it. Your changes were not saved.")
IN_THE_PAST = gettext_lazy("A shift can't start in the past. Choose a later date or start time.")


def save_shift(shift: Shift, post_data) -> Shift:
    """Validate the posted form, then save the shift and its assignments in one transaction.

    Raises ShiftError with a user-facing message when either step rejects, or when the shift
    was edited by someone else since the form was opened.
    """
    form = ShiftForm(post_data, instance=shift)
    if not form.is_valid():
        field, errors = next(iter(form.errors.items()))
        raise ShiftError(errors[0], field=None if field == "__all__" else field)
    if shift.is_past:
        raise ShiftError(IN_THE_PAST, field="date" if shift.date < timezone.localdate() else "start_time")
    employee_ids = [int(value) for value in post_data.getlist("employee_ids") if value.isdigit()]

    with transaction.atomic():
        if shift.pk:
            current = Shift.objects.select_for_update().values_list("version", flat=True).get(pk=shift.pk)
            if post_data.get("version") != str(current):
                raise ShiftError(STALE_SHIFT)
            shift.version = current + 1
        saved = form.save()
        assign_employees_to_shift(saved, employee_ids)
    return saved


def upcoming_q(prefix: str = "") -> models.Q:
    """Shifts that have not started yet, as a filter over `Shift` (or over a relation, e.g. `"shift__"`).

    The queryset half of `Shift.is_past`: later days, plus today's shifts whose start time is
    still ahead.
    """
    now = timezone.localtime()
    return models.Q(**{f"{prefix}date__gt": now.date()}) | models.Q(
        **{f"{prefix}date": now.date(), f"{prefix}start_time__gt": now.time()}
    )


def release_from_future_shifts(employee_id: int) -> list[Shift]:
    """Take an employee off every shift that has not started yet, and return those shifts.

    Started shifts are history - they say who was actually there - so assignments on them
    are left exactly as they are. Used when an account stops being
    able to work a shift it is booked on: its role or its position changed, or it is being deleted.
    """
    assignments = (
        Assignment.objects.filter(upcoming_q("shift__"), employee_id=employee_id)
        .select_related("shift")
    )
    released = [assignment.shift for assignment in assignments]
    if released:
        Assignment.objects.filter(pk__in=[assignment.pk for assignment in assignments]).delete()
    return released


def delete_upcoming_shifts_of_position(position_id: int) -> list[Shift]:
    """Delete the position's shifts that have not started yet; return them, assignments prefetched.

    Called just before the position itself is deleted. Its started shifts stay as history,
    still named after it (`Shift.position_name`); the upcoming ones can no longer be staffed.
    """
    upcoming = list(Shift.objects.filter(upcoming_q(), position_id=position_id).prefetch_related("assignments"))
    Shift.objects.filter(pk__in=[shift.pk for shift in upcoming]).delete()
    return upcoming


def publish_shift(shift: Shift) -> None:
    shift.status = ShiftStatus.PUBLISHED
    shift.save(update_fields=["status"])


def publish_shifts_in_period(*, start: date, end: date) -> list[Shift]:
    """Publish the period's draft shifts that have not started; returns them, assignments prefetched.

    A started shift is history, draft or not: it is never announced after the fact.
    """
    drafts = list(
        Shift.objects.filter(upcoming_q(), status=ShiftStatus.DRAFT, date__gte=start, date__lte=end)
        .prefetch_related("assignments")
    )
    Shift.objects.filter(pk__in=[shift.pk for shift in drafts]).update(status=ShiftStatus.PUBLISHED)
    for shift in drafts:
        shift.status = ShiftStatus.PUBLISHED
    return drafts


def shifts_for_manager(
    *,
    start: date | None = None,
    end: date | None = None,
    position_id: int | None = None,
    status: str | None = None,
    understaffed_only: bool = False,
):
    """The schedule, filtered. It is one schedule shared by every manager, whoever wrote each shift."""
    qs = Shift.objects.all()
    if start:
        qs = qs.filter(date__gte=start)
    if end:
        qs = qs.filter(date__lte=end)
    if position_id:
        qs = qs.filter(position_id=position_id)
    if status in (ShiftStatus.DRAFT, ShiftStatus.PUBLISHED):
        qs = qs.filter(status=status)
    if understaffed_only:
        qs = qs.annotate(assigned_total=models.Count("assignments")).filter(assigned_total__lt=models.F("capacity"))
    return qs


def shifts_for_employee(*, employee_id: int, start: date, end: date):
    return Shift.objects.filter(
        assignments__employee_id=employee_id,
        date__gte=start,
        date__lte=end,
        status=ShiftStatus.PUBLISHED,
    )


def _hours(shift: Shift) -> float:
    return shift.duration.total_seconds() / 3600


def shift_rows(*, query: str = "", worker_id: int | None = None, **filters) -> list[dict]:
    """The schedule's shifts with their workers, as plain dicts, for search and analytics.

    `filters` are those of `shifts_for_manager`. `query` matches the position or an
    assigned worker's name, case-insensitively.
    """
    shifts = shifts_for_manager(**filters).prefetch_related(
        models.Prefetch("assignments", queryset=Assignment.objects.select_related("employee"))
    )
    if worker_id:
        shifts = shifts.filter(assignments__employee_id=worker_id)

    rows = []
    for shift in shifts:
        workers = [{"id": a.employee_id, "name": a.employee.display_name} for a in shift.assignments.all()]
        if query.lower() not in " ".join([shift.position_name, *(w["name"] for w in workers)]).lower():
            continue
        rows.append(
            {
                "id": shift.id,
                **shift_fields(shift),
                "status": shift.status,
                "capacity": shift.capacity,
                "hours": _hours(shift),
                "workers": workers,
            }
        )
    return rows


CZ_MAX_WEEKLY_HOURS = 48


def shift_analytics(rows: list[dict], *, start: date, end: date, worker_id: int | None = None) -> dict:
    """KPIs and chart series over `shift_rows()` output.

    Shift counts describe whole shifts. Hours and workers count only the filtered
    worker, so a colleague on the same shift does not add to their numbers.
    """
    by_date: Counter[str] = Counter()
    by_position: Counter[str] = Counter()
    hours: Counter[int] = Counter()
    shift_count: Counter[int] = Counter()
    names: dict[int, str] = {}
    open_shifts = 0

    for row in rows:
        by_date[row["date"]] += 1
        by_position[row["position"]] += 1
        open_shifts += len(row["workers"]) < row["capacity"]
        for worker in row["workers"]:
            if worker_id and worker["id"] != worker_id:
                continue
            hours[worker["id"]] += row["hours"]
            shift_count[worker["id"]] += 1
            names[worker["id"]] = worker["name"]

    ranked = sorted(hours, key=lambda wid: (hours[wid], shift_count[wid]), reverse=True)
    return {
        "kpis": {
            "shifts": len(rows),
            "hours": round(sum(hours.values()), 1),
            "workers": len(hours),
            "open_shifts": open_shifts,
        },
        "by_date": [{"date": day, "count": count} for day, count in sorted(by_date.items())],
        "by_position": [{"position": name, "count": count} for name, count in sorted(by_position.items())],
        "max_hours": round(CZ_MAX_WEEKLY_HOURS * ((end - start).days + 1) / 7, 1),
        "top_workers": [
            {"worker": names[wid], "hours": round(hours[wid], 1), "shifts": shift_count[wid]} for wid in ranked[:10]
        ],
    }
