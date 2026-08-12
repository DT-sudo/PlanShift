from django import forms

from .models import Position, Shift


class PositionForm(forms.ModelForm):
    class Meta:
        model = Position
        fields = ["name"]
        error_messages = {
            "name": {
                "required": "Enter a position name.",
                "unique": "A position with this name already exists.",
            }
        }


class ShiftForm(forms.ModelForm):
    """Shift fields only; assignments are validated separately by the scheduling rules."""

    class Meta:
        model = Shift
        fields = ["date", "start_time", "end_time", "position", "capacity"]
