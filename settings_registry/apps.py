# settings_registry/apps.py

from django.apps import AppConfig

class SettingsRegistryConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'settings_registry'
    verbose_name = 'System Settings'
