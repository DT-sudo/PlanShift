"""Scheduling rules and writes. Views parse requests and render; the rules live here."""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.utils.formats import date_format

from apps.accounts.models import User, UserRole
from .models import EmployeeUnavailability, Shift


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
