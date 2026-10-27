"""Isolated TOTP enrollment: no changes to existing account login."""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations,models
class Migration(migrations.Migration):
    dependencies=[("providers","0002_integration_draft_vault"),migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations=[migrations.CreateModel(name="ProviderVaultAuthenticator",fields=[
        ("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),
        ("encrypted_secret",models.TextField()),
        ("verified",models.BooleanField(default=False)),
        ("last_counter",models.BigIntegerField(default=-1)),
        ("pending_until",models.DateTimeField(null=True,blank=True)),
        ("user",models.OneToOneField(to=settings.AUTH_USER_MODEL,on_delete=django.db.models.deletion.PROTECT,related_name="provider_vault_authenticator")),
    ])]
