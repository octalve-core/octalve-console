"""No-op additive checkpoint.

Operator policies are defined in source and initialized on first authorized
mutation. This leaves existing SettingGroup creation contracts untouched and
prevents data migrations from overwriting existing operators' settings.
"""
from django.db import migrations
class Migration(migrations.Migration):
    dependencies=[("settings_registry","0001_initial")]
    operations=[migrations.RunPython(migrations.RunPython.noop,migrations.RunPython.noop)]
