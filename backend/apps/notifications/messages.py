"""What each kind of notification says, written out in the reader's language when it is read.

A notification stores its `kind` and the facts behind it (`params`), not finished
sentences, so the same row reads in Czech for one person and in Arabic for another,
and follows a reader who switches language.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date

from django.utils.formats import date_format

RENDERERS: dict[str, Callable[[dict], tuple[str, str]]] = {}
MAX_LISTED_SHIFTS = 3


def _renders(kind: str):
    def register(function):
        RENDERERS[kind] = function
        return function

    return register


def render(kind: str, params: dict) -> tuple[str, str]:
    """(title, description) in the active language."""
    return RENDERERS[kind](params)


def shift_params(shift) -> dict:
    """The facts a notification keeps about a shift; they outlive the shift itself."""
    return {
        "position": shift.position.name,
        "date": shift.date.isoformat(),
        "start": f"{shift.start_time:%H:%M}",
        "end": f"{shift.end_time:%H:%M}",
    }


def _day(iso: str) -> str:
    """"Mon 14 Sep", with the weekday and month names of the active language."""
    return date_format(date.fromisoformat(iso), "D j M")


def shift_label(params: dict) -> str:
    return "%(position)s, %(day)s, %(start)s–%(end)s" % {**params, "day": _day(params["date"])}


def _role(params: dict) -> str:
    from apps.accounts.models import UserRole

    return str(UserRole(params["role"]).label)


@_renders("account.added")
def _account_added(p):
    return "%(role)s added" % {"role": _role(p)}, p["name"]


@_renders("account.updated")
def _account_updated(p):
    return "%(role)s updated" % {"role": _role(p)}, p["name"]


@_renders("account.deleted")
def _account_deleted(p):
    return "%(role)s deleted" % {"role": _role(p)}, p["name"]


@_renders("account.role_changed")
def _role_changed(p):
    return "Your role was changed", "%(by)s made you %(role)s." % {"by": p["by"], "role": _role(p)}


@_renders("account.details_updated")
def _details_updated(p):
    return "Your details were updated", "%(by)s changed your account." % p


@_renders("account.password_reset")
def _password_reset(p):
    return "Your password was reset", "%(by)s set a new password for your account." % p


@_renders("shift.published")
def _shifts_published(p):
    shifts = p["shifts"]
    count = len(shifts)
    if count == 1:
        title = "New shift published"
    else:
        title = ("%(count)d new shift published" if count == 1 else "%(count)d new shifts published") % {"count": count}
    description = "; ".join(shift_label(shift) for shift in shifts[:MAX_LISTED_SHIFTS])
    extra = count - MAX_LISTED_SHIFTS
    if extra > 0:
        description += "; " + ("and %(count)d more" if extra == 1 else "and %(count)d more") % {"count": extra}
    return title, description


@_renders("shift.assigned")
def _shift_assigned(p):
    return "New shift assigned", shift_label(p["shift"])


@_renders("shift.removed")
def _shift_removed(p):
    return "Removed from a shift", shift_label(p["shift"])


@_renders("shift.changed")
def _shift_changed(p):
    return "Shift changed", "%(before)s is now %(after)s" % {
        "before": shift_label(p["before"]),
        "after": shift_label(p["after"]),
    }


@_renders("shift.cancelled")
def _shift_cancelled(p):
    return "Shift cancelled", shift_label(p["shift"])


@_renders("position.created")
def _position_created(p):
    return "Position created", p["name"]


@_renders("position.deleted")
def _position_deleted(p):
    return "Position deleted", p["name"]


@_renders("availability.changed")
def _availability_changed(p):
    values = {"name": p["name"], "day": _day(p["date"])}
    if p["unavailable"]:
        return "Availability updated", "%(name)s is unavailable on %(day)s." % values
    return "Availability updated", "%(name)s is available again on %(day)s." % values
