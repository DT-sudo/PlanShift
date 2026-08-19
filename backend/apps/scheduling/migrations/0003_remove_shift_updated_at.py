from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('scheduling', '0002_position_name_length'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='shift',
            name='updated_at',
        ),
    ]
