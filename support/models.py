# support/models.py

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid

# ============================================
# SUPPORT DEPARTMENT MODEL
# ============================================

class SupportDepartment(models.Model):
    """Support departments for ticket routing"""
    
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True, null=True)
    email = models.EmailField(blank=True, null=True, help_text="Department email for incoming tickets")
    
    # Assignment
    assigned_staff = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='assigned_departments', limit_choices_to={'role__in': ['admin', 'staff']})
    
    # Settings
    auto_assign = models.BooleanField(default=True, help_text="Auto-assign tickets to staff")
    auto_close_days = models.IntegerField(default=7, help_text="Auto-close tickets after X days of inactivity")
    
    # Notifications
    notify_new_ticket = models.BooleanField(default=True, help_text="Notify assigned staff on new ticket")
    notify_new_reply = models.BooleanField(default=True, help_text="Notify client on new reply")
    
    # Status
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['is_active']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.name


# ============================================
# SUPPORT TICKET MODEL
# ============================================

class SupportTicket(models.Model):
    """Customer support tickets"""
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('waiting_customer', 'Waiting for Customer'),
        ('waiting_staff', 'Waiting for Staff'),
        ('on_hold', 'On Hold'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
        ('trash', 'Trash'),
    ]
    
    # Basic info
    ticket_number = models.CharField(max_length=20, unique=True, editable=False)
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='support_tickets')
    department = models.ForeignKey(SupportDepartment, on_delete=models.PROTECT, related_name='tickets')
    
    # Ticket details
    subject = models.CharField(max_length=500)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    
    # Assignment
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets', limit_choices_to={'role__in': ['admin', 'staff']})
    
    # Related entities
    service = models.ForeignKey('services.Service', on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    invoice = models.ForeignKey('billing.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    
    # Tracking
    last_reply_at = models.DateTimeField(auto_now_add=True)
    last_reply_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='last_replied_tickets')
    closed_at = models.DateTimeField(blank=True, null=True)
    resolved_at = models.DateTimeField(blank=True, null=True)
    
    # Feedback
    satisfaction_rating = models.IntegerField(blank=True, null=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    satisfaction_comment = models.TextField(blank=True, null=True)
    
    # Metadata
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ticket_number']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['assigned_to', 'status']),
            models.Index(fields=['priority', 'status']),
            models.Index(fields=['-created_at']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = self.generate_ticket_number()
        super().save(*args, **kwargs)
    
    def generate_ticket_number(self):
        """Generate unique ticket number: TKT-2024-00001"""
        prefix = f"TKT-{timezone.now().strftime('%Y')}-"
        last_ticket = SupportTicket.objects.filter(ticket_number__startswith=prefix).order_by('-ticket_number').first()
        if last_ticket:
            last_num = int(last_ticket.ticket_number.split('-')[-1])
            new_num = last_num + 1
        else:
            new_num = 1
        return f"{prefix}{new_num:05d}"
    
    def get_last_message(self):
        """Get the last message in the ticket"""
        return self.messages.order_by('-created_at').first()
    
    def has_unread_messages(self, user):
        """Check if there are unread messages for user"""
        unread = self.messages.filter(is_read=False)
        if user.role in ['admin', 'staff']:
            return unread.filter(sender_role='client').exists()
        return unread.filter(sender_role__in=['admin', 'staff']).exists()
    
    def mark_as_read(self, user):
        """Mark all messages as read for user"""
        if user.role in ['admin', 'staff']:
            self.messages.filter(sender_role='client', is_read=False).update(is_read=True)
        else:
            self.messages.filter(sender_role__in=['admin', 'staff'], is_read=False).update(is_read=True)
    
    def close(self):
        """Close the ticket"""
        self.status = 'closed'
        self.closed_at = timezone.now()
        self.save()
    
    def resolve(self):
        """Resolve the ticket"""
        self.status = 'resolved'
        self.resolved_at = timezone.now()
        self.save()
    
    def reopen(self):
        """Reopen a closed/resolved ticket"""
        self.status = 'open'
        self.closed_at = None
        self.resolved_at = None
        self.save()
    
    def assign(self, staff_user):
        """Assign ticket to staff member"""
        self.assigned_to = staff_user
        self.save()
    
    def update_priority(self, priority):
        """Update ticket priority"""
        self.priority = priority
        self.save()
    
    def is_overdue(self):
        """Check if ticket is overdue (no reply in 48 hours for high priority)"""
        if self.status in ['closed', 'resolved']:
            return False
        
        hours_threshold = 24 if self.priority == 'high' else 48 if self.priority == 'medium' else 72
        time_since_last_reply = timezone.now() - self.last_reply_at
        
        return time_since_last_reply.total_seconds() > hours_threshold * 3600
    
    def __str__(self):
        return f"{self.ticket_number} - {self.subject[:50]}"


# ============================================
# SUPPORT TICKET MESSAGE MODEL
# ============================================

class TicketMessage(models.Model):
    """Messages within a support ticket"""
    
    SENDER_ROLE_CHOICES = [
        ('client', 'Client'),
        ('staff', 'Staff'),
        ('admin', 'Admin'),
        ('system', 'System'),
    ]
    
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_messages')
    sender_role = models.CharField(max_length=10, choices=SENDER_ROLE_CHOICES)
    sender_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Message content
    message = models.TextField()
    is_internal = models.BooleanField(default=False, help_text="Internal note only visible to staff")
    
    # Attachments
    attachments = models.JSONField(default=list, blank=True, help_text="List of attachment URLs")
    
    # Read status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['ticket', 'created_at']),
            models.Index(fields=['sender_role', 'is_read']),
        ]
    
    def mark_as_read(self):
        """Mark message as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()
    
    def __str__(self):
        return f"{self.ticket.ticket_number} - {self.sender_role} - {self.created_at}"


# ============================================
# TICKET ATTACHMENT MODEL
# ============================================

class TicketAttachment(models.Model):
    """File attachments for ticket messages"""
    
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='attachments')
    message = models.ForeignKey(TicketMessage, on_delete=models.CASCADE, null=True, blank=True, related_name='file_attachments')
    
    file = models.FileField(upload_to='tickets/%Y/%m/%d/')
    filename = models.CharField(max_length=255)
    file_size = models.IntegerField(help_text="File size in bytes")
    mime_type = models.CharField(max_length=100)
    
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.filename


# ============================================
# PREDEFINED RESPONSE MODEL
# ============================================

class PredefinedResponse(models.Model):
    """Predefined/canned responses for staff"""
    
    department = models.ForeignKey(SupportDepartment, on_delete=models.CASCADE, null=True, blank=True, related_name='predefined_responses')
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True, null=True)
    content = models.TextField()
    
    # Shortcut/trigger
    shortcut = models.CharField(max_length=50, blank=True, null=True, help_text="Type #shortcut to insert")
    
    # Status
    is_active = models.BooleanField(default=True)
    is_public = models.BooleanField(default=False, help_text="Visible to clients in KB")
    
    # Usage tracking
    usage_count = models.IntegerField(default=0)
    
    # Metadata
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_responses')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['category', 'title']
        indexes = [
            models.Index(fields=['shortcut']),
            models.Index(fields=['department', 'is_active']),
        ]
    
    def increment_usage(self):
        """Increment usage counter"""
        self.usage_count += 1
        self.save(update_fields=['usage_count'])
    
    def __str__(self):
        return self.title


# ============================================
# TICKET ESCALATION RULE MODEL
# ============================================

class TicketEscalationRule(models.Model):
    """Rules for automatic ticket escalation"""
    
    CONDITION_CHOICES = [
        ('no_reply_time', 'No Reply Time'),
        ('priority', 'Priority'),
        ('department', 'Department'),
        ('satisfaction_rating', 'Low Satisfaction Rating'),
    ]
    
    ACTION_CHOICES = [
        ('change_priority', 'Change Priority'),
        ('assign_staff', 'Assign to Staff'),
        ('notify_staff', 'Notify Staff'),
        ('move_department', 'Move to Department'),
    ]
    
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    
    # Conditions
    condition_type = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    condition_value = models.CharField(max_length=100, help_text="e.g., 24, high, 3")
    department_filter = models.ForeignKey(SupportDepartment, on_delete=models.SET_NULL, null=True, blank=True, related_name='escalation_rules')
    
    # Action
    action_type = models.CharField(max_length=20, choices=ACTION_CHOICES)
    action_value = models.CharField(max_length=100, blank=True, null=True, help_text="e.g., urgent, staff_id, department_id")
    
    # Priority
    priority = models.IntegerField(default=1, help_text="Lower number = higher priority")
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['priority']
    
    def __str__(self):
        return self.name


# ============================================
# TICKET SURVEY MODEL
# ============================================

class TicketSurvey(models.Model):
    """Customer satisfaction survey after ticket closure"""
    
    ticket = models.OneToOneField(SupportTicket, on_delete=models.CASCADE, related_name='survey')
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ticket_surveys')
    
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True, null=True)
    
    # Response time rating
    response_time_rating = models.IntegerField(blank=True, null=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    resolution_quality_rating = models.IntegerField(blank=True, null=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    staff_courtesy_rating = models.IntegerField(blank=True, null=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    
    # Would recommend
    would_recommend = models.BooleanField(null=True, blank=True)
    
    # Meta
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-submitted_at']
    
    def __str__(self):
        return f"{self.ticket.ticket_number} - Rating: {self.rating}"

