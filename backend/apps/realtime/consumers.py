from __future__ import annotations

import asyncio
import secrets

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.urls import path


from .events import MANAGERS_GROUP, user_group


class ScheduleConsumer(AsyncJsonWebsocketConsumer):
    """One socket per open page: the user's own notifications, plus schedule changes and presence for managers.

    The socket is also what makes its user "online" for their friends (`apps.profiles.presence`).
    """

    subscriptions = ()

    async def connect(self) -> None:
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close()
            return
        self.subscriptions = [user_group(user.id)] + ([MANAGERS_GROUP] if user.is_manager else [])
        for group in self.subscriptions:
            await self.channel_layer.group_add(group, self.channel_name)
        self.presence_id = secrets.token_hex(4)
        await self.accept()
        self.user_id = user.id

    async def disconnect(self, code: int) -> None:
        for group in self.subscriptions:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def schedule_event(self, message: dict) -> None:
        if message.get("sender") != self.channel_name:
            await self.send_json(message["event"])


websocket_urlpatterns = [path("ws/schedule/", ScheduleConsumer.as_asgi())]
