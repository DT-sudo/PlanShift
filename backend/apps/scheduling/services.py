"""Scheduling rules and writes. Views parse requests and render; the rules live here."""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.utils.formats import date_format

from apps.accounts.models import User, UserRole
from .models import Assignment, EmployeeUnavailability, Shift


def _check_position_match(shift: Shift, employee_ids: list[int]) -> None:
    valid = User.objects.filter(
        id__in=employee_ids,
        role=UserRole.EMPLOYEE,
        is_active=True,
        position_id=shift.position_id,
    ).count()
    if valid != len(employee_ids):
        raise ValidationError("Selected employees must match the shift position.")


def _check_capacity(shift: Shift, employee_ids: list[int]) -> None:
    if len(employee_ids) > shift.capacity:
        raise ValidationError("Cannot assign more employees than shift capacity.")


def _check_availability(shift: Shift, employee_ids: list[int]) -> None:
    if EmployeeUnavailability.objects.filter(employee_id__in=employee_ids, date=shift.date).exists():
        raise ValidationError("Employee is unavailable on %(day)s." % {"day": date_format(shift.date, "D j M Y")})


def _check_no_overlap(shift: Shift, employee_ids: list[int]) -> None:
    conflict = (
        Assignment.objects.filter(
            employee_id__in=employee_ids,
            shift__date=shift.date,
            shift__start_time__lt=shift.end_time,
            shift__end_time__gt=shift.start_time,
        )
        .exclude(shift_id=shift.id)
        .select_related("shift__position")
        .order_by("shift__start_time")
        .first()
    )
    if conflict:
        other = conflict.shift
        raise ValidationError(
            "Employee already assigned to: %(position)s %(start)s–%(end)s (%(day)s)"
            % {
                "position": other.position.name,
                "start": f"{other.start_time:%H:%M}",
                "end": f"{other.end_time:%H:%M}",
                "day": date_format(other.date, "j M"),
            }
        )
