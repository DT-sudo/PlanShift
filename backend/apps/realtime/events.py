"""Push schedule changes to the pages that are open right now."""

from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

logger = logging.getLogger(__name__)

MANAGERS_GROUP = "managers"

EVERYONE_GROUP = "everyone"

DIRECTORY_CHANGED = {"type": "directory.changed"}

SHIFTS_CHANGED = {"type": "shifts.changed"}

REGISTRATION_APPROVED = {"type": "registration.approved"}

SESSION_ENDED = {"type": "session.ended"}


def _send(group: str, event: dict[str, Any]) -> None:
    try:
        async_to_sync(get_channel_layer().group_send)(group, {"type": "schedule.event", "event": event})
    except Exception:
        logger.exception("Could not broadcast %s", event.get("type"))


def user_group(user_id: int) -> str:
    """The pages one user has open, for events addressed to them alone."""
    return f"user_{user_id}"


def session_group(session_key: str) -> str:
    """The pages one browser session has open - its tabs, and only its tabs."""
    return f"session_{session_key}"


def notify_managers(event: dict[str, Any]) -> None:
    """Send `event` to every connected manager once the current transaction commits."""
    transaction.on_commit(lambda: _send(MANAGERS_GROUP, event))


def notify_everyone(event: dict[str, Any]) -> None:
    """Send `event` to every open page once the current transaction commits."""
    transaction.on_commit(lambda: _send(EVERYONE_GROUP, event))


def send_to_session(session_key: str, event: dict[str, Any]) -> None:
    """Send `event` to every tab of one browser session, right away."""
    _send(session_group(session_key), event)


def send_to_user(user_id: int, event: dict[str, Any]) -> None:
    """Send `event` to every page `user_id` has open, right away."""
    _send(user_group(user_id), event)


def push_to_user(user_id: int, event: dict[str, Any]) -> None:
    """Send `event` to every page `user_id` has open once the current transaction commits."""
    transaction.on_commit(lambda: send_to_user(user_id, event))
