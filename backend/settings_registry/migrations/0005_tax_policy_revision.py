"""SET-03: additive revision table for settings-only tax policy, no rate activation."""
from django.db import migrations,models
import django.db.models.deletion
from django.conf import settings
class Migration(migrations.Migration):
 dependencies=[("settings_registry","0004_seed_mail_templates")]
 operations=[
    migrations.CreateModel(name="TaxPolicyRevision",fields=[
        ("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),
        ("revision",models.PositiveIntegerField()),
        ("snapshot",models.JSONField(default=dict)),
        ("created_at",models.DateTimeField(auto_now_add=True)),
        ("policy",models.ForeignKey(to="settings_registry.taxsettings",on_delete=django.db.models.deletion.PROTECT,related_name="policy_revisions")),
        ("actor",models.ForeignKey(to=settings.AUTH_USER_MODEL,on_delete=django.db.models.deletion.SET_NULL,null=True,blank=True)),
    ]),
    migrations.AddConstraint(model_name="taxpolicyrevision",constraint=models.UniqueConstraint(
        fields=["policy","revision"],name="console_tax_policy_revision_uniq")),
 ]
