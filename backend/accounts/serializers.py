from djoser.serializers import UserCreateSerializer as BaseUserCreateSerializer, UserSerializer as BaseUserSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class CustomUserCreateSerializer(BaseUserCreateSerializer):
    full_name = serializers.CharField(required=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    referral_code = serializers.CharField(required=False, allow_blank=True, write_only=True)
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    re_password = serializers.CharField(write_only=True, required=True)

    class Meta(BaseUserCreateSerializer.Meta):
        model = User
        fields = (
            'id', 
            'full_name', 
            'email', 
            'username', 
            'phone_number', 
            'referral_code',
            'password', 
            're_password', 
        )

    def validate(self, attrs):
        # Check that password and re_password match
        if attrs['password'] != attrs['re_password']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def validate_referral_code(self, value):
        if value and not User.objects.filter(referral_code=value).exists():
            logger.warning(f"Registration attempt with invalid referral code: {value}")
            raise serializers.ValidationError("Invalid referral code.")
        return value

    def create(self, validated_data):
        referral_code = validated_data.pop('referral_code', None)
        re_password = validated_data.pop('re_password', None)  # Remove re_password
        
        # Set username to email if not provided
        if not validated_data.get('username'):
            validated_data['username'] = validated_data.get('email').split('@')[0]
        
        try:
            user = User.objects.create_user(**validated_data)
            logger.info(f"New user created successfully: {user.email}")
        except Exception as e:
            logger.error(f"Failed to create user: {str(e)}")
            raise e

        if referral_code:
            try:
                referrer = User.objects.get(referral_code=referral_code)
                # Add your referral logic here (e.g., create referral record)
                logger.info(f"User {user.email} successfully linked to referrer {referrer.email}")
            except User.DoesNotExist:
                logger.error(f"Referral code {referral_code} disappeared during processing for user {user.email}")
            
        return user


class CustomUserSerializer(BaseUserSerializer):
    """
    Serializer for the 'me' endpoint and viewing user profiles.
    """
    role = serializers.SerializerMethodField()

    class Meta(BaseUserSerializer.Meta):
        model = User
        fields = [
            'id',
            'email',
            'username',
            'full_name',
            'phone_number',
            'referral_code',
            'role',
            'is_staff',
            'is_superuser',
            'is_active',
            'date_joined',
            'last_login',
        ]
        read_only_fields = [
            'referral_code',
            'email',
            'role',
            'is_staff',
            'is_superuser',
            'is_active',
            'date_joined',
            'last_login',
        ]

    def get_role(self, obj):
        if obj.is_superuser:
            return "admin"
        if obj.is_staff:
            return "staff"
        return getattr(obj, "role", None) or "client"

class CustomLoginSerializer(serializers.Serializer):
    """
    Custom serializer to allow login with email
    """
    email = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if not email or not password:
            raise serializers.ValidationError("Both email/username and password are required.")

        # Try to get user by email
        user = None
        if '@' in email:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                pass
        else:
            try:
                user = User.objects.get(username=email)
            except User.DoesNotExist:
                pass

        if not user:
            raise serializers.ValidationError("Invalid credentials.")

        if not user.check_password(password):
            raise serializers.ValidationError("Invalid credentials.")

        attrs['user'] = user
        return attrs


# accounts/serializers.py

from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.contrib.auth import authenticate

User = get_user_model()

class CustomTokenCreateSerializer(serializers.Serializer):
    login = serializers.CharField()
    password = serializers.CharField()

    def validate(self, attrs):
        login = attrs.get("login")
        password = attrs.get("password")

        user = None

        if "@" in login:
            try:
                user_obj = User.objects.get(email=login)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                pass
        else:
            user = authenticate(username=login, password=password)

        if not user:
            raise serializers.ValidationError("Invalid credentials")

        if not user.is_active:
            raise serializers.ValidationError("User account is disabled")

        attrs["user"] = user
        return attrs

# accounts/serializers.py - Add these to your existing serializers

from rest_framework import serializers
from django.db.models import Sum, Count
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import ClientProfile, StaffProfile

User = get_user_model()


class CustomerListSerializer(serializers.ModelSerializer):
    """Serializer for list view - lightweight, only essential fields"""
    
    services_count = serializers.IntegerField(read_only=True)
    total_invoices = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=2, coerce_to_string=False)
    unpaid_invoices = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=2, coerce_to_string=False)
    wallet_balance = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'full_name',
            'email',
            'phone_number',
            'company_name',
            'role',
            'status',
            'date_joined',
            'last_login',
            'services_count',
            'total_invoices',
            'unpaid_invoices',
            'wallet_balance',
        ]
    
    def get_role(self, obj):
        """Determine role based on staff/superuser flags"""
        if obj.is_staff and obj.is_superuser:
            return "admin"
        elif obj.is_staff and not obj.is_superuser:
            return "staff"
        else:
            return "client"
    
    def get_wallet_balance(self, obj):
        """Get customer's wallet balance if wallet app exists"""
        try:
            from wallet.models import Wallet
            wallet = Wallet.objects.filter(user=obj).first()
            return float(wallet.balance) if wallet else 0.00
        except ImportError:
            return 0.00
    
    def get_status(self, obj):
        """Determine customer status based on user flags"""
        if not obj.is_active:
            return 'inactive'
        if hasattr(obj, 'is_locked') and obj.is_locked:
            return 'locked'
        return 'active'


class CustomerDetailSerializer(serializers.ModelSerializer):
    """Serializer for detail view - includes all customer data and relationships"""
    
    # Basic info fields
    address_line1 = serializers.CharField(source='address', required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True)
    state = serializers.CharField(required=False, allow_blank=True)
    country = serializers.CharField(required=False, allow_blank=True)
    postal_code = serializers.CharField(required=False, allow_blank=True)
    tax_id = serializers.CharField(required=False, allow_blank=True)
    tax_exempt = serializers.BooleanField(required=False)
    
    # Status fields
    email_verified = serializers.BooleanField(source='email_verified_at', read_only=True)
    phone_verified = serializers.BooleanField(source='phone_verified_at', read_only=True)
    two_factor_enabled = serializers.BooleanField(read_only=True)
    status = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    
    # Billing summary
    billing_summary = serializers.SerializerMethodField()
    
    # Recent items
    recent_invoices = serializers.SerializerMethodField()
    recent_orders = serializers.SerializerMethodField()
    recent_services = serializers.SerializerMethodField()
    
    # Wallet info
    wallet_balance = serializers.SerializerMethodField()
    wallet_currency = serializers.SerializerMethodField()
    
    # Additional fields
    notes = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            # Basic identity
            'id',
            'full_name',
            'email',
            'username',
            'phone_number',
            'company_name',
            
            # Address
            'address_line1',
            'city',
            'state',
            'country',
            'postal_code',
            
            # Tax
            'tax_id',
            'tax_exempt',
            
            # Role & Status
            'role',
            'status',
            'email_verified',
            'phone_verified',
            'two_factor_enabled',
            
            # Timestamps
            'date_joined',
            'last_login',
            'updated_at',
            
            # Billing summary
            'billing_summary',
            
            # Recent items
            'recent_invoices',
            'recent_orders',
            'recent_services',
            
            # Wallet
            'wallet_balance',
            'wallet_currency',
            
            # Internal notes
            'notes',
            'created_by',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login', 'updated_at', 'email']
    
    def get_role(self, obj):
        """Determine role based on staff/superuser flags"""
        if obj.is_staff and obj.is_superuser:
            return "admin"
        elif obj.is_staff and not obj.is_superuser:
            return "staff"
        else:
            return "client"
    
    def get_status(self, obj):
        """Determine comprehensive customer status"""
        if not obj.is_active:
            return 'inactive'
        
        if hasattr(obj, 'is_locked') and obj.is_locked:
            return 'locked'
        
        # Check for overdue invoices (only for clients)
        if self.get_role(obj) == 'client':
            try:
                from billing.models import Invoice
                has_overdue = Invoice.objects.filter(
                    user=obj, 
                    status='unpaid', 
                    due_date__lt=timezone.now()
                ).exists()
                if has_overdue:
                    return 'overdue'
            except:
                pass
        
        return 'active'
    
    def get_billing_summary(self, obj):
        """Get billing statistics for the customer (only for clients)"""
        # Staff and admin don't have billing summaries
        if self.get_role(obj) != 'client':
            return None
        
        try:
            from billing.models import Invoice, Order
            from services.models import Service
            
            # Invoice stats
            invoices = Invoice.objects.filter(user=obj)
            total_invoiced = invoices.aggregate(total=Sum('total'))['total'] or 0
            total_paid = invoices.filter(status='paid').aggregate(total=Sum('total'))['total'] or 0
            total_unpaid = invoices.filter(status='unpaid').aggregate(total=Sum('total'))['total'] or 0
            total_overdue = invoices.filter(
                status='unpaid', 
                due_date__lt=timezone.now()
            ).aggregate(total=Sum('total'))['total'] or 0
            
            # Order stats
            orders = Order.objects.filter(user=obj)
            total_orders = orders.count()
            pending_orders = orders.filter(status='pending').count()
            completed_orders = orders.filter(status='completed').count()
            cancelled_orders = orders.filter(status='cancelled').count()
            
            # Service stats
            services = Service.objects.filter(user=obj)
            active_services = services.filter(status='active').count()
            suspended_services = services.filter(status='suspended').count()
            terminated_services = services.filter(status='terminated').count()
            
            return {
                'invoices': {
                    'total': float(total_invoiced),
                    'paid': float(total_paid),
                    'unpaid': float(total_unpaid),
                    'overdue': float(total_overdue),
                },
                'orders': {
                    'total': total_orders,
                    'pending': pending_orders,
                    'completed': completed_orders,
                    'cancelled': cancelled_orders,
                },
                'services': {
                    'active': active_services,
                    'suspended': suspended_services,
                    'terminated': terminated_services,
                }
            }
        except Exception:
            return {
                'invoices': {'total': 0, 'paid': 0, 'unpaid': 0, 'overdue': 0},
                'orders': {'total': 0, 'pending': 0, 'completed': 0, 'cancelled': 0},
                'services': {'active': 0, 'suspended': 0, 'terminated': 0},
            }
    
    def get_recent_invoices(self, obj):
        """Get last 5 invoices for quick view (only for clients)"""
        if self.get_role(obj) != 'client':
            return []
        
        try:
            from billing.models import Invoice
            from billing.serializers import InvoiceListSerializer
            
            invoices = Invoice.objects.filter(user=obj).order_by('-created_at')[:5]
            return InvoiceListSerializer(invoices, many=True).data
        except:
            return []
    
    def get_recent_orders(self, obj):
        """Get last 5 orders for quick view (only for clients)"""
        if self.get_role(obj) != 'client':
            return []
        
        try:
            from orders.models import Order
            from orders.serializers import OrderListSerializer
            
            orders = Order.objects.filter(user=obj).order_by('-created_at')[:5]
            return OrderListSerializer(orders, many=True).data
        except:
            return []
    
    def get_recent_services(self, obj):
        """Get last 5 services for quick view (only for clients)"""
        if self.get_role(obj) != 'client':
            return []
        
        try:
            from services.models import Service
            from services.serializers import ServiceListSerializer
            
            services = Service.objects.filter(user=obj).order_by('-created_at')[:5]
            return ServiceListSerializer(services, many=True).data
        except:
            return []
    
    def get_wallet_balance(self, obj):
        """Get current wallet balance (only for clients)"""
        if self.get_role(obj) != 'client':
            return None
        
        try:
            from wallet.models import Wallet
            wallet = Wallet.objects.filter(user=obj).first()
            return float(wallet.balance) if wallet else 0.00
        except:
            return 0.00
    
    def get_wallet_currency(self, obj):
        """Get wallet currency (only for clients)"""
        if self.get_role(obj) != 'client':
            return None
        
        try:
            from wallet.models import Wallet
            wallet = Wallet.objects.filter(user=obj).first()
            return wallet.currency if wallet else 'NGN'
        except:
            return 'NGN'
    
    def get_notes(self, obj):
        """Get internal notes based on user role"""
        role = self.get_role(obj)
        
        if role == 'client':
            try:
                if hasattr(obj, 'client_profile'):
                    return obj.client_profile.notes
            except:
                pass
        elif role in ['admin', 'staff']:
            try:
                if hasattr(obj, 'staff_profile'):
                    return obj.staff_profile.notes
            except:
                pass
        
        return None
    
    def get_created_by(self, obj):
        """Who created this user (if via admin)"""
        # This would require storing created_by in the model
        # For now, return None
        return None


