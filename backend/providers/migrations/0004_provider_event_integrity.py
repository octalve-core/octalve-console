"""Append-only supplier lifecycle receipts, PostgreSQL immutability at DB boundary."""
import django.utils.timezone
from django.db import migrations,models

def lock_events(apps,schema_editor):
    if schema_editor.connection.vendor!="postgresql": return
    schema_editor.execute("""
       CREATE FUNCTION providers_block_event_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN RAISE EXCEPTION 'Supplier audit events are immutable'; END; $$;
    """)
    schema_editor.execute("""
       CREATE TRIGGER providers_event_append_only
       BEFORE UPDATE OR DELETE ON providers_integrationconnectionevent
       FOR EACH ROW EXECUTE FUNCTION providers_block_event_rewrite();
    """)

def unlock_events(apps,schema_editor):
    if schema_editor.connection.vendor!="postgresql": return
    schema_editor.execute("DROP TRIGGER IF EXISTS providers_event_append_only ON providers_integrationconnectionevent;")
    schema_editor.execute("DROP FUNCTION IF EXISTS providers_block_event_rewrite();")

class Migration(migrations.Migration):
    dependencies=[("providers","0003_provider_vault_authenticator")]
    operations=[
        migrations.AddField("integrationconnection","audit_sequence",models.PositiveIntegerField(default=0)),
        migrations.AddField("integrationconnection","audit_head",models.CharField(max_length=64,default="",blank=True)),
        migrations.AddField("integrationconnectionevent","sequence",models.PositiveIntegerField(default=0)),
        migrations.AddField("integrationconnectionevent","previous_mac",models.CharField(max_length=64,default="",blank=True)),
        migrations.AddField("integrationconnectionevent","event_mac",models.CharField(max_length=64,default="",blank=True)),
        migrations.AlterField("integrationconnectionevent","created_at",models.DateTimeField(default=django.utils.timezone.now)),
        migrations.RunPython(lock_events,unlock_events),
    ]
