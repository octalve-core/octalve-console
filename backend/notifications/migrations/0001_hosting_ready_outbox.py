# Generated for the separately gated, durable hosting-ready mail outbox.
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [("services", "0001_initial")]
    operations = [
        migrations.CreateModel(
            name="HostingNotice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_key", models.CharField(max_length=120, unique=True)),
                ("destination_email", models.EmailField(max_length=254)),
                ("subject", models.CharField(max_length=250)),
                ("text_body", models.TextField()),
                ("status", models.CharField(max_length=24, default="queued",
                  choices=[("queued","Queued"),("sent","Sent"),("failed","Failed")])),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("sent_at", models.DateTimeField(null=True, blank=True)),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                    related_name="hosting_notices", to="services.service")),
            ],
            options={"indexes": [models.Index(fields=["status","created_at"],
                name="hosting_notice_outbox_ix")]},
        ),
    ]
