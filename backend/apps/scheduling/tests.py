from __future__ import annotations

from datetime import date, time
from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.accounts.models import User, UserRole

from .models import Assignment, EmployeeUnavailability, Position, Shift
from .services import assign_employees_to_shift


class HardConstraintTests(TestCase):
    """Covers the four scheduling rules enforced in services.assign_employees_to_shift."""

    @classmethod
    def setUpTestData(cls) -> None:
        cls.barista = Position.objects.create(name="Barista")
        cls.chef = Position.objects.create(name="Head Chef")

        cls.manager = User.objects.create_user(
            username="manager@example.com", password="x", role=UserRole.MANAGER
        )
        cls.alice = User.objects.create_user(
            username="alice@example.com", password="x", role=UserRole.EMPLOYEE, position=cls.barista
        )
        cls.bob = User.objects.create_user(
            username="bob@example.com", password="x", role=UserRole.EMPLOYEE, position=cls.barista
        )
        cls.carol = User.objects.create_user(
            username="carol@example.com", password="x", role=UserRole.EMPLOYEE, position=cls.chef
        )
        cls.day = date(2030, 6, 3)

    def _shift(self, *, start=time(9, 0), end=time(17, 0), capacity=2, position=None) -> Shift:
        return Shift.objects.create(
            date=self.day,
            start_time=start,
            end_time=end,
            capacity=capacity,
            position=position or self.barista,
            created_by=self.manager,
        )

    def test_valid_assignment_is_persisted(self):
        shift = self._shift()
        assign_employees_to_shift(shift, [self.alice.id, self.bob.id])
        self.assertEqual(Assignment.objects.filter(shift=shift).count(), 2)

    def test_position_mismatch_is_rejected(self):
        shift = self._shift()
        with self.assertRaises(ValidationError):
            assign_employees_to_shift(shift, [self.carol.id])
        self.assertFalse(Assignment.objects.filter(shift=shift).exists())

    def test_capacity_overflow_is_rejected(self):
        shift = self._shift(capacity=1)
        with self.assertRaises(ValidationError):
            assign_employees_to_shift(shift, [self.alice.id, self.bob.id])
        self.assertFalse(Assignment.objects.filter(shift=shift).exists())

    def test_unavailable_employee_is_rejected(self):
        EmployeeUnavailability.objects.create(employee=self.alice, date=self.day)
        shift = self._shift()
        with self.assertRaises(ValidationError):
            assign_employees_to_shift(shift, [self.alice.id])

    def test_overlapping_shifts_are_rejected(self):
        morning = self._shift(start=time(9, 0), end=time(13, 0))
        assign_employees_to_shift(morning, [self.alice.id])

        overlapping = self._shift(start=time(12, 0), end=time(18, 0))
        with self.assertRaises(ValidationError):
            assign_employees_to_shift(overlapping, [self.alice.id])

    def test_back_to_back_shifts_are_allowed(self):
        morning = self._shift(start=time(9, 0), end=time(13, 0))
        assign_employees_to_shift(morning, [self.alice.id])

        afternoon = self._shift(start=time(13, 0), end=time(18, 0))
        assign_employees_to_shift(afternoon, [self.alice.id])
        self.assertEqual(Assignment.objects.filter(employee=self.alice).count(), 2)

    def test_duplicate_ids_are_deduplicated_before_capacity_check(self):
        shift = self._shift(capacity=1)
        assign_employees_to_shift(shift, [self.alice.id, self.alice.id])
        self.assertEqual(Assignment.objects.filter(shift=shift).count(), 1)
