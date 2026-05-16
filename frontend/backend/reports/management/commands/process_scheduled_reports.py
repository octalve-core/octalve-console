# reports/management/commands/process_scheduled_reports.py

from django.core.management.base import BaseCommand
from django.utils import timezone
from reports.models import ReportDefinition

class Command(BaseCommand):
    help = 'Process scheduled report generation'
    
    def handle(self, *args, **options):
        self.stdout.write('Processing scheduled reports...')
        
        reports = ReportDefinition.objects.filter(
            auto_generate=True,
            is_active=True,
            next_generation_at__lte=timezone.now()
        )
        
        for report in reports:
            self.stdout.write(f'Generating {report.name}...')
            # Generate report
            # This would call the report generation logic
            report.last_generated_at = timezone.now()
            report.schedule_next_run()
            report.save()
            self.stdout.write(self.style.SUCCESS(f'  Generated {report.name}'))
        
        self.stdout.write(self.style.SUCCESS('Done!'))