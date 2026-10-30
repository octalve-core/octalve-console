# accounts/serializers.py
from djoser.serializers import (
    UserCreateSerializer as BaseUserCreateSerializer,
    UserSerializer as BaseUserSerializer,
)
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction, IntegrityError
from django.db.models import Sum, Count, Q
from django.utils import timezone
import logging
import re
from uuid import uuid4

from .models import ClientProfile, StaffProfile

logger = logging.getLogger(__name__)
User = get_user_model()


# ============================================================
# REGISTRATION
# ============================================================

class CustomUserCreateSerializer(BaseUserCreateSerializer):
    username = serializers.CharField(required=False, allow_blank=True, max_length=30)
    full_name = serializers.CharField(required=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    referral_code = serializers.CharField(required=False, allow_blank=True, write_only=True)
    accepted_terms_version = serializers.ChoiceField(
        choices=["2026-10-30"], required=False, write_only=True)
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
            'accepted_terms_version',
            'password',
            're_password',
            'role',          # ✅ read-only output
        )
        read_only_fields = ('id', 'role')

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate_username(self, value):
        value = value.strip().lower()
        if not value:
            return ""
        if not re.fullmatch(r"[a-z][a-z0-9_]{2,29}", value):
            raise serializers.ValidationError(
                "Use 3–30 characters: start with a letter; use letters, numbers or underscores.")
        if value in {"admin", "administrator", "root", "support", "security",
                     "billing", "system", "octalve", "api", "staff"}:
            raise serializers.ValidationError("Choose a different username.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_phone_number(self, value):
        value = value.strip()
        if value and not re.fullmatch(r"\+[1-9][0-9]{7,14}", value):
            raise serializers.ValidationError("Use a full international phone number beginning with +.")
        return value

    def validate(self, attrs):
        restricted = set(self.initial_data) & {
            "role", "is_staff", "is_superuser", "is_active", "wallet_balance",
            "email_verified_at", "phone_verified_at", "two_factor_enabled"}
        if restricted:
            raise serializers.ValidationError({"detail": "Account privileges are not registration fields."})
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
        accepted_terms_version = validated_data.pop("accepted_terms_version", None)
        validated_data.pop('re_password', None)

        # Omitted username: derive a short safe name with a random suffix,
        # instead of exposing or colliding with an entire email local-part.
        if not validated_data.get("username"):
            prefix = re.sub(r"[^a-z0-9_]", "", validated_data["email"].split("@")[0])[:18]
            if not prefix or not prefix[0].isalpha():
                prefix = "user"
            validated_data["username"] = prefix + "_" + uuid4().hex[:8]

        try:
            with transaction.atomic():
                user = User.objects.create_user(**validated_data)
                if accepted_terms_version:
                    # Explicit client-submitted acknowledgement; no implied
                    # acceptance on older API clients that omit the field.
                    user.metadata = {
                        **(user.metadata or {}),
                        "terms_acceptance": {
                            "version": str(accepted_terms_version),
                            "accepted_at": timezone.now().isoformat(),
                            "source": "signup",
                        },
                    }
                    user.save(update_fields=["metadata"])
                logger.info("New Octalve Cloud account created.")

                if referral_code:
                    try:
                        referrer = User.objects.get(referral_code=referral_code)
                        # Attribution is immutable and user-submitted only.
                        # No third-party cookie or commission is granted at signup.
                        from django.conf import settings
                        if getattr(settings,"REWARDS_API_ENABLED",False) and referrer.pk!=user.pk:
                            from rewards.models import AffiliateAccount,ReferralAttribution
                            if AffiliateAccount.objects.filter(
                                user=referrer,status__in=("pending","approved")
                            ).exists():
                                ReferralAttribution.objects.create(
                                    referrer=referrer,referred_user=user,
                                    code_at_signup=referral_code
                                )
                    except User.DoesNotExist:
                        logger.error(
                            f"Referral code {referral_code} disappeared for {user.email}"
                        )
                return user
        except IntegrityError:
            # Unique index wins concurrent registration races. No SQL details
            # or existing account identity are returned to the browser.
            raise serializers.ValidationError({
                "detail": "The username or email is no longer available. Please try again."
            })


# ============================================================
# PUBLIC USER PROFILE (me)
# ============================================================

class CustomUserSerializer(BaseUserSerializer):
    """
    Serializer for the /me endpoint and viewing user profiles.
    """
    full_name = serializers.SerializerMethodField()
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
        ]
        read_only_fields = ['referral_code', 'email', 'role']

    def get_full_name(self, obj):
        return obj.full_name or obj.username

    def get_role(self, obj):
        if obj.is_staff and obj.is_superuser:
            return "admin"
        if obj.is_staff:
            return "staff"
        return "client"


