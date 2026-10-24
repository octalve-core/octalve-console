from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_staffprofile_notes"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuthThrottleBucket",
            fields=[
                ("fingerprint", models.CharField(editable=False, max_length=64, primary_key=True, serialize=False)),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "authentication throttle bucket",
                "verbose_name_plural": "authentication throttle buckets",
            },
        ),
    ]
