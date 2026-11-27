import uuid
from django.db import migrations, models
from octalve_backend import resource_identity


def populate(apps, schema_editor):
    Model = apps.get_model("accounts", "CustomUser")
    for pk in Model.objects.using(schema_editor.connection.alias).values_list("pk", flat=True).iterator(chunk_size=500):
        Model.objects.using(schema_editor.connection.alias).filter(pk=pk).update(public_id=uuid.uuid4(), public_reference=resource_identity.reference_acc())


def install_legacy_writer_defaults(apps, schema_editor):
    # During rolling deployment, the previous app revision can still INSERT.
    # PostgreSQL defaults keep those rows valid without changing old code.
    if schema_editor.connection.vendor != "postgresql":
        return
    table = schema_editor.quote_name(apps.get_model("accounts", "CustomUser")._meta.db_table)
    schema_editor.execute(f"ALTER TABLE {table} ALTER COLUMN public_id SET DEFAULT gen_random_uuid()")
    schema_editor.execute(f"""ALTER TABLE {table} ALTER COLUMN public_reference SET DEFAULT ('OC-ACC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,4)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,4)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,4)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,4)))""")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0005_privileged_passkey_enrollment")]
    operations = [
        migrations.AddField(model_name="customuser", name="public_id", field=models.UUIDField(null=True, editable=False)),
        migrations.AddField(model_name="customuser", name="public_reference", field=models.CharField(max_length=28, null=True, editable=False)),
        migrations.RunPython(populate, migrations.RunPython.noop),
        migrations.AlterField(model_name="customuser", name="public_id", field=models.UUIDField(default=uuid.uuid4, unique=True, editable=False)),
        migrations.AlterField(model_name="customuser", name="public_reference", field=models.CharField(max_length=28, default=resource_identity.reference_acc, unique=True, editable=False)),
        migrations.RunPython(install_legacy_writer_defaults, migrations.RunPython.noop),
    ]
