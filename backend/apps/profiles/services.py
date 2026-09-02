"""Who can see whose profile, and the friend request flow."""

from __future__ import annotations

from django.db.models import Q
from django.urls import reverse

from apps.accounts.models import User



def between(a: User, b: User) -> Friendship | None:
    return Friendship.objects.filter(Q(from_user=a, to_user=b) | Q(from_user=b, to_user=a)).first()


def can_view(viewer: User, person: User) -> bool:
    """Yourself, the accounts you manage, and anyone you share a friendship or a pending request with."""
    return viewer.pk == person.pk or viewer.manages(person) or between(viewer, person) is not None


def friendship_relation(friendship: Friendship, viewer: User) -> dict:
    """`{"state", "friendshipId"}`: "friends", or who waits on whom ("outgoing" when `viewer` asked, else "incoming")."""
    if friendship.accepted:
        state = "friends"
    else:
        state = "outgoing" if friendship.from_user_id == viewer.pk else "incoming"
    return {"state": state, "friendshipId": friendship.id}


def relation(viewer: User, person: User) -> dict:
    """What the friend button on `person`'s profile offers `viewer`."""
    if viewer.pk == person.pk:
        return {"state": "self"}
    friendship = between(viewer, person)
    return {"state": "none"} if friendship is None else friendship_relation(friendship, viewer)


def card(user: User) -> dict:
    """Name, picture and role line: what every list of people shows."""
    return {
        "id": user.id,
        "fullName": user.display_name,
        "avatarUrl": user.avatar_url,
        "role": user.role_label,
        "profileUrl": reverse("profile", args=[user.id]),
    }
