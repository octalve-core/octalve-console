"""DNS-01C: externally owned Cloudflare DNS enrolment without registrar claims.

Additive forward migration: existing registrar-backed rows retain old semantics.
No automatic domain imports, claims or customer access are created.
"""
import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("domains", "0002_dns_readonly_binding"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="domain", name="management_kind",
            field=models.CharField(max_length=12,
                choices=[("registrar", "Registrar-backed"),
                         ("dns_only", "External DNS only")], default="registrar"),
        ),
        migrations.AlterField(
            model_name="domain", name="registration_type",
            field=models.CharField(max_length=20, default="register",
                choices=[("register", "New Registration"), ("transfer", "Transfer"),
                         ("renewal", "Renewal"), ("dns_only", "External DNS management only")]),
        ),
        migrations.AlterField(
            model_name="domain", name="status",
            field=models.CharField(max_length=30, default="pending",
                choices=[("pending", "Pending Registration"), ("active", "Active"),
                         ("expired", "Expired"), ("cancelled", "Cancelled"),
                         ("suspended", "Suspended"), ("transfer_pending", "Transfer Pending"),
                         ("transfer_complete", "Transfer Complete"),
                         ("dns_only", "External DNS only — registrar not verified")]),
        ),
        migrations.AlterField(
            model_name="domain", name="registration_date",
            field=models.DateTimeField(default=django.utils.timezone.now, null=True, blank=True),
        ),
        migrations.AlterField(
            model_name="domain", name="expiry_date",
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AlterField(
            model_name="domain", name="next_due_date",
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.CreateModel(
            name="DomainDNSClaim",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False,
                                         serialize=False)),
                ("domain_name", models.CharField(max_length=253, unique=True)),
                ("challenge_sha256", models.CharField(max_length=64)),
                ("expires_at", models.DateTimeField()),
                ("state", models.CharField(max_length=12, default="pending",
                    choices=[("pending", "Awaiting TXT proof"),
                             ("verified", "Zone control verified"),
                             ("cancelled", "Cancelled")])),
                ("verified_at", models.DateTimeField(null=True, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("client", models.ForeignKey(
                    to=settings.AUTH_USER_MODEL, on_delete=django.db.models.deletion.PROTECT,
                    related_name="domain_dns_claims")),
                ("domain", models.OneToOneField(
                    to="domains.domain", null=True, blank=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="dns_control_claim")),
                ("verified_by", models.ForeignKey(
                    to=settings.AUTH_USER_MODEL, null=True, blank=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="dns_claims_verified")),
            ],
        ),
        migrations.AddIndex(model_name="domaindnsclaim",
            index=models.Index(fields=["client", "state"], name="dns_claim_owner_state_idx")),
        migrations.AddIndex(model_name="domaindnsclaim",
            index=models.Index(fields=["expires_at"], name="dns_claim_expiry_idx")),
    ]
