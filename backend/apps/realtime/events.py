"""Push schedule changes to the pages that are open right now."""

from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)

MANAGERS_GROUP = "managers"


def _send(group: str, event: dict[str, Any]) -> None:
    try:
        async_to_sync(get_channel_layer().group_send)(group, {"type": "schedule.event", "event": event})
    except Exception:
        logger.exception("Could not broadcast %s", event.get("type"))


def user_group(user_id: int) -> str:
    """The pages one user has open, for events addressed to them alone."""
    return f"user_{user_id}"
