"""B1 draft-only encrypted connection storage. No existing Provider rows are modified."""
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ("providers", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name="IntegrationConnection",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, serialize=False, editable=False)),
                ("adapter_key", models.CharField(max_length=40)),
                ("label", models.CharField(max_length=120)),
                ("environment", models.CharField(max_length=8, choices=[("test","Test"),("live","Live")])),
                ("public_settings", models.JSONField(default=dict)),
                ("state", models.CharField(max_length=12, choices=[("draft","Draft"),("revoked","Revoked")], default="draft")),
                ("current_version", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="integration_connections_created")),
            ],
            options={"ordering":["-created_at"]},
        ),
        migrations.CreateModel(
            name="IntegrationCredentialVersion",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
                ("version", models.PositiveIntegerField()),
                ("ciphertext", models.TextField()),
                ("key_id", models.CharField(max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("connection", models.ForeignKey(to="providers.integrationconnection", on_delete=django.db.models.deletion.PROTECT, related_name="credential_versions")),
            ],
        ),
        migrations.CreateModel(
            name="IntegrationConnectionEvent",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False, auto_created=True, verbose_name="ID")),
                ("action", models.CharField(max_length=32)),
                ("version", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True, on_delete=django.db.models.deletion.SET_NULL)),
                ("connection", models.ForeignKey(to="providers.integrationconnection", on_delete=django.db.models.deletion.PROTECT, related_name="security_events")),
            ],
            options={"ordering":["-created_at"]},
        ),
        migrations.AddIndex("integrationconnection", models.Index(fields=["adapter_key","state"], name="integration_adapter_state_idx")),
        migrations.AddIndex("integrationconnectionevent", models.Index(fields=["connection","-created_at"], name="integration_event_recent_idx")),
        migrations.AddConstraint("integrationcredentialversion", models.UniqueConstraint(fields=["connection","version"], name="uniq_integration_credential_version")),
    ]
