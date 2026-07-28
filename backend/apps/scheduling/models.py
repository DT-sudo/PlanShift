from __future__ import annotations

from django.conf import settings
from django.db import models

class Position(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self) -> str:
        return self.name

class ShiftStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"

class Shift(models.Model):
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    position = models.ForeignKey(
        Position, 
        on_delete=models.PROTECT,
        related_name="shifts"
    )
    capacity = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=20, 
        choices=ShiftStatus.choices, 
        default=ShiftStatus.DRAFT
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_shifts",
    )

    class Meta:
        ordering = ["date", "start_time"]

class Assignment(models.Model):

    shift = models.ForeignKey(
        Shift, 
        on_delete=models.CASCADE,
        related_name="assignments"
    )
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name="assignments"
    )
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["shift", "employee"], 
                name="unique_employee_per_shift"
            ),
        ]

class EmployeeUnavailability(models.Model):
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="unavailability",
    )
    date = models.DateField(db_index=True)

    class Meta:
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "date"], 
                name="unique_employee_unavailability_day"
            ),
        ]
