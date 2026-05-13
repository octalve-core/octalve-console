# settings_registry/management/commands/load_default_settings.py

from django.core.management.base import BaseCommand
from settings_registry.models import SettingGroup, Setting, EmailTemplate
from django.conf import settings

class Command(BaseCommand):
    help = 'Load default settings and email templates'
    
    def handle(self, *args, **options):
        self.stdout.write('Loading default settings...')
        
        # Create setting groups
        groups_data = [
            {'key': 'general', 'name': 'General', 'sort_order': 1},
            {'key': 'security', 'name': 'Security', 'sort_order': 2},
            {'key': 'mail', 'name': 'Mail', 'sort_order': 3},
            {'key': 'invoices', 'name': 'Invoices', 'sort_order': 4},
            {'key': 'tax', 'name': 'Tax', 'sort_order': 5},
            {'key': 'tickets', 'name': 'Tickets', 'sort_order': 6},
            {'key': 'providers', 'name': 'Providers', 'sort_order': 7},
            {'key': 'notifications', 'name': 'Notifications', 'sort_order': 8},
        ]
        
        for group_data in groups_data:
            group, created = SettingGroup.objects.get_or_create(key=group_data['key'], defaults=group_data)
            if created:
                self.stdout.write(f'  Created group: {group.name}')
        
        # Create default settings
        general_group = SettingGroup.objects.get(key='general')
        defaults = [
            {'group': general_group, 'key': 'site_name', 'name': 'Site Name', 'data_type': 'string', 'default_value': 'Octalve', 'is_public': True},
            {'group': general_group, 'key': 'site_description', 'name': 'Site Description', 'data_type': 'text', 'default_value': 'Hosting & Cloud Platform', 'is_public': True},
            {'group': general_group, 'key': 'timezone', 'name': 'Timezone', 'data_type': 'string', 'default_value': 'Africa/Lagos'},
            {'group': general_group, 'key': 'currency', 'name': 'Currency', 'data_type': 'string', 'default_value': 'NGN'},
        ]
        
        for default in defaults:
            setting, created = Setting.objects.get_or_create(key=default['key'], defaults=default)
            if created:
                self.stdout.write(f'  Created setting: {setting.key}')
        
        self.stdout.write(self.style.SUCCESS('Default settings loaded successfully!'))

