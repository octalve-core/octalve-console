# orders/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, BasePermission
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from decimal import Decimal
from django.utils import timezone
from .models import Order, OrderItem, Coupon, CouponRedemption, Cart
from catalog.models import Plan, PlanBillingCycle
from .serializers import (
    OrderSerializer, CreateOrderSerializer, CouponSerializer,
    ValidateCouponSerializer, CartSerializer
)
from rbac.decorators import permission_required
import uuid


class OrderWriteAuthority(BasePermission):
    """Clients may place orders, never modify payment/provisioning authority."""

    def has_permission(self, request, view):
        if view.action in ("update", "partial_update", "destroy"):
            user = request.user
            return bool(user and user.is_authenticated and
                        (user.is_superuser or user.role == "admin"))
        return True


class OrderViewSet(viewsets.ModelViewSet):
    """ViewSet for orders"""
    
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, OrderWriteAuthority]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'source']
    search_fields = ['order_number', 'client__email', 'client__full_name']
    ordering_fields = ['created_at', 'total', 'order_number']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Order.objects.all()
        # No global Staff read: assignment-scoped access requires a separately
        # certified per-customer grant and cannot use a broad role flag.
        if user.role == 'staff':
            return Order.objects.filter(client=user)
        return Order.objects.filter(client=user)
    
    @staticmethod
    def _refuse_unverified_change():
        return Response(
            {'detail': 'Order changes must use approved checkout and cancellation actions.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    def update(self, request, *args, **kwargs):
        return self._refuse_unverified_change()

    def partial_update(self, request, *args, **kwargs):
        return self._refuse_unverified_change()

    def destroy(self, request, *args, **kwargs):
        return self._refuse_unverified_change()

    @action(detail=False, methods=['post'], url_path='quote')
    @transaction.atomic
    def quote(self, request):
        """Server-priced, read-only cart review. No order, invoice or gateway write."""
        from rest_framework.exceptions import ValidationError
        if getattr(request.user, "role", None) != "client":
            return Response({"detail": "Customer checkout requires a client account."}, status=403)
        if not hasattr(request.data, "keys") or (set(request.data.keys()) -
                {"checkout_id", "items", "coupon_code", "notes"}):
            raise ValidationError({"detail": "Unexpected checkout fields."})
        serializer = CreateOrderSerializer(
            data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data["items"]
        if len({item["plan"].currency for item in items}) != 1:
            raise ValidationError({"items": "A checkout must use one currency."})
        subtotal = sum(
            (item["unit_price"] * item["quantity"] for item in items),
            Decimal("0.00"))
        coupon = serializer.context.get("coupon")
        discount = Decimal("0.00")
        if coupon:
            approved, message = coupon.is_valid(
                client=request.user, order_amount=subtotal,
                product_ids=[i['plan'].product_id for i in items],
                plan_ids=[i['plan'].pk for i in items])
            if not approved:
                raise ValidationError({"coupon_code": message})
            discount = coupon.calculate_discount(subtotal)
        total = subtotal - discount
        supplier_cost = sum(
            (item.get("supplier_cost", Decimal("0.00")) * item["quantity"]
             for item in items), Decimal("0.00"))
        if total <= 0 or total < supplier_cost:
            raise ValidationError({"coupon_code": "Offer is unavailable at this price."})
        return Response({
            "currency": items[0]["plan"].currency,
            "subtotal": str(subtotal),
            "discount_total": str(discount),
            "tax_total": "0.00",
            "total": str(total),
            "coupon_code": coupon.code if coupon else None,
            "items": [{
                "name": item["plan"].name,
                "description": item["description"],
                "domain_name": item.get("domain_name", ""),
                "quantity": item["quantity"],
                "unit_price": str(item["unit_price"]),
                "cycle_key": item["billing_cycle"].cycle_key,
                "price_revision": (
                    item["published_catalog_offer"].revision
                    if item.get("published_catalog_offer") else None),
            } for item in items],
            "message": "The final invoice is calculated again when you place the order.",
        }, headers={"Cache-Control": "private, no-store"})

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create a new order from cart"""
        serializer = CreateOrderSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        validated_data = serializer.validated_data
        from django.contrib.auth import get_user_model
        # Serialize retries by locking the client, before creating an order.
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        checkout_id = str(validated_data['checkout_id'])
        existing = Order.objects.filter(client=request.user, metadata__checkout_id=checkout_id).first()
        if existing:
            data = OrderSerializer(existing).data
            previous = existing.invoices.first()
            if previous:
                data['invoice'] = {
                    'id': previous.id, 'invoice_number': previous.invoice_number,
                    'status': previous.status, 'amount_due': str(previous.amount_due),
                }
            return Response(data, status=status.HTTP_200_OK)
        coupon = serializer.context.get('coupon')
        
        # Calculate totals
        currencies = {item['plan'].currency for item in validated_data['items']}
        if len(currencies) != 1:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'items': 'All items must have the same currency.'})
        subtotal = sum((item['unit_price'] * item['quantity'] for item in validated_data['items']), Decimal('0.00'))
        
        # Apply coupon
        discount_total = 0
        coupon_discount = 0
        if coupon:
            from rest_framework.exceptions import ValidationError
            coupon = Coupon.objects.select_for_update().get(pk=coupon.pk)
            is_valid, message = coupon.is_valid(
                client=request.user, order_amount=subtotal,
                product_ids=[i['plan'].product_id for i in validated_data['items']],
                plan_ids=[i['plan'].pk for i in validated_data['items']])
            if not is_valid:
                raise ValidationError({'coupon_code': message})
            discount_total = coupon.calculate_discount(subtotal)
            coupon_discount = discount_total
        
        total = subtotal - discount_total
        if total <= 0:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'coupon_code': 'Offer is unavailable at this price.'})
        # Price concessions must not silently make a white-label resale loss.
        approved_partner_cost = sum(
            (item.get('supplier_cost', Decimal('0')) * item['quantity']
             for item in validated_data['items']), Decimal('0')
        )
        if approved_partner_cost > total:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'coupon_code': 'Discount exceeds approved partner resale margin.'})

        # Immutable billing identity from the authenticated database account,
        # never from a browser-supplied customer name, tax flag or invoice total.
        customer = request.user
        billing_contact = {
            "full_name": customer.full_name or "",
            "email": customer.email,
            "phone_number": customer.phone_number or "",
            "company_name": customer.company_name or "",
            "address": customer.address or "",
            "city": customer.city or "",
            "state": customer.state or "",
            "country": customer.country or "",
            "postal_code": customer.postal_code or "",
            "tax_id": customer.tax_id or "",
        }
        # Create order
        order = Order.objects.create(
            client=request.user,
            source='web',
            status='pending_payment',
            subtotal=subtotal,
            discount_total=discount_total,
            total=total,
            currency=next(iter(currencies)),
            metadata={'checkout_id': checkout_id, 'billing_contact': billing_contact},
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
            
            config = dict(item_data.get('config') or {})
            catalog_offer = item_data.get('published_catalog_offer')
            # Never trust a client-supplied snapshot. Pin the approved
            # supplier/retail revision used to produce the invoice.
            config.pop('catalog_offer_snapshot', None)
            if catalog_offer:
                config['catalog_offer_snapshot'] = {
                    'revision': catalog_offer.revision,
                    'plan_id': plan.pk,
                    'currency': plan.currency,
                    'supplier_provider_id': catalog_offer.snapshot['supplier_provider_id'],
                    'technical_package_id': catalog_offer.snapshot['technical_package_id'],
                    'price': str(billing_cycle.price),
                    'setup_fee': str(billing_cycle.setup_fee),
                    'billing_period': billing_cycle.cycle_key,
                }

            OrderItem.objects.create(
                order=order,
                product_id=plan.product.id,
                plan_id=plan.id,
                billing_cycle_id=billing_cycle.id,
                item_type=item_data.get('item_type', 'hosting'),
                description=item_data['description'],
                domain_name=item_data.get('domain_name', ''),
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                cycle_key=billing_cycle.cycle_key,
                months=billing_cycle.months,
                config=config
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
        
        data = OrderSerializer(order).data
        data['invoice'] = {
            'id': invoice.id, 'invoice_number': invoice.invoice_number,
            'status': invoice.status, 'amount_due': str(invoice.amount_due),
        }
        return Response(data, status=status.HTTP_201_CREATED)
    
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


class CouponWriteAuthority(BasePermission):
    """Only administrators may create, modify, or remove promotion rules."""

    def has_permission(self, request, view):
        if view.action in ("create", "update", "partial_update", "destroy"):
            user = request.user
            return bool(user and user.is_authenticated and
                        (user.is_superuser or user.role == "admin"))
        return True


class CouponViewSet(viewsets.ModelViewSet):
    """ViewSet for coupons (admin only)"""
    
    queryset = Coupon.objects.all()
    serializer_class = CouponSerializer
    permission_classes = [IsAuthenticated, CouponWriteAuthority]
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
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @permission_required('manage_orders')
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


class CartViewSet(viewsets.GenericViewSet):
    """ViewSet for shopping cart"""
    
    serializer_class = CartSerializer
    permission_classes = [AllowAny]
    
    def _get_or_create_cart(self, request):
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
        cart = self._get_or_create_cart(request)
        serializer = self.get_serializer(cart)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def add_item(self, request):
        """Add item to cart"""
        cart = self._get_or_create_cart(request)
        
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
        cart = self._get_or_create_cart(request)
        plan_id = request.data.get('plan_id')
        
        items = cart.items or []
        items = [item for item in items if item.get('plan_id') != plan_id]
        
        cart.items = items
        cart.save()
        
        return Response({'message': 'Item removed from cart'})
    
    @action(detail=False, methods=['post'])
    def update_quantity(self, request):
        """Update item quantity"""
        cart = self._get_or_create_cart(request)
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
        cart = self._get_or_create_cart(request)
        cart.items = []
        cart.coupon_code = None
        cart.save()
        
        return Response({'message': 'Cart cleared'})
    
    @action(detail=False, methods=['post'])
    def apply_coupon(self, request):
        """Apply coupon to cart"""
        cart = self._get_or_create_cart(request)
        coupon_code = request.data.get('coupon_code')
        
        try:
            coupon = Coupon.objects.get(code=coupon_code.upper(), is_active=True)
            cart.coupon_code = coupon_code
            cart.save()
            return Response({'message': 'Coupon applied'})
        except Coupon.DoesNotExist:
            return Response({'error': 'Invalid coupon'}, status=status.HTTP_400_BAD_REQUEST)