class CustomerCreateSerializer(serializers.ModelSerializer):
    """Serializer for admin creating a new customer"""
    
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    send_welcome_email = serializers.BooleanField(write_only=True, default=True)
    notes = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = [
            'full_name',
            'email',
            'username',
            'phone_number',
            'password',
            'company_name',
            'address',
            'city',
            'state',
            'country',
            'postal_code',
            'tax_id',
            'tax_exempt',
            'send_welcome_email',
            'notes',
        ]
    
    def validate_email(self, value):
        """Ensure email is unique"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
    
    def validate_username(self, value):
        """Ensure username is unique"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value
    
    def create(self, validated_data):
        send_welcome = validated_data.pop('send_welcome_email', True)
        notes = validated_data.pop('notes', None)
        password = validated_data.pop('password')
        
        # Generate username from email if not provided
        if not validated_data.get('username'):
            validated_data['username'] = validated_data['email'].split('@')[0]
        
        # Create user (always client when created via customer create)
        user = User.objects.create_user(
            **validated_data,
            password=password,
            is_staff=False,
            is_superuser=False
        )
        
        # Create client profile with notes
        if notes:
            ClientProfile.objects.create(user=user, notes=notes)
        else:
            ClientProfile.objects.create(user=user)
        
        # Send welcome email if requested
        if send_welcome:
            # Implement your welcome email logic here
            pass
        
        return user


