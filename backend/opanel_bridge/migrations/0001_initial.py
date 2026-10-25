from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("services", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name="VerifiedHostingBinding",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider_id_snapshot", models.IntegerField()),
                ("account_digest", models.CharField(max_length=64)),
                ("binding_ref", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("confirmation_source", models.CharField(default="provider_api_readback", max_length=40)),
                ("confirmed_at", models.DateTimeField()),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("service", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="opanel_binding", to="services.service")),
            ],
            options={"verbose_name": "OPanel verified hosting binding"},
        ),
        migrations.CreateModel(
            name="OPanelLaunchGrant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code_digest", models.CharField(max_length=64, unique=True)),
                ("code_challenge", models.CharField(max_length=128)),
                ("redirect_uri", models.URLField(max_length=500)),
                ("expires_at", models.DateTimeField()),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("binding", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="opanel_bridge.verifiedhostingbinding")),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="services.service")),
                ("subject", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(model_name="opanellaunchgrant", index=models.Index(fields=["expires_at"], name="opanel_grant_expires_idx")),
    ]
