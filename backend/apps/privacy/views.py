"""Self-service GDPR endpoints (the "Minor: GDPR compliance features" module).

Every signed-in user - manager or employee - can reach these from the
account menu: see what personal data is held about them, download it in a
readable format, and delete their own account. See also
`apps.legal.documents` for the Privacy Policy text this implements, and
`apps.accounts.views` for the manager-initiated equivalent (deleting an
employee's account, which already existed before this module).
"""

from __future__ import annotations

import json
from django.contrib.auth.decorators import login_required
from django.core.serializers.json import DjangoJSONEncoder
from django.http import HttpRequest, HttpResponse
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET

from apps.scheduling.models import Assignment, EmployeeUnavailability, Shift
from apps.scheduling.services import shift_fields
from apps.shell import render_app



def _collect_user_data(user) -> dict:
    """Every piece of personal data this instance holds about `user` -
    matches what Privacy Policy section 1 ("Data we collect") describes."""
    data = {
        "exported_at": timezone.now().isoformat(),
        "account": {
            "employee_id": user.employee_id,
            "full_name": user.get_full_name(),
            "email": user.email,
            "role": user.get_role_display(),
            "position": user.position.name if user.position else None,
            "date_joined": user.date_joined.isoformat(),
            "last_login": user.last_login.isoformat() if user.last_login else None,
        },
    }

    if user.is_employee:
        assignments = (
            Assignment.objects.filter(employee=user)
            .select_related("shift", "shift__position")
            .order_by("shift__date", "shift__start_time")
        )
        data["assigned_shifts"] = [{**shift_fields(a.shift), "status": a.shift.status} for a in assignments]
        data["unavailability"] = [
            date.isoformat()
            for date in EmployeeUnavailability.objects.filter(employee=user).order_by("date").values_list(
                "date", flat=True
            )
        ]
    else:
        created = Shift.objects.filter(created_by=user).select_related("position").order_by("date", "start_time")
        data["shifts_created"] = [
            {**shift_fields(shift), "status": shift.status, "capacity": shift.capacity} for shift in created
        ]

    return data


@login_required
@require_GET
def privacy_center(request: HttpRequest) -> HttpResponse:
    return render_app(
        request,
        page="privacy-center",
        title="Privacy & My Data",
        data={
            "email": request.user.email,
            "isManager": request.user.is_manager,
            "urls": {
                "exportData": reverse("privacy_export_data"),
            },
        },
    )


@login_required
@require_GET
def export_my_data(request: HttpRequest) -> HttpResponse:
    """A readable (indented) JSON download of everything held about the caller."""
    user = request.user
    payload = json.dumps(_collect_user_data(user), indent=2, cls=DjangoJSONEncoder, ensure_ascii=False)

    response = HttpResponse(payload, content_type="application/json")
    filename = f"planshift-my-data-{timezone.localdate().isoformat()}.json"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
