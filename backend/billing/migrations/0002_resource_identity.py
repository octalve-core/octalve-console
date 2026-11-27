import uuid
from django.db import migrations, models
from octalve_backend import resource_identity


def populate(apps, schema_editor):
    Model = apps.get_model("billing", "Invoice")
    for pk in Model.objects.using(schema_editor.connection.alias).values_list("pk", flat=True).iterator(chunk_size=500):
        Model.objects.using(schema_editor.connection.alias).filter(pk=pk).update(public_id=uuid.uuid4(), public_reference=resource_identity.reference_inv())
    Model = apps.get_model("billing", "Quote")
    for pk in Model.objects.using(schema_editor.connection.alias).values_list("pk", flat=True).iterator(chunk_size=500):
        Model.objects.using(schema_editor.connection.alias).filter(pk=pk).update(public_id=uuid.uuid4(), public_reference=resource_identity.reference_qte())


class Migration(migrations.Migration):
    dependencies = [("billing", "0001_initial")]
    operations = [
        migrations.AddField(model_name="invoice", name="public_id", field=models.UUIDField(null=True, editable=False)),
        migrations.AddField(model_name="invoice", name="public_reference", field=models.CharField(max_length=24, null=True, editable=False)),
        migrations.AddField(model_name="quote", name="public_id", field=models.UUIDField(null=True, editable=False)),
        migrations.AddField(model_name="quote", name="public_reference", field=models.CharField(max_length=24, null=True, editable=False)),
        migrations.RunPython(populate, migrations.RunPython.noop),
        migrations.AlterField(model_name="invoice", name="public_id", field=models.UUIDField(default=uuid.uuid4, unique=True, editable=False)),
        migrations.AlterField(model_name="invoice", name="public_reference", field=models.CharField(max_length=24, default=resource_identity.reference_inv, unique=True, editable=False)),
        migrations.AlterField(model_name="quote", name="public_id", field=models.UUIDField(default=uuid.uuid4, unique=True, editable=False)),
        migrations.AlterField(model_name="quote", name="public_reference", field=models.CharField(max_length=24, default=resource_identity.reference_qte, unique=True, editable=False)),
    ]
