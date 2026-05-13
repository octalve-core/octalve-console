# reports/models.py

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator

# ============================================
# REPORT DEFINITION MODEL
# ============================================

class ReportDefinition(models.Model):
    """Predefined report templates"""
    
    REPORT_TYPES = [
        ('sales', 'Sales Report'),
        ('revenue', 'Revenue Report'),
        ('invoices', 'Invoices Report'),
        ('payments', 'Payments Report'),
        ('services', 'Services Report'),
        ('domains', 'Domains Report'),
        ('tickets', 'Tickets Report'),
        ('customers', 'Customers Report'),
        ('usage', 'Usage Report'),
        ('tax', 'Tax Report'),
        ('affiliate', 'Affiliate Report'),
        ('financial', 'Financial Summary'),
    ]
    
    FORMAT_CHOICES = [
        ('csv', 'CSV'),
        ('excel', 'Excel'),
        ('pdf', 'PDF'),
        ('json', 'JSON'),
    ]
    
    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('yearly', 'Yearly'),
        ('never', 'Never'),
    ]
    
    # Basic info
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    
    # Configuration
    config = models.JSONField(default=dict, help_text="Report-specific configuration")
    columns = models.JSONField(default=list, help_text="Columns to include")
    filters = models.JSONField(default=dict, blank=True, help_text="Default filters")
    
    # Scheduling
    auto_generate = models.BooleanField(default=False)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='never')
    last_generated_at = models.DateTimeField(blank=True, null=True)
    next_generation_at = models.DateTimeField(blank=True, null=True)
    
    # Notifications
    notification_emails = models.JSONField(default=list, blank=True, help_text="List of emails to send reports to")
    
    # Format
    default_format = models.CharField(max_length=10, choices=FORMAT_CHOICES, default='excel')
    
    # Status
    is_active = models.BooleanField(default=True)
    is_public = models.BooleanField(default=False, help_text="Available to staff")
    
    # Metadata
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['report_type', 'name']
        indexes = [
            models.Index(fields=['report_type']),
            models.Index(fields=['is_active']),
            models.Index(fields=['next_generation_at']),
        ]
    
    def __str__(self):
        return self.name
    
    def schedule_next_run(self):
        """Calculate next run time based on frequency"""
        from datetime import timedelta
        
        now = timezone.now()
        
        if self.frequency == 'daily':
            self.next_generation_at = now + timedelta(days=1)
        elif self.frequency == 'weekly':
            self.next_generation_at = now + timedelta(weeks=1)
        elif self.frequency == 'monthly':
            self.next_generation_at = now + timedelta(days=30)
        elif self.frequency == 'quarterly':
            self.next_generation_at = now + timedelta(days=90)
        elif self.frequency == 'yearly':
            self.next_generation_at = now + timedelta(days=365)
        
        self.save()


# ============================================
# REPORT INSTANCE MODEL
# ============================================

class ReportInstance(models.Model):
    """Generated report instances"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    # Relations
    definition = models.ForeignKey(ReportDefinition, on_delete=models.CASCADE, related_name='instances')
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Details
    title = models.CharField(max_length=500)
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    filters_used = models.JSONField(default=dict, blank=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    
    # File info
    file_format = models.CharField(max_length=10)
    file_url = models.URLField(blank=True, null=True)
    file_size = models.IntegerField(default=0, help_text="File size in bytes")
    
    # Stats
    row_count = models.IntegerField(default=0)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['definition', '-generated_at']),
            models.Index(fields=['status']),
            models.Index(fields=['generated_by']),
            models.Index(fields=['period_start', 'period_end']),
        ]
    
    def mark_completed(self, file_url, file_size, row_count):
        """Mark report as completed"""
        self.status = 'completed'
        self.file_url = file_url
        self.file_size = file_size
        self.row_count = row_count
        self.completed_at = timezone.now()
        self.save()
    
    def mark_failed(self, error):
        """Mark report as failed"""
        self.status = 'failed'
        self.error_message = error
        self.completed_at = timezone.now()
        self.save()
    
    def __str__(self):
        return f"{self.definition.name} - {self.generated_at}"


# ============================================
# DASHBOARD WIDGET MODEL
# ============================================

class DashboardWidget(models.Model):
    """Dashboard widgets for metrics display"""
    
    WIDGET_TYPES = [
        ('counter', 'Counter'),
        ('chart', 'Chart'),
        ('table', 'Table'),
        ('list', 'List'),
        ('progress', 'Progress'),
        ('metric', 'Metric'),
    ]
    
    CHART_TYPES = [
        ('line', 'Line Chart'),
        ('bar', 'Bar Chart'),
        ('pie', 'Pie Chart'),
        ('area', 'Area Chart'),
        ('radar', 'Radar Chart'),
        ('gauge', 'Gauge'),
    ]
    
    # Basic info
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    widget_type = models.CharField(max_length=20, choices=WIDGET_TYPES, default='counter')
    chart_type = models.CharField(max_length=20, choices=CHART_TYPES, blank=True, null=True)
    
    # Data source
    data_source = models.CharField(max_length=100, help_text="Model or API endpoint")
    data_config = models.JSONField(default=dict, help_text="Filters, aggregation, etc.")
    
    # Display
    size = models.CharField(max_length=20, default='medium', choices=[
        ('small', 'Small (1 column)'),
        ('medium', 'Medium (2 columns)'),
        ('large', 'Large (3 columns)'),
        ('full', 'Full Width'),
    ])
    
    # Color scheme
    color = models.CharField(max_length=50, blank=True, null=True)
    icon = models.CharField(max_length=50, blank=True, null=True)
    
    # Refresh
    refresh_interval = models.IntegerField(default=300, help_text="Refresh interval in seconds")
    
    # Visibility
    visible_to_roles = models.JSONField(default=list, blank=True, help_text="Roles that can see this widget")
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order']
        indexes = [
            models.Index(fields=['widget_type']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return self.title


# ============================================
# SAVED REPORT FILTER MODEL
# ============================================

class SavedReportFilter(models.Model):
    """User-saved report filters for quick access"""
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_report_filters')
    name = models.CharField(max_length=200)
    report_type = models.CharField(max_length=50)
    filters = models.JSONField(default=dict)
    is_default = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['user', 'name', 'report_type']
        ordering = ['name']
    
    def __str__(self):
        return f"{self.user.email} - {self.name}"


# ============================================
# METRIC MODEL
# ============================================

class Metric(models.Model):
    """Tracked business metrics"""
    
    METRIC_TYPES = [
        ('counter', 'Counter (total count)'),
        ('gauge', 'Gauge (current value)'),
        ('rate', 'Rate (per time period)'),
        ('ratio', 'Ratio (percentage)'),
        ('currency', 'Currency (monetary value)'),
    ]
    
    # Basic info
    key = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    metric_type = models.CharField(max_length=20, choices=METRIC_TYPES)
    
    # Calculation
    calculation = models.TextField(help_text="SQL or Python expression")
    calculation_type = models.CharField(max_length=20, default='sql')
    
    # Current value
    current_value = models.FloatField(null=True, blank=True)
    previous_value = models.FloatField(null=True, blank=True)
    change_percent = models.FloatField(null=True, blank=True)
    
    # Trend
    trend = models.CharField(max_length=20, blank=True, null=True, choices=[
        ('up', 'Upward'),
        ('down', 'Downward'),
        ('stable', 'Stable'),
    ])
    
    # Last update
    last_updated = models.DateTimeField(blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['key']),
            models.Index(fields=['metric_type']),
        ]
    
    def update_value(self, value):
        """Update metric value and calculate change"""
        self.previous_value = self.current_value
        self.current_value = float(value)
        
        if self.previous_value and self.previous_value != 0:
            self.change_percent = ((self.current_value - self.previous_value) / self.previous_value) * 100
        
        self.last_updated = timezone.now()
        
        if self.change_percent:
            if self.change_percent > 5:
                self.trend = 'up'
            elif self.change_percent < -5:
                self.trend = 'down'
            else:
                self.trend = 'stable'
        
        self.save()
    
    def __str__(self):
        return f"{self.name}: {self.current_value}"


# ============================================
# METRIC HISTORY MODEL
# ============================================

class MetricHistory(models.Model):
    """Historical values for metrics"""
    
    metric = models.ForeignKey(Metric, on_delete=models.CASCADE, related_name='history')
    value = models.FloatField()
    recorded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['metric', '-recorded_at']),
        ]
    
    def __str__(self):
        return f"{self.metric.key} - {self.value} at {self.recorded_at}"

