# provisioning/management/commands/process_provisioning.py

from django.core.management.base import BaseCommand
from django.utils import timezone
from provisioning.models import ProvisioningTask
from provisioning.views import ProvisioningTaskViewSet
import time


class Command(BaseCommand):
    help = 'Process pending provisioning tasks'
    
    def add_arguments(self, parser):
        parser.add_argument('--worker-id', type=str, default='cron')
        parser.add_argument('--max-tasks', type=int, default=10)
        parser.add_argument('--loop', action='store_true', help='Run continuously')
        parser.add_argument('--delay', type=int, default=5, help='Delay between loops in seconds')
    
    def handle(self, *args, **options):
        worker_id = options['worker_id']
        max_tasks = options['max_tasks']
        loop = options['loop']
        delay = options['delay']
        
        self.stdout.write(f'Starting provisioning worker: {worker_id}')
        
        viewset = ProvisioningTaskViewSet()
        
        while True:
            tasks_processed = 0
            
            # Get pending tasks
            tasks = ProvisioningTask.objects.filter(
                status__in=['queued', 'retrying'],
                scheduled_at__lte=timezone.now()
            ).order_by('priority', 'scheduled_at')[:max_tasks]
            
            if tasks:
                self.stdout.write(f'Found {tasks.count()} pending tasks')
                
                for task in tasks:
                    self.stdout.write(f'Processing task {task.id}: {task.action}')
                    result = viewset._process_task(task, worker_id)
                    
                    if result.get('success'):
                        self.stdout.write(self.style.SUCCESS(f'  Task {task.id} completed'))
                    else:
                        self.stdout.write(self.style.ERROR(f'  Task {task.id} failed: {result.get("error")}'))
                    
                    tasks_processed += 1
            
            if not loop:
                break
            
            if tasks_processed == 0:
                time.sleep(delay)
        
        self.stdout.write(self.style.SUCCESS('Worker stopped'))

