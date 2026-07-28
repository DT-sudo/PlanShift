from __future__ import annotations

import secrets

from django.contrib.auth.models import AbstractUser
from django.db import models

def generate_employee_id() -> str:
    return f"EMP-{secrets.randbelow(900000) + 100000}"

class UserRole(models.TextChoices):
    MANAGER = "manager", "Manager"
    EMPLOYEE = "employee", "Employee"

class User(AbstractUser):
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.EMPLOYEE)
    employee_id = models.CharField(max_length=20, unique=True, default=generate_employee_id, editable=False)
    @property
    def display_name(self) -> str:
        return self.get_full_name() or self.username
    @property
    def role_label(self) -> str:
        """The line under a name: an employee's position, otherwise the role."""
        return self.position.name if self.is_employee and self.position else str(self.get_role_display())
    @property
    def is_manager(self) -> bool:
        return self.role == UserRole.MANAGER
    @property
    def is_employee(self) -> bool:
        return self.role == UserRole.EMPLOYEE