# ============================================================
# LOGIN SERIALIZERS
# ============================================================

class CustomLoginSerializer(serializers.Serializer):
    """Plain credential validator (kept for reuse)."""
    email = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if not email or not password:
            raise serializers.ValidationError(
                "Both email/username and password are required."
            )

        user = (
            User.objects.filter(email=email).first()
            if '@' in email
            else User.objects.filter(username=email).first()
        )

        if not user or not user.check_password(password):
            raise serializers.ValidationError("Invalid credentials.")

        attrs['user'] = user
        return attrs


class CustomTokenCreateSerializer(serializers.Serializer):
    """Legacy djoser-style token serializer."""
    login = serializers.CharField()
    password = serializers.CharField()

    def validate(self, attrs):
        login = attrs.get("login")
        password = attrs.get("password")

        user = (
            User.objects.filter(email=login).first()
            if '@' in login
            else User.objects.filter(username=login).first()
        )
        if not user or not user.check_password(password):
            raise serializers.ValidationError("Invalid credentials")
        if not user.is_active:
            raise serializers.ValidationError("User account is disabled")

        attrs["user"] = user
        return attrs


# ============================================================
# ADMIN — CUSTOMER MANAGEMENT
# ============================================================

def _role_from_flags(obj):
    if obj.is_staff and obj.is_superuser:
        return "admin"
    if obj.is_staff:
        return "staff"
    return "client"


class CustomerListSerializer(serializers.ModelSerializer):
    """Lightweight list serializer."""

    services_count = serializers.IntegerField(read_only=True, default=0)
    total_invoices = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=False, read_only=True, default=0
    )
    unpaid_invoices = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=False, read_only=True, default=0
    )
    wallet_balance = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'email', 'phone_number', 'company_name',
            'role', 'status', 'date_joined', 'last_login',
            'services_count', 'total_invoices', 'unpaid_invoices', 'wallet_balance',
        ]

    def get_role(self, obj):
        return _role_from_flags(obj)

    def get_status(self, obj):
        if not obj.is_active:
            return 'suspended' if (obj.metadata or {}).get('account_suspended') is True else 'inactive'
        if getattr(obj, 'is_locked', False):
            return 'locked'
        return 'active'

    def get_wallet_balance(self, obj):
        # AdminCustomerListView selects the reverse OneToOne wallet.
        # getattr(..., None) handles accounts without a wallet without
        # triggering a new query for each row in the customer directory.
        wallet = getattr(obj, "wallet", None)
        return float(wallet.balance) if wallet is not None else 0.00


