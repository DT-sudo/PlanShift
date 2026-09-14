from __future__ import annotations

from django.db import transaction

from apps.notifications.services import managers, notify
from apps.scheduling.services import shift_fields

from .models import Position, User


def position_options() -> list[dict]:
    """Every position as `{id, name}`, for the React selects."""
    return [{"id": p.id, "name": p.name} for p in Position.objects.order_by("name")]


def delete_position(position: Position, *, actor: User) -> None:
    """Delete a position with its upcoming shifts, and tell everyone concerned.

    Its started shifts stay on the schedule under its name. The employees who held it are
    left without a position until they are given another one.
    """
    holders = list(position.employees.values_list("pk", flat=True))
    with transaction.atomic():
        cancelled = delete_upcoming_shifts_of_position(position.pk)
        position.delete()

    notices.cancelled(actor, cancelled)
    notify(holders, "account.position_removed", actor=actor, level="warning", position=position.name)
    notify(managers(), "position.deleted", actor=actor, level="warning", name=position.name)
    if cancelled:
        notify(
            managers(),
            "position.shifts_cancelled",
            actor=actor,
            level="warning",
            name=position.name,
            shifts=[shift_fields(shift) for shift in cancelled],
        )
