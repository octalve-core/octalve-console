# support/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import (
    SupportDepartment, SupportTicket, TicketMessage,
    PredefinedResponse, TicketEscalationRule, TicketAttachment, TicketSurvey
)
from .serializers import (
    SupportDepartmentSerializer, SupportTicketSerializer, CreateTicketSerializer,
    ReplyTicketSerializer, TicketActionSerializer, PredefinedResponseSerializer,
    TicketEscalationRuleSerializer, TicketSurveySerializer, TicketStatsSerializer
)
from notifications.utils import send_notification
from rbac.decorators import permission_required


class SupportDepartmentViewSet(viewsets.ModelViewSet):
    """ViewSet for support departments"""
    
    queryset = SupportDepartment.objects.filter(is_active=True)
    serializer_class = SupportDepartmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'description']
    ordering = ['sort_order', 'name']
    
    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'staff']:
            return SupportDepartment.objects.all()
        return SupportDepartment.objects.filter(is_active=True)
    
    @permission_required('manage_support')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @permission_required('manage_support')
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)


class SupportTicketViewSet(viewsets.ModelViewSet):
    """ViewSet for support tickets"""
    
    serializer_class = SupportTicketSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'department']
    search_fields = ['ticket_number', 'subject', 'client__email', 'client__full_name']
    ordering_fields = ['created_at', 'last_reply_at', 'priority']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return SupportTicket.objects.all()
        if user.role == 'staff':
            return SupportTicket.objects.filter(Q(assigned_to=user) | Q(department__assigned_staff=user))
        return SupportTicket.objects.filter(client=user)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create a new support ticket"""
        serializer = CreateTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        department = get_object_or_404(SupportDepartment, id=serializer.validated_data['department_id'])
        
        # Create ticket
        ticket = SupportTicket.objects.create(
            client=request.user,
            department=department,
            subject=serializer.validated_data['subject'],
            priority=serializer.validated_data['priority'],
            service_id=serializer.validated_data.get('service_id'),
            order_id=serializer.validated_data.get('order_id'),
            invoice_id=serializer.validated_data.get('invoice_id'),
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500]
        )
        
        # Create first message
        message = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_role='client' if request.user.role == 'client' else 'staff',
            sender_name=request.user.full_name,
            message=serializer.validated_data['message']
        )
        
        # Handle attachments
        attachments = request.FILES.getlist('attachments')
        for attachment in attachments:
            TicketAttachment.objects.create(
                ticket=ticket,
                message=message,
                file=attachment,
                filename=attachment.name,
                file_size=attachment.size,
                mime_type=attachment.content_type,
                uploaded_by=request.user
            )
        
        # Send notifications to staff
        if department.notify_new_ticket:
            for staff in department.assigned_staff.all():
                send_notification(
                    user=staff,
                    template_key='new_ticket_staff',
                    context={
                        'ticket_number': ticket.ticket_number,
                        'client_name': request.user.full_name,
                        'subject': ticket.subject,
                        'priority': ticket.priority
                    }
                )
        
        return Response(SupportTicketSerializer(ticket, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reply(self, request, pk=None):
        """Reply to a ticket"""
        ticket = self.get_object()
        serializer = ReplyTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Determine sender role
        if request.user.role in ['admin', 'staff']:
            sender_role = 'admin' if request.user.role == 'admin' else 'staff'
            # Update status if waiting for customer
            if ticket.status == 'waiting_customer':
                ticket.status = 'in_progress'
                ticket.save()
        else:
            sender_role = 'client'
            # Update status if waiting for staff
            if ticket.status == 'waiting_staff':
                ticket.status = 'open'
                ticket.save()
        
        # Create message
        message = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_role=sender_role,
            sender_name=request.user.full_name,
            message=serializer.validated_data['message'],
            is_internal=serializer.validated_data.get('is_internal', False)
        )
        
        # Update ticket
        ticket.last_reply_at = timezone.now()
        ticket.last_reply_by = request.user
        ticket.save()
        
        # Handle attachments
        attachments = request.FILES.getlist('attachments')
        for attachment in attachments:
            TicketAttachment.objects.create(
                ticket=ticket,
                message=message,
                file=attachment,
                filename=attachment.name,
                file_size=attachment.size,
                mime_type=attachment.content_type,
                uploaded_by=request.user
            )
        
        # Send notifications
        if not message.is_internal:
            if sender_role == 'client':
                # Notify assigned staff
                if ticket.assigned_to and ticket.department.notify_new_reply:
                    send_notification(
                        user=ticket.assigned_to,
                        template_key='new_ticket_reply',
                        context={
                            'ticket_number': ticket.ticket_number,
                            'client_name': request.user.full_name,
                            'message_preview': message.message[:100]
                        }
                    )
                # Notify department staff
                elif ticket.department.notify_new_reply:
                    for staff in ticket.department.assigned_staff.all():
                        send_notification(
                            user=staff,
                            template_key='new_ticket_reply',
                            context={
                                'ticket_number': ticket.ticket_number,
                                'client_name': request.user.full_name,
                                'message_preview': message.message[:100]
                            }
                        )
            else:
                # Notify client
                send_notification(
                    user=ticket.client,
                    template_key='new_ticket_reply_client',
                    context={
                        'ticket_number': ticket.ticket_number,
                        'staff_name': request.user.full_name,
                        'message_preview': message.message[:100]
                    }
                )
        
        return Response({'message': 'Reply added successfully'})
    
    @action(detail=True, methods=['post'])
    def action(self, request, pk=None):
        """Perform action on ticket (close, resolve, assign, etc.)"""
        ticket = self.get_object()
        serializer = TicketActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        action = serializer.validated_data['action']
        
        if action == 'close':
            ticket.close()
            message = "Ticket closed"
            
        elif action == 'resolve':
            ticket.resolve()
            message = "Ticket resolved"
            
        elif action == 'reopen':
            ticket.reopen()
            message = "Ticket reopened"
            
        elif action == 'assign':
            staff_id = serializer.validated_data.get('staff_id')
            if staff_id:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                staff = get_object_or_404(User, id=staff_id, role__in=['admin', 'staff'])
                ticket.assign(staff)
                message = f"Ticket assigned to {staff.full_name}"
            else:
                return Response({'error': 'staff_id required for assign action'}, status=status.HTTP_400_BAD_REQUEST)
            
        elif action == 'change_priority':
            priority = serializer.validated_data.get('priority')
            if priority:
                ticket.update_priority(priority)
                message = f"Priority changed to {priority}"
            else:
                return Response({'error': 'priority required'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Add internal note
        reason = serializer.validated_data.get('reason', '')
        if reason:
            TicketMessage.objects.create(
                ticket=ticket,
                sender=request.user,
                sender_role='admin' if request.user.role == 'admin' else 'staff',
                sender_name=request.user.full_name,
                message=f"Action: {action}. Reason: {reason}",
                is_internal=True
            )
        
        return Response({'message': message})
    
    # @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark all messages as read"""
        ticket = self.get_object()
        ticket.mark_as_read(request.user)
        return Response({'message': 'Marked as read'})
    
    # @action(detail=True, methods=['post'])
    def submit_survey(self, request, pk=None):
        """Submit satisfaction survey for resolved ticket"""
        ticket = self.get_object()
        
        if ticket.status != 'resolved':
            return Response({'error': 'Survey only available for resolved tickets'}, status=status.HTTP_400_BAD_REQUEST)
        
        if hasattr(ticket, 'survey'):
            return Response({'error': 'Survey already submitted'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = TicketSurveySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        TicketSurvey.objects.create(
            ticket=ticket,
            client=request.user,
            **serializer.validated_data
        )
        
        ticket.satisfaction_rating = serializer.validated_data['rating']
        ticket.save()
        
        return Response({'message': 'Thank you for your feedback!'})
    
    # @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get ticket statistics"""
        user = request.user
        queryset = self.get_queryset()
        
        stats = {
            'open': queryset.filter(status='open').count(),
            'in_progress': queryset.filter(status='in_progress').count(),
            'waiting_customer': queryset.filter(status='waiting_customer').count(),
            'waiting_staff': queryset.filter(status='waiting_staff').count(),
            'resolved': queryset.filter(status='resolved').count(),
            'closed': queryset.filter(status='closed').count(),
            'total': queryset.count(),
            'overdue': sum(1 for t in queryset if t.is_overdue()),
            'by_priority': {},
            'by_department': {}
        }
        
        # By priority
        for priority in ['low', 'medium', 'high', 'urgent']:
            stats['by_priority'][priority] = queryset.filter(priority=priority).count()
        
        # By department
        dept_stats = queryset.values('department__name').annotate(count=Count('id'))
        for item in dept_stats:
            stats['by_department'][item['department__name']] = item['count']
        
        return Response(stats)
    
    # @action(detail=False, methods=['get'])
    def my_tickets(self, request):
        """Get current user's tickets (alias for client view)"""
        tickets = SupportTicket.objects.filter(client=request.user)
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)


class PredefinedResponseViewSet(viewsets.ModelViewSet):
    """ViewSet for predefined responses"""
    
    serializer_class = PredefinedResponseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['department', 'category', 'is_active']
    search_fields = ['title', 'content', 'shortcut']
    
    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'staff']:
            return PredefinedResponse.objects.all()
        return PredefinedResponse.objects.filter(is_active=True, is_public=True)
    
    @permission_required('manage_support')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def use(self, request, pk=None):
        """Mark a predefined response as used"""
        response = self.get_object()
        response.increment_usage()
        return Response({'content': response.content})


class TicketEscalationRuleViewSet(viewsets.ModelViewSet):
    """ViewSet for ticket escalation rules (admin only)"""
    
    queryset = TicketEscalationRule.objects.all()
    serializer_class = TicketEscalationRuleSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return TicketEscalationRule.objects.all()
        return TicketEscalationRule.objects.none()
    
    @permission_required('manage_support')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

