# services/apps.py

from django.apps import AppConfig

class ServicesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'services'
    verbose_name = 'Service Management'

    # Hosting and other commercial services are created exclusively by
    # verified fulfillment workers, never by a generic invoice-save signal.


