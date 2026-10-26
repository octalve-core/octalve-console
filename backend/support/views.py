# support/views.py

from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import (
    SupportDepartment, SupportTicket, TicketMessage, SupportRoutingTag,
    PredefinedResponse, TicketEscalationRule, TicketAttachment, TicketSurvey
)
from .serializers import (
    SupportDepartmentSerializer, SupportRoutingTagSerializer, SupportTicketSerializer, CreateTicketSerializer,
    ReplyTicketSerializer, TicketActionSerializer, PredefinedResponseSerializer,
    TicketEscalationRuleSerializer, TicketSurveySerializer, TicketStatsSerializer
)
from notifications.utils import send_notification
from rbac.decorators import permission_required
from .routing import choose_staff, eligible_staff


class AdminWriteSupport(BasePermission):
    def has_permission(self, request, view):
        if request.method in ("GET","HEAD","OPTIONS"):
            return True
        user=request.user
        return bool(user.is_authenticated and (user.is_superuser or user.role=="admin"))

class SupportAgentsView(APIView):
    permission_classes=[IsAuthenticated,AdminWriteSupport]
    def get(self,request):
        if request.user.role!="admin" and not request.user.is_superuser:
            raise PermissionDenied("Only support administrators may manage assignments.")
        from django.contrib.auth import get_user_model
        users=get_user_model().objects.filter(is_active=True,role__in=["admin","staff"]).order_by("full_name","pk")
        return Response([{"id":user.pk,"full_name":user.full_name,"role":user.role} for user in users[:500]])


class SupportRoutingTagViewSet(viewsets.ModelViewSet):
    serializer_class=SupportRoutingTagSerializer
    permission_classes=[IsAuthenticated,AdminWriteSupport]
    queryset=SupportRoutingTag.objects.all()
    filter_backends=[DjangoFilterBackend,SearchFilter]
    filterset_fields=["department","is_active"]
    search_fields=["label","slug"]
    def get_queryset(self):
        qs=super().get_queryset()
        if self.request.user.role=="client":
            return qs.filter(is_active=True,department__is_active=True)
        return qs

class SupportDepartmentViewSet(viewsets.ModelViewSet):
    """ViewSet for support departments"""
    
    queryset = SupportDepartment.objects.filter(is_active=True)
    serializer_class = SupportDepartmentSerializer
    permission_classes = [IsAuthenticated,AdminWriteSupport]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'description']
    ordering = ['sort_order', 'name']
    
    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'staff']:
            return SupportDepartment.objects.all()
        return SupportDepartment.objects.filter(is_active=True)
    
    # All write verbs, including PATCH and DELETE, are guarded by AdminWriteSupport.
    # The legacy decorator is not an authority substitute for API-level role checks.


class SupportTicketViewSet(viewsets.ModelViewSet):
    """ViewSet for support tickets"""
    
    serializer_class = SupportTicketSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get','post','head','options']
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
            return SupportTicket.objects.filter(
                Q(assigned_to=user) |
                Q(assigned_to__isnull=True,department__assigned_staff=user,routing_tag__isnull=True) |
                Q(assigned_to__isnull=True,department__assigned_staff=user,routing_tag__assigned_staff=user)
            ).distinct()
        return SupportTicket.objects.filter(client=user)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if request.user.role != "client":
            raise PermissionDenied("Create a customer ticket from the customer account.")
        serializer=CreateTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data=serializer.validated_data
        department=get_object_or_404(SupportDepartment,id=data["department_id"],is_active=True)
        for field,model_name in (("service_id","services.Service"),("order_id","orders.Order"),("invoice_id","billing.Invoice")):
            pk=data.get(field)
            if pk is not None:
                from django.apps import apps
                model=apps.get_model(model_name)
                if not model.objects.filter(pk=pk,client=request.user).exists():
                    raise ValidationError({field:"This record is not in your account."})
        ticket=SupportTicket.objects.create(
            client=request.user,department=department,
            routing_tag_id=data.get("routing_tag_id"),
            subject=data["subject"],priority=data["priority"],
            service_id=data.get("service_id"),order_id=data.get("order_id"),
            invoice_id=data.get("invoice_id"),
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT","")[:500],
        )
        ticket.assigned_to=choose_staff(ticket)
        if ticket.assigned_to_id:
            ticket.save(update_fields=["assigned_to"])
        TicketMessage.objects.create(
            ticket=ticket,sender=request.user,sender_role="client",
            sender_name=request.user.full_name,message=data["message"],is_internal=False,
        )
        if department.notify_new_ticket:
            recipients=[ticket.assigned_to] if ticket.assigned_to_id else list(
                eligible_staff(ticket).filter(is_active=True)[:20])
            def notify():
                for staff in recipients:
                    try:
                        send_notification(user=staff,template_key="new_ticket_staff",
                            context={"ticket_number":ticket.ticket_number,
                                "client_name":request.user.full_name,
                                "subject":ticket.subject,"priority":ticket.priority})
                    except Exception:
                        pass
            transaction.on_commit(notify)
        return Response(SupportTicketSerializer(ticket,context=self.get_serializer_context()).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reply(self, request, pk=None):
        """Reply to a ticket"""
        ticket = self.get_object()
        serializer = ReplyTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        if request.FILES or request.data.get("attachments"):
            raise ValidationError({"attachments":"Attachments require approved private storage."})
        if request.user.role=="client" and serializer.validated_data.get("is_internal"):
            raise PermissionDenied("Only support staff can write internal notes.")
        if ticket.status in ("closed","trash"):
            raise ValidationError({"detail":"This ticket is closed."})
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
        
        if not message.is_internal:
            recipient_ids=[]
            if sender_role=="client":
                if ticket.assigned_to_id:
                    recipient_ids=[ticket.assigned_to_id]
                else:
                    recipient_ids=list(eligible_staff(ticket).values_list("pk",flat=True)[:20])
            else:
                recipient_ids=[ticket.client_id]
            def notify_recipients():
                from django.contrib.auth import get_user_model
                recipients=get_user_model().objects.filter(pk__in=recipient_ids,is_active=True)
                for recipient in recipients:
                    try:
                        send_notification(user=recipient,template_key="new_ticket_reply_client" if sender_role!="client" else "new_ticket_reply",
                            context={"ticket_number":ticket.ticket_number,
                                     "message_preview":message.message[:100],
                                     "client_name":ticket.client.full_name,
                                     "staff_name":request.user.full_name})
                    except Exception:
                        pass
            transaction.on_commit(notify_recipients)
        return Response({'message': 'Reply added successfully'})
    
    @action(detail=True, methods=['post'])
    def action(self, request, pk=None):
        """Perform action on ticket (close, resolve, assign, etc.)"""
        ticket = self.get_object()
        serializer = TicketActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        action = serializer.validated_data['action']
        if request.user.role=="client":
            if action not in ("close","reopen") or ticket.client_id!=request.user.pk:
                raise PermissionDenied("Only support managers can assign or prioritize tickets.")
        elif request.user.role=="staff" and action in ("assign","change_priority"):
            raise PermissionDenied("Only administrators can reassign or reprioritize tickets.")
        
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
                staff = get_object_or_404(User, id=staff_id, role__in=['admin', 'staff'], is_active=True)
                if not eligible_staff(ticket).filter(pk=staff.pk).exists():
                    raise ValidationError({'staff_id':'Select an eligible department specialist.'})
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
    permission_classes = [IsAuthenticated,AdminWriteSupport]
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

