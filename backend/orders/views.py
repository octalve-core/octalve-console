# orders/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.utils import timezone
from .models import Order, Coupon, CouponRedemption, Cart
from .serializers import (
    OrderSerializer, CreateOrderSerializer, CouponSerializer,
    ValidateCouponSerializer, CartSerializer
)
from rbac.decorators import permission_required
import uuid


class OrderViewSet(viewsets.ModelViewSet):
    """ViewSet for orders"""
    
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'source']
    search_fields = ['order_number', 'client__email', 'client__full_name']
    ordering_fields = ['created_at', 'total', 'order_number']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Order.objects.all()
        if user.role == 'staff':
            return Order.objects.all()
        return Order.objects.filter(client=user)
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create a new order from cart"""
        serializer = CreateOrderSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        validated_data = serializer.validated_data
        coupon = serializer.context.get('coupon')
        
        # Calculate totals
        subtotal = sum(item['unit_price'] * item['quantity'] for item in validated_data['items'])
        
        # Apply coupon
        discount_total = 0
        coupon_discount = 0
        if coupon:
            is_valid, message = coupon.is_valid(client=request.user, order_amount=subtotal)
            if is_valid:
                discount_total = coupon.calculate_discount(subtotal)
                coupon_discount = discount_total
        
        total = subtotal - discount_total
        
        # Create order
        order = Order.objects.create(
            client=request.user,
            source='web',
            status='pending_payment',
            subtotal=subtotal,
            discount_total=discount_total,
            total=total,
            coupon_code=coupon.code if coupon else None,
            coupon_discount=coupon_discount,
            notes=validated_data.get('notes', ''),
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        # Create order items
        for item_data in validated_data['items']:
            plan = item_data['plan']
            billing_cycle = item_data['billing_cycle']
            
            OrderItem.objects.create(
                order=order,
                product_id=plan.product.id,
                plan_id=plan.id,
                billing_cycle_id=billing_cycle.id,
                item_type=item_data.get('item_type', 'hosting'),
                description=item_data['description'],
                domain_name=item_data.get('domain_name', ''),
                quantity=item_data['quantity'],
                unit_price=billing_cycle.price,
                cycle_key=billing_cycle.cycle_key,
                months=billing_cycle.months,
                config=item_data.get('config', {})
            )
        
        # Record coupon redemption
        if coupon:
            CouponRedemption.objects.create(
                coupon=coupon,
                order=order,
                client=request.user,
                discount_amount=discount_total
            )
            coupon.used_count += 1
            coupon.save()
        
        # Create invoice via billing app
        from billing.models import Invoice
        invoice = Invoice.create_from_order(order)
        
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel an order"""
        order = self.get_object()
        
        if order.status not in ['pending_payment', 'draft']:
            return Response({'error': 'Order cannot be cancelled'}, status=status.HTTP_400_BAD_REQUEST)
        
        order.cancel()
        
        return Response({'message': 'Order cancelled successfully'})
    
    @action(detail=True, methods=['get'])
    def invoice(self, request, pk=None):
        """Get invoice for this order"""
        order = self.get_object()
        invoice = order.invoices.first()
        
        if not invoice:
            return Response({'error': 'No invoice found for this order'}, status=status.HTTP_404_NOT_FOUND)
        
        from billing.serializers import InvoiceSerializer
        return Response(InvoiceSerializer(invoice).data)
    
    def get_client_ip(self, request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class CouponViewSet(viewsets.ModelViewSet):
    """ViewSet for coupons (admin only)"""
    
    queryset = Coupon.objects.all()
    serializer_class = CouponSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['code', 'name']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Coupon.objects.all()
        return Coupon.objects.filter(is_active=True)
    
    @action(detail=False, methods=['post'])
    def validate(self, request):
        """Validate a coupon code"""
        serializer = ValidateCouponSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            coupon = Coupon.objects.get(
                code=serializer.validated_data['code'].upper(),
                is_active=True
            )
            is_valid, message = coupon.is_valid(
                client=request.user if request.user.is_authenticated else None,
                order_amount=serializer.validated_data['order_amount']
            )
            
            if is_valid:
                discount = coupon.calculate_discount(serializer.validated_data['order_amount'])
                return Response({
                    'valid': True,
                    'discount_type': coupon.discount_type,
                    'discount_value': coupon.discount_value,
                    'discount_amount': discount,
                    'message': 'Coupon applied successfully'
                })
            else:
                return Response({
                    'valid': False,
                    'message': message
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Coupon.DoesNotExist:
            return Response({
                'valid': False,
                'message': 'Invalid coupon code'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @permission_required('manage_orders')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @permission_required('manage_orders')
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)
    
    @permission_required('manage_orders')
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


class CartViewSet(viewsets.GenericViewSet):
    """ViewSet for shopping cart"""
    
    serializer_class = CartSerializer
    permission_classes = [AllowAny]
    
    def get_cart(self, request):
        """Get or create cart for current session/user"""
        session_key = request.session.session_key
        if not session_key:
            request.session.create()
            session_key = request.session.session_key
        
        if request.user.is_authenticated:
            cart, created = Cart.objects.get_or_create(
                client=request.user,
                defaults={'session_key': session_key}
            )
        else:
            cart, created = Cart.objects.get_or_create(
                session_key=session_key,
                defaults={'client': None}
            )
        
        return cart
    
    @action(detail=False, methods=['get'])
    def get_cart(self, request):
        """Get current cart"""
        cart = self.get_cart(request)
        serializer = self.get_serializer(cart)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def add_item(self, request):
        """Add item to cart"""
        cart = self.get_cart(request)
        
        plan_id = request.data.get('plan_id')
        cycle_key = request.data.get('cycle_key', '1mo')
        quantity = request.data.get('quantity', 1)
        domain_name = request.data.get('domain_name', '')
        
        try:
            plan = Plan.objects.get(id=plan_id, status='active')
            billing_cycle = PlanBillingCycle.objects.get(plan=plan, cycle_key=cycle_key, is_active=True)
        except (Plan.DoesNotExist, PlanBillingCycle.DoesNotExist):
            return Response({'error': 'Invalid plan or billing cycle'}, status=status.HTTP_400_BAD_REQUEST)
        
        items = cart.items or []
        
        # Check if item already exists
        item_exists = False
        for item in items:
            if item.get('plan_id') == plan_id and item.get('cycle_key') == cycle_key:
                item['quantity'] += quantity
                item_exists = True
                break
        
        if not item_exists:
            items.append({
                'plan_id': plan_id,
                'plan_name': plan.name,
                'cycle_key': cycle_key,
                'quantity': quantity,
                'domain_name': domain_name,
                'price': float(billing_cycle.price)
            })
        
        cart.items = items
        cart.save()
        
        return Response({'message': 'Item added to cart'})
    
    @action(detail=False, methods=['post'])
    def remove_item(self, request):
        """Remove item from cart"""
        cart = self.get_cart(request)
        plan_id = request.data.get('plan_id')
        
        items = cart.items or []
        items = [item for item in items if item.get('plan_id') != plan_id]
        
        cart.items = items
        cart.save()
        
        return Response({'message': 'Item removed from cart'})
    
    @action(detail=False, methods=['post'])
    def update_quantity(self, request):
        """Update item quantity"""
        cart = self.get_cart(request)
        plan_id = request.data.get('plan_id')
        quantity = request.data.get('quantity', 1)
        
        items = cart.items or []
        for item in items:
            if item.get('plan_id') == plan_id:
                item['quantity'] = max(1, quantity)
                break
        
        cart.items = items
        cart.save()
        
        return Response({'message': 'Cart updated'})
    
    @action(detail=False, methods=['post'])
    def clear(self, request):
        """Clear cart"""
        cart = self.get_cart(request)
        cart.items = []
        cart.coupon_code = None
        cart.save()
        
        return Response({'message': 'Cart cleared'})
    
    @action(detail=False, methods=['post'])
    def apply_coupon(self, request):
        """Apply coupon to cart"""
        cart = self.get_cart(request)
        coupon_code = request.data.get('coupon_code')
        
        try:
            coupon = Coupon.objects.get(code=coupon_code.upper(), is_active=True)
            cart.coupon_code = coupon_code
            cart.save()
            return Response({'message': 'Coupon applied'})
        except Coupon.DoesNotExist:
            return Response({'error': 'Invalid coupon'}, status=status.HTTP_400_BAD_REQUEST)
