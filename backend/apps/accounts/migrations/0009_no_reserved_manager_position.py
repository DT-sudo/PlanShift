from django.db import migrations


def drop_unused_manager_position(apps, schema_editor):
    """The "Manager" position was a promotion trigger, not a job title; the role field is now the
    only way to make someone a manager. Dropped unless it is already used as a real position."""
    Position = apps.get_model("accounts", "Position")
    position = Position.objects.filter(name="Manager").first()
    if position and not position.employees.exists() and not position.shifts.exists():
        position.delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0008_guest_role_and_password_change"), ("scheduling", "0006_shift_position_name")]

    operations = [migrations.RunPython(drop_unused_manager_position, migrations.RunPython.noop)]