class CustomerDetailSerializer(serializers.ModelSerializer):
    """Full detail serializer (read-only for computed sub-objects)."""

    address_line1 = serializers.CharField(source='address', required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True)
    state = serializers.CharField(required=False, allow_blank=True)
    country = serializers.CharField(required=False, allow_blank=True)
    postal_code = serializers.CharField(required=False, allow_blank=True)
    tax_id = serializers.CharField(required=False, allow_blank=True)
    tax_exempt = serializers.BooleanField(required=False)

    email_verified = serializers.SerializerMethodField()
    phone_verified = serializers.SerializerMethodField()
    two_factor_enabled = serializers.BooleanField(read_only=True)
    status = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    billing_summary = serializers.SerializerMethodField()
    recent_invoices = serializers.SerializerMethodField()
    recent_orders = serializers.SerializerMethodField()
    recent_services = serializers.SerializerMethodField()
    wallet_balance = serializers.SerializerMethodField()
    wallet_currency = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'email', 'username', 'phone_number', 'company_name',
            'address_line1', 'city', 'state', 'country', 'postal_code',
            'tax_id', 'tax_exempt',
            'role', 'status', 'email_verified', 'phone_verified', 'two_factor_enabled',
            'date_joined', 'last_login', 'updated_at',
            'billing_summary',
            'recent_invoices', 'recent_orders', 'recent_services',
            'wallet_balance', 'wallet_currency',
            'notes', 'created_by',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login', 'updated_at', 'email']

    # ----- computed fields -----
    def get_email_verified(self, obj):
        return obj.email_verified_at is not None

    def get_phone_verified(self, obj):
        return obj.phone_verified_at is not None

    def get_role(self, obj):
        return _role_from_flags(obj)

    def get_status(self, obj):
        if not obj.is_active:
            return 'suspended' if (obj.metadata or {}).get('account_suspended') is True else 'inactive'
        if getattr(obj, 'is_locked', False):
            return 'locked'
        # Overdue is an invoice/payment state, not an account-access state.
        return 'active'

    def get_billing_summary(self, obj):
        if self.get_role(obj) != 'client':
            return None
        from billing.models import Invoice
        from orders.models import Order
        from services.models import Service

        # These ForeignKeys are named client, not user. Never substitute
        # fabricated zeroes when a real database/serializer error occurs.
        invoices = Invoice.objects.filter(client=obj)
        total_invoiced = invoices.aggregate(t=Sum('total'))['t'] or 0
        total_paid = invoices.filter(status='paid').aggregate(t=Sum('total'))['t'] or 0
        total_unpaid = invoices.filter(status='unpaid').aggregate(t=Sum('total'))['t'] or 0
        total_overdue = invoices.filter(
            status='unpaid', due_date__lt=timezone.now()
        ).aggregate(t=Sum('total'))['t'] or 0
        orders = Order.objects.filter(client=obj)
        services = Service.objects.filter(client=obj)
        return {
            'invoices': {
                'total': float(total_invoiced),
                'paid': float(total_paid),
                'unpaid': float(total_unpaid),
                'overdue': float(total_overdue),
            },
            'orders': {
                'total': orders.count(),
                'pending': orders.filter(status__in=('draft', 'pending_payment', 'needs_review')).count(),
                'completed': orders.filter(status='provisioned').count(),
                'cancelled': orders.filter(status='cancelled').count(),
            },
            'services': {
                'active': services.filter(status='active').count(),
                'suspended': services.filter(status='suspended').count(),
                'terminated': services.filter(status='terminated').count(),
            },
        }

    def get_recent_invoices(self, obj):
        if self.get_role(obj) != 'client':
            return []
        from billing.models import Invoice
        from billing.serializers import InvoiceSerializer
        qs = Invoice.objects.filter(client=obj).order_by('-created_at')[:5]
        return InvoiceSerializer(qs, many=True).data

    def get_recent_orders(self, obj):
        if self.get_role(obj) != 'client':
            return []
        from orders.models import Order
        from orders.serializers import OrderSerializer
        qs = Order.objects.filter(client=obj).order_by('-created_at')[:5]
        return OrderSerializer(qs, many=True).data

    def get_recent_services(self, obj):
        if self.get_role(obj) != 'client':
            return []
        from services.models import Service
        from services.serializers import ServiceSerializer
        qs = Service.objects.filter(client=obj).order_by('-created_at')[:5]
        return ServiceSerializer(qs, many=True).data

    def get_wallet_balance(self, obj):
        if self.get_role(obj) != 'client':
            return None
        wallet = getattr(obj, 'wallet', None)
        return float(wallet.balance) if wallet is not None else 0.00

    def get_wallet_currency(self, obj):
        if self.get_role(obj) != 'client':
            return None
        wallet = getattr(obj, 'wallet', None)
        return wallet.currency if wallet is not None else 'NGN'

    def get_notes(self, obj):
        role = self.get_role(obj)
        try:
            if role == 'client' and hasattr(obj, 'client_profile'):
                return obj.client_profile.notes
            if role in ('admin', 'staff') and hasattr(obj, 'staff_profile'):
                return obj.staff_profile.notes
        except Exception:
            pass
        return None

    def get_created_by(self, obj):
        return None  # wire up if you add a `created_by` FK


class CustomerCreateSerializer(serializers.ModelSerializer):
    """Admin creates a CLIENT."""

    password = serializers.CharField(write_only=True, required=True, min_length=8)
    send_welcome_email = serializers.BooleanField(write_only=True, default=True)
    notes = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'full_name', 'email', 'username', 'phone_number', 'password',
            'company_name', 'address', 'city', 'state', 'country', 'postal_code',
            'tax_id', 'tax_exempt', 'send_welcome_email', 'notes',
        ]

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_username(self, value):
        if value and User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def create(self, validated_data):
        validated_data.pop('send_welcome_email', True)
        notes = validated_data.pop('notes', None)
        password = validated_data.pop('password')

        if not validated_data.get('username'):
            base = validated_data['email'].split('@')[0]
            username = base
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base}{counter}"
                counter += 1
            validated_data['username'] = username

        with transaction.atomic():
            user = User.objects.create_user(
                **validated_data,
                password=password,
                role=User.Role.CLIENT,   # ✅ explicit
            )
            ClientProfile.objects.create(user=user, notes=notes or None)
        return user


