from django import forms

from .models import MIDNIGHT, Shift


class EndTimeField(forms.TimeField):
    """A time of day, or "24:00" for a shift that runs to midnight (stored as 00:00)."""

    def to_python(self, value):
        if isinstance(value, str) and value.strip() == "24:00":
            return MIDNIGHT
        return super().to_python(value)


class ShiftForm(forms.ModelForm):
    """Shift fields only; assignments are validated separately by the scheduling rules."""

    end_time = EndTimeField()

    class Meta:
        model = Shift
        fields = ["date", "start_time", "end_time", "position", "capacity"]
