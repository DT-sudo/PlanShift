from __future__ import annotations

from django.conf import settings
from django.db import models



class Notification(models.Model):
    """One message to one user about something another user did."""

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    level = models.CharField(max_length=10, default="info")
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["recipient", "read_at"])]

    def text(self) -> tuple[str, str]:
        """Title and description in the active language."""
        return self.title, self.description

    def as_dict(self) -> dict:
        """The shape the header bell renders."""
        title, description = self.text()
        return {
            "id": self.id,
            "level": self.level,
            "title": title,
            "description": description,
            "time": self.created_at.isoformat(),
            "read": self.read_at is not None,
        }