class CustomerUpdateSerializer(serializers.ModelSerializer):
    """Admin edits contact details and account access, never funds or privileges."""
    status = serializers.ChoiceField(choices=["active", "inactive", "suspended", "locked"], required=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "full_name", "phone_number", "company_name",
            "address", "city", "state", "country", "postal_code",
            "tax_id", "tax_exempt", "status", "notes",
        ]

    def validate(self, attrs):
        # DRF ModelSerializer normally ignores unexpected input fields.
        # Reject rather than silently accepting privilege or wallet attempts.
        extra = set(self.initial_data) - set(self.fields)
        if extra:
            raise serializers.ValidationError({
                "detail": "Unrecognized or restricted fields: " + ", ".join(sorted(extra))
            })
        return attrs

    def update(self, instance, validated_data):
        state = validated_data.pop("status", None)
        notes = validated_data.pop("notes", None)
        with transaction.atomic():
            if state is not None:
                meta = dict(instance.metadata or {})
                if state == "active":
                    instance.is_active = True
                    instance.locked_until = None
                    meta.pop("account_suspended", None)
                elif state == "suspended":
                    instance.is_active = False
                    instance.locked_until = None
                    meta["account_suspended"] = True
                elif state == "inactive":
                    instance.is_active = False
                    instance.locked_until = None
                    meta.pop("account_suspended", None)
                elif state == "locked":
                    instance.is_active = True
                    instance.locked_until = timezone.now() + timezone.timedelta(days=36500)
                    meta.pop("account_suspended", None)
                instance.metadata = meta
            for key, value in validated_data.items():
                setattr(instance, key, value)
            instance.save()
            if notes is not None:
                profile, _ = ClientProfile.objects.get_or_create(user=instance)
                profile.notes = notes
                profile.save(update_fields=["notes"])
        return instance


class StaffCreateSerializer(serializers.ModelSerializer):
    """Admin creates a STAFF or ADMIN."""

    password = serializers.CharField(write_only=True, required=True, min_length=8)
    role = serializers.ChoiceField(choices=['admin', 'staff'], required=True)
    send_welcome_email = serializers.BooleanField(write_only=True, default=True)
    notes = serializers.CharField(write_only=True, required=False, allow_blank=True)

    department = serializers.CharField(required=False, allow_blank=True)
    job_title = serializers.CharField(required=False, allow_blank=True)
    can_handle_tickets = serializers.BooleanField(default=True)
    can_handle_provisioning = serializers.BooleanField(default=False)
    signature = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'full_name', 'email', 'username', 'phone_number', 'password',
            'role', 'company_name', 'address', 'city', 'state', 'country', 'postal_code',
            'send_welcome_email', 'notes',
            'department', 'job_title', 'can_handle_tickets',
            'can_handle_provisioning', 'signature',
        ]

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_username(self, value):
        if value and User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def create(self, validated_data):
        validated_data.pop('send_welcome_email', True)
        notes = validated_data.pop('notes', None)
        password = validated_data.pop('password')
        role = validated_data.pop('role')

        department = validated_data.pop('department', None)
        job_title = validated_data.pop('job_title', None)
        can_handle_tickets = validated_data.pop('can_handle_tickets', True)
        can_handle_provisioning = validated_data.pop('can_handle_provisioning', False)
        signature = validated_data.pop('signature', None)

        if not validated_data.get('username'):
            base = validated_data['email'].split('@')[0]
            username = base
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base}{counter}"
                counter += 1
            validated_data['username'] = username

        # ✅ Set flags + role field
        if role == 'admin':
            validated_data['is_staff'] = True
            validated_data['is_superuser'] = True
        else:
            validated_data['is_staff'] = True
            validated_data['is_superuser'] = False
        validated_data['role'] = role

        with transaction.atomic():
            user = User.objects.create_user(**validated_data, password=password)
            StaffProfile.objects.create(
                user=user,
                department=department,
                job_title=job_title,
                can_handle_tickets=can_handle_tickets,
                can_handle_provisioning=can_handle_provisioning,
                signature=signature,
                notes=notes or None,
            )
        return user