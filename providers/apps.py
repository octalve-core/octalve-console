# providers/apps.py

from django.apps import AppConfig

class ProvidersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'providers'
    verbose_name = 'Service Providers'
    
    def ready(self):
        """Import signals when app is ready"""
        import providers.signals
