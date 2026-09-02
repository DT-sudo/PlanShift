"""Profiles, account settings, profile pictures and friends (the "Major: Standard user management" module)."""

from __future__ import annotations
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET

from apps.accounts.models import User
from apps.shell import render_app

from . import services


def _visible_person_or_404(request: HttpRequest, user_id: int) -> User:
    person = get_object_or_404(User.objects.select_related("position"), pk=user_id, is_active=True)
    if not services.can_view(request.user, person):
        raise Http404
    return person


@login_required
@require_GET
def profile(request: HttpRequest, user_id: int) -> HttpResponse:
    person = _visible_person_or_404(request, user_id)
    relation = services.relation(request.user, person)
    close = relation["state"] in ("self", "friends")
    friends = services.friends_of(person)

    return render_app(
        request,
        page="profile",
        title=person.display_name,
        data={
            "person": {
                **services.card(person),
                "bio": person.bio,
                "memberSince": person.date_joined.date().isoformat(),
                "email": person.email if close or request.user.manages(person) else None,
                "status": presence.status(person) if close else None,
                "friendCount": len(friends),
            },
            "relation": relation,
            "friends": [services.card(friend) for friend in friends] if close else None,
            "urls": services.friend_urls(),
        },
    )


@login_required
@require_GET
def friends(request: HttpRequest) -> HttpResponse:
    """Everyone the user has a friendship with, sorted by its state: friends, requests to answer, requests sent."""
    user = request.user
    lists = {"friends": [], "incoming": [], "outgoing": []}
    rows = services.involving(user).select_related("from_user__position", "to_user__position").order_by("-created_at")
    for friendship in rows:
        other = friendship.other(user)
        if not other.is_active:
            continue
        relation = services.friendship_relation(friendship, user)
        extra = {"status": presence.status(other)} if friendship.accepted else {"sentAt": friendship.created_at.isoformat()}
        lists[relation["state"]].append({**services.card(other), "relation": relation, **extra})
    lists["friends"].sort(key=lambda friend: (not friend["status"]["online"], friend["fullName"].lower()))

    return render_app(
        request,
        page="friends",
        title="Friends",
        nav_active="friends",
        data={**lists, "urls": services.friend_urls()},
    )