class CustomerUpdateSerializer(serializers.ModelSerializer):
    """Serializer for admin updating customer (PATCH)"""
    
    status = serializers.CharField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    role = serializers.CharField(required=False)
    
    class Meta:
        model = User
        fields = [
            'full_name',
            'phone_number',
            'company_name',
            'address',
            'city',
            'state',
            'country',
            'postal_code',
            'tax_id',
            'tax_exempt',
            'is_active',
            'is_staff',
            'is_superuser',
            'status',
            'role',
            'notes',
        ]
    
    def validate_role(self, value):
        """Validate role assignment"""
        if value not in ['admin', 'staff', 'client']:
            raise serializers.ValidationError("Role must be admin, staff, or client")
        return value
    
    def update(self, instance, validated_data):
        status = validated_data.pop('status', None)
        notes = validated_data.pop('notes', None)
        role = validated_data.pop('role', None)
        
        # Handle status mapping
        if status:
            if status == 'active':
                validated_data['is_active'] = True
            elif status in ['inactive', 'suspended']:
                validated_data['is_active'] = False
        
        # Handle role mapping (convert to staff/superuser flags)
        if role:
            if role == 'admin':
                validated_data['is_staff'] = True
                validated_data['is_superuser'] = True
            elif role == 'staff':
                validated_data['is_staff'] = True
                validated_data['is_superuser'] = False
            else:  # client
                validated_data['is_staff'] = False
                validated_data['is_superuser'] = False
        
        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Handle profile creation/update based on role
        new_role = role or self.get_role_from_instance(instance)
        
        if new_role == 'client':
            profile, created = ClientProfile.objects.get_or_create(user=instance)
            if notes is not None:
                profile.notes = notes
                profile.save()
        elif new_role in ['admin', 'staff']:
            profile, created = StaffProfile.objects.get_or_create(user=instance)
            if notes is not None:
                profile.notes = notes
                profile.save()
        
        return instance
    
    def get_role_from_instance(self, instance):
        """Get role from instance flags"""
        if instance.is_staff and instance.is_superuser:
            return "admin"
        elif instance.is_staff and not instance.is_superuser:
            return "staff"
        else:
            return "client"


class StaffCreateSerializer(serializers.ModelSerializer):
    """Serializer for admin creating staff or admin users"""
    
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    role = serializers.ChoiceField(choices=['admin', 'staff'], required=True)
    send_welcome_email = serializers.BooleanField(write_only=True, default=True)
    notes = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    # Staff-specific fields
    department = serializers.CharField(required=False, allow_blank=True)
    job_title = serializers.CharField(required=False, allow_blank=True)
    can_handle_tickets = serializers.BooleanField(default=True)
    can_handle_provisioning = serializers.BooleanField(default=False)
    signature = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = [
            'full_name',
            'email',
            'username',
            'phone_number',
            'password',
            'role',
            'company_name',
            'address',
            'city',
            'state',
            'country',
            'postal_code',
            'send_welcome_email',
            'notes',
            'department',
            'job_title',
            'can_handle_tickets',
            'can_handle_provisioning',
            'signature',
        ]
    
    def validate_email(self, value):
        """Ensure email is unique"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
    
    def validate_username(self, value):
        """Ensure username is unique"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value
    
    def create(self, validated_data):
        send_welcome = validated_data.pop('send_welcome_email', True)
        notes = validated_data.pop('notes', None)
        password = validated_data.pop('password')
        role = validated_data.pop('role')
        
        # Extract staff-specific fields
        department = validated_data.pop('department', None)
        job_title = validated_data.pop('job_title', None)
        can_handle_tickets = validated_data.pop('can_handle_tickets', True)
        can_handle_provisioning = validated_data.pop('can_handle_provisioning', False)
        signature = validated_data.pop('signature', None)
        
        # Generate username from email if not provided
        if not validated_data.get('username'):
            validated_data['username'] = validated_data['email'].split('@')[0]
        
        # Set staff/superuser flags based on role
        if role == 'admin':
            validated_data['is_staff'] = True
            validated_data['is_superuser'] = True
        else:  # staff
            validated_data['is_staff'] = True
            validated_data['is_superuser'] = False
        
        # Create user
        user = User.objects.create_user(
            **validated_data,
            password=password
        )
        
        # Create staff profile
        staff_profile = StaffProfile.objects.create(
            user=user,
            department=department,
            job_title=job_title,
            can_handle_tickets=can_handle_tickets,
            can_handle_provisioning=can_handle_provisioning,
            signature=signature
        )
        
        # Add notes if provided
        if notes:
            staff_profile.notes = notes
            staff_profile.save()
        
        # Send welcome email if requested
        if send_welcome:
            # Implement your welcome email logic here
            pass
        
        return user
