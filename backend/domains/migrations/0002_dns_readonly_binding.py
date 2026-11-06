"""DNS-01: authorization records only; no existing Domain or DNSRecord is promoted."""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ("domains", "0001_initial"),
        ("providers", "0004_provider_event_integrity"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name="DomainDNSBinding",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("zone_id", models.CharField(max_length=32, unique=True)),
                ("zone_name", models.CharField(max_length=255)),
                ("credential_version", models.PositiveIntegerField()),
                ("state", models.CharField(max_length=12, default="pending",
                    choices=[("pending", "Awaiting customer approval"), ("active", "Read-only access approved"), ("revoked", "Access revoked")])),
                ("customer_authorization_reference", models.CharField(max_length=160)),
                ("consent_version", models.CharField(max_length=20, default="dns-read-v1")),
                ("consented_at", models.DateTimeField(blank=True, null=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("domain", models.OneToOneField(to="domains.domain", related_name="dns_binding",
                    on_delete=django.db.models.deletion.PROTECT)),
                ("connection", models.ForeignKey(to="providers.integrationconnection",
                    related_name="approved_domain_dns_bindings", on_delete=django.db.models.deletion.PROTECT)),
                ("requested_by", models.ForeignKey(to=settings.AUTH_USER_MODEL,
                    related_name="dns_bindings_requested", on_delete=django.db.models.deletion.PROTECT)),
                ("approved_by", models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True, blank=True,
                    related_name="dns_bindings_approved", on_delete=django.db.models.deletion.PROTECT)),
            ],
        ),
        migrations.AddIndex(
            model_name="domaindnsbinding",
            index=models.Index(fields=["state", "connection"], name="domain_dns_state_conn_idx"),
        ),
    ]
