from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scheduling', '0003_remove_shift_updated_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='shift',
            name='version',
            field=models.PositiveIntegerField(default=1),
        ),
    ]
