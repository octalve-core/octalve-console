# services/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import (
    Service, ServiceCredential, ServiceUsage, 
    ServiceActionLog, ServiceSuspension, ServiceChangeRequest
)
from .serializers import (
    ServiceSerializer, ServiceCredentialSerializer, ServiceUsageSerializer,
    ServiceActionLogSerializer, ServiceActionSerializer, 
    ServiceChangePackageSerializer, ServiceChangeRequestSerializer
)
from catalog.models import Plan, PlanBillingCycle
from billing.models import Invoice, InvoiceItem
from rbac.decorators import permission_required


class CloudServiceWritePermission(BasePermission):
    """Creating and editing commercial service state is admin-only."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    (request.user.is_superuser or request.user.role == 'admin'))


class ServiceViewSet(viewsets.ModelViewSet):
    """ViewSet for services"""
    
    serializer_class = ServiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'service_type', 'auto_renew']
    search_fields = ['label', 'domain_name', 'client__email', 'client__full_name']
    ordering_fields = ['created_at', 'next_due_date', 'amount']
    ordering = ['-created_at']
    
    def get_permissions(self):
        if self.action in {'create', 'update', 'partial_update', 'destroy'}:
            return [CloudServiceWritePermission()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Service.objects.all()
        if user.role == 'staff':
            return Service.objects.all()
        return Service.objects.filter(client=user)
    
    @action(detail=True, methods=['get'])
    def credentials(self, request, pk=None):
        """Get service credentials"""
        service = self.get_object()
        
        # Check permission - only client and admins can see credentials
        if request.user.role not in ['admin', 'staff'] and service.client != request.user:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            credentials = service.credentials
            serializer = ServiceCredentialSerializer(credentials)
            return Response(serializer.data)
        except ServiceCredential.DoesNotExist:
            return Response({'message': 'No credentials available'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'])
    def update_credentials(self, request, pk=None):
        """Update service credentials (admin only)"""
        service = self.get_object()
        
        if request.user.role not in ['admin', 'staff']:
            return Response({'error': 'Only staff can update credentials'}, status=status.HTTP_403_FORBIDDEN)
        
        credentials, created = ServiceCredential.objects.get_or_create(service=service)
        serializer = ServiceCredentialSerializer(credentials, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def usage(self, request, pk=None):
        """Get service usage history"""
        service = self.get_object()
        usage = service.usage_history.all()[:30]
        serializer = ServiceUsageSerializer(usage, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def actions(self, request, pk=None):
        """Get service action logs"""
        service = self.get_object()
        actions = service.action_logs.all()[:50]
        serializer = ServiceActionLogSerializer(actions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def action(self, request, pk=None):
        """Perform action on service (suspend, unsuspend, terminate, etc.)"""
        service = self.get_object()
        action_serializer = ServiceActionSerializer(data=request.data)
        action_serializer.is_valid(raise_exception=True)
        
        action = action_serializer.validated_data['action']
        reason = action_serializer.validated_data.get('reason', '')
        
        # Check permissions
        if action in ['suspend', 'terminate'] and request.user.role not in ['admin', 'staff']:
            return Response({'error': 'Only staff can suspend/terminate services'}, status=status.HTTP_403_FORBIDDEN)
        
        # Log the action
        ServiceActionLog.objects.create(
            service=service,
            action=action,
            performed_by=request.user if request.user.is_authenticated else None,
            details={'reason': reason}
        )
        
        # Perform the action
        if action == 'suspend':
            service.suspend(reason=reason)
            return Response({'message': 'Service suspended'})
        
        elif action == 'unsuspend':
            service.unsuspend()
            return Response({'message': 'Service unsuspended'})
        
        elif action == 'terminate':
            service.terminate()
            return Response({'message': 'Service terminated'})
        
        elif action == 'reboot':
            # This would call provider API
            return Response({'message': 'Reboot requested'})
        
        elif action == 'start':
            return Response({'message': 'Start requested'})
        
        elif action == 'stop':
            return Response({'message': 'Stop requested'})
        
        elif action == 'change_password':
            new_password = action_serializer.validated_data.get('new_password')
            if new_password:
                # This would call provider API to change password
                return Response({'message': 'Password change requested'})
            return Response({'error': 'New password required'}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
    
    # @action(detail=True, methods=['post'])
    @transaction.atomic
    def change_package(self, request, pk=None):
        """Request package upgrade/downgrade"""
        service = self.get_object()
        serializer = ServiceChangePackageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        new_plan_id = serializer.validated_data['new_plan_id']
        
        try:
            new_plan = Plan.objects.get(id=new_plan_id, status='active')
            current_plan = Plan.objects.get(id=service.plan_id)
        except Plan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
        
        change_type = 'upgrade' if new_plan.base_price > current_plan.base_price else 'downgrade'
        
        # Calculate prorated amount
        days_remaining = max(0, (service.next_due_date - timezone.now()).days)
        cycle_days = service.get_cycle_days()
        
        if cycle_days > 0:
            current_value = (service.amount / cycle_days) * days_remaining
            new_value = (new_plan.base_price / cycle_days) * days_remaining
            
            if change_type == 'upgrade':
                prorated_amount = new_value - current_value
            else:
                prorated_amount = current_value - new_value
        else:
            prorated_amount = 0
        
        # Create change request
        change_request = ServiceChangeRequest.objects.create(
            service=service,
            change_type=change_type,
            current_plan_id=current_plan.id,
            current_price=service.amount,
            new_plan_id=new_plan.id,
            new_price=new_plan.base_price
        )
        
        # Create invoice for upgrade
        if change_type == 'upgrade' and prorated_amount > 0:
            invoice = Invoice.objects.create(
                client=service.client,
                subtotal=prorated_amount,
                total=prorated_amount,
                due_date=timezone.now() + timezone.timedelta(days=3),
                metadata={'type': 'upgrade', 'service_id': service.id, 'change_request_id': change_request.id}
            )
            
            InvoiceItem.objects.create(
                invoice=invoice,
                description=f"Prorated upgrade from {current_plan.name} to {new_plan.name}",
                product_id=new_plan.product.id,
                plan_id=new_plan.id,
                service_id=service.id,
                quantity=1,
                unit_price=prorated_amount,
                subtotal=prorated_amount,
                period_start=timezone.now(),
                period_end=service.next_due_date
            )
            
            change_request.invoice = invoice
            change_request.save()
            
            return Response({
                'message': 'Upgrade requires payment',
                'invoice_id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'amount': prorated_amount
            })
        
        # For downgrade or zero-cost upgrade, process immediately
        change_request.approve(processed_by=request.user)
        change_request.complete()
        
        return Response({'message': f'Package {change_type} completed successfully'})
    
    # @action(detail=True, methods=['post'])
    def cancel_request(self, request, pk=None):
        """Request service cancellation"""
        service = self.get_object()
        
        if service.status != 'active':
            return Response({'error': 'Only active services can be cancelled'}, status=status.HTTP_400_BAD_REQUEST)
        
        service.request_cancellation()
        
        return Response({
            'message': 'Cancellation requested. Service will be cancelled at the end of billing period.'
        })
    
    # @action(detail=True, methods=['post'])
    def cancel_immediate(self, request, pk=None):
        """Immediately cancel service (admin only)"""
        service = self.get_object()
        
        if request.user.role not in ['admin', 'staff']:
            return Response({'error': 'Only staff can immediately cancel services'}, status=status.HTTP_403_FORBIDDEN)
        
        service.cancel()
        
        return Response({'message': 'Service cancelled immediately'})


class ServiceChangeRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for service change requests"""
    
    serializer_class = ServiceChangeRequestSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'change_type']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'staff']:
            return ServiceChangeRequest.objects.all()
        return ServiceChangeRequest.objects.filter(service__client=user)

