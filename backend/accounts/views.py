# accounts/views.py

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework import generics, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.contrib.auth import login, logout as django_logout
from django.db import transaction

from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from django.db.models import Count, F, Q, Sum
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.settings import api_settings
from rest_framework import serializers
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from .serializers import CustomUserCreateSerializer, CustomerListSerializer, CustomerDetailSerializer
import logging

logger = logging.getLogger(__name__)
User = get_user_model()



# class CustomUserCreateView(APIView):
#     """
#     Custom user registration view that uses CustomUserCreateSerializer
#     Returns JWT tokens immediately after registration
#     """
#     permission_classes = [AllowAny]
    
#     def get(self, request, *args, **kwargs):
#         """
#         GET method to show the expected data structure for registration
#         Useful for API documentation and testing
#         """
                
#         serializer = CustomUserCreateSerializer()
#         data = {}

#         for field_name, field in serializer.fields.items():
#             data[field_name] = str(field.__class__.__name__)

#         return Response(data)
        
#     def post(self, request, *args, **kwargs):
#         serializer = CustomUserCreateSerializer(data=request.data)
        
#         if serializer.is_valid():
#             try:
#                 # Create the user
#                 user = serializer.save()
                
#                 # Generate JWT tokens for immediate login
#                 refresh = RefreshToken.for_user(user)
                
#                 # Return response with user data and tokens
#                 return Response({
#                     'access': str(refresh.access_token),
#                     'refresh': str(refresh),
#                     'user': {
#                         'id': user.id,
#                         'email': user.email,
#                         'username': user.username,
#                         'full_name': user.full_name,
#                         'phone_number': user.phone_number,
#                         'referral_code': user.referral_code,
#                         'role': user.role,
#                     }
#                 }, status=status.HTTP_201_CREATED)
                
#             except Exception as e:
#                 logger.error(f"User creation error: {str(e)}")
#                 return Response(
#                     {'error': 'Unable to create user. Please try again.'},
#                     status=status.HTTP_400_BAD_REQUEST
#                 )
#         else:
#             # Return validation errors
#             return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomUserCreateView(CreateAPIView):
    serializer_class = CustomUserCreateSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)

            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": serializer.data
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# class CustomUserCreateNoTokenView(APIView):
#     """
#     Custom user registration view without auto-login (no JWT tokens)
#     """
#     permission_classes = [AllowAny]
    
#     def post(self, request, *args, **kwargs):
#         serializer = CustomUserCreateSerializer(data=request.data)
        
#         if serializer.is_valid():
#             try:
#                 # Create the user
#                 user = serializer.save()
                
#                 # Return only user data (no tokens)
#                 return Response({
#                     'id': user.id,
#                     'email': user.email,
#                     'username': user.username,
#                     'full_name': user.full_name,
#                     'phone_number': user.phone_number,
#                     'referral_code': user.referral_code,
#                     'role': user.role,
#                     'message': 'User created successfully. Please login.'
#                 }, status=status.HTTP_201_CREATED)
                
#             except Exception as e:
#                 logger.error(f"User creation error: {str(e)}")
#                 return Response(
#                     {'error': 'Unable to create user. Please try again.'},
#                     status=status.HTTP_400_BAD_REQUEST
#                 )
#         else:
#             return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class CustomUserCreateNoTokenView(CreateAPIView):
    """
    Custom user registration view without auto-login (no JWT tokens)
    """
    serializer_class = CustomUserCreateSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                user = serializer.save()

                return Response({
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "full_name": user.full_name,
                    "phone_number": user.phone_number,
                    "referral_code": user.referral_code,
                    "role": user.role,
                    "message": "User created successfully. Please login."
                }, status=status.HTTP_201_CREATED)

        except Exception:
            logger.exception("User creation failed")

            return Response(
                {"error": "Unable to create user. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Login with email OR username.
    Handles lockout, LoginHistory, and returns custom user payload.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # USERNAME_FIELD = 'email', so SimpleJWT already produced an 'email' field.
        # Nothing to rename — just relabel it.
        if 'email' in self.fields:
            self.fields['email'].label = 'Email or username'
            self.fields['email'].help_text = 'Enter your email or username'

    def validate(self, attrs):
        identifier = attrs.get('email') or attrs.get('username')
        password = attrs.get('password')

        if not identifier or not password:
            raise serializers.ValidationError(
                'Both email/username and password are required.',
                code='authorization',
            )

        # Look up by email or username
        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
        else:
            user = User.objects.filter(username__iexact=identifier).first()

        if not user:
            raise serializers.ValidationError(
                'No active account found with the given credentials.',
                code='authorization',
            )

        # Lockout check
        if getattr(user, 'is_locked', False):
            raise serializers.ValidationError(
                'No active account found with the given credentials.', code='authorization'
            )

        # Password check
        if not user.check_password(password):
            raise serializers.ValidationError(
                'No active account found with the given credentials.',
                code='authorization',
            )

        # Active check
        if not user.is_active:
            raise serializers.ValidationError(
                'No active account found with the given credentials.', code='authorization'
            )

        # ---- Build tokens manually (do NOT call super().validate) ----
        # super().validate() calls authenticate(email=identifier, password=...),
        # which fails when the caller used a *username* identifier.
        refresh = self.get_token(user)

        self.context['user'] = user          # view needs this for login()

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role,
                'referral_code': user.referral_code,
            },
        }

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['username'] = user.username
        token['full_name'] = user.full_name
        token['role'] = user.role
        token['user_id'] = user.id
        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom view that allows login with either email.
    
    Accepts:
    - email: Can be either email address
    - password: User's password
    
    Returns JWT tokens with user information.
    """
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        """
        Override post method to handle custom error responses
        """
        serializer = self.get_serializer(data=request.data)
        
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])
        
        # Return response with tokens and user data
        login(request, serializer.context['user']) 
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class CustomTokenRefreshView(TokenRefreshView):
    """Use pinned SimpleJWT rotation, blacklist and active-user checks."""


class CustomLogoutView(APIView):
    """
    Custom logout view that blacklists the refresh token
    and destroys the Django session.
    Requires 'rest_framework_simplejwt.token_blacklist' app
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not isinstance(refresh_token, str) or not refresh_token.strip():
            # A missing token cannot be blacklisted. End the Django session
            # but never report successful server-side refresh revocation.
            django_logout(request)
            return Response(
                {'error': 'Refresh token is required for server-side revocation.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            if str(token.get(api_settings.USER_ID_CLAIM)) != str(request.user.pk):
                return Response(
                    {'error': 'Refresh token does not belong to this account.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            token.blacklist()
        except TokenError:
            django_logout(request)
            return Response(
                {'error': 'Refresh token is invalid, expired or already revoked.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        django_logout(request)
        return Response(
            {'message': 'Successfully logged out'},
            status=status.HTTP_200_OK,
        )

class CustomUserInfoView(APIView):
    """
    Get current user information with extended details
    """
    
    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'full_name': user.full_name,
            'phone_number': user.phone_number,
            'referral_code': user.referral_code,
            'role': user.role,
            'is_staff': user.is_staff,
            'is_active': user.is_active,
            'date_joined': user.date_joined,
            'last_login': user.last_login,
        }, status=status.HTTP_200_OK)


# Alternative simpler version if you prefer less customization
class SimpleCustomTokenObtainPairView(TokenObtainPairView):
    """
    Simpler version of custom token view with minimal override
    """
    
    def post(self, request, *args, **kwargs):
        # Get credentials
        email = request.data.get('email')
        password = request.data.get('password')
        
        user = None
        
        if email and '@' in email:
            # Authenticate with email
            try:
                user_obj = User.objects.get(email=email)
                if user_obj.check_password(password):
                    user = user_obj
            except User.DoesNotExist:
                pass
        else:
            # Authenticate with username
            user = authenticate(request, username=email, password=password)
        
        # If user found, create token with standard flow
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'full_name': user.full_name,
                    'role': user.role,
                }
            }, status=status.HTTP_200_OK)
        
        return Response(
            {'detail': 'No active account found with the given credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )


class AdminCustomerListView(generics.ListCreateAPIView):
    """GET /api/auth/customers/ - List customers with filters
       POST /api/auth/customers/ - Create customer manually"""
    
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role']
    search_fields = ['email', 'full_name', 'company_name', 'phone_number']
    ordering_fields = ['date_joined', 'full_name', 'email']
    ordering = ['-date_joined']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CustomerCreateSerializer
        return CustomerListSerializer
    
    def get_queryset(self):
        return User.objects.filter(role='client').annotate(
            services_count=Count('services'),
            total_invoices=Sum('invoices__total'),
            unpaid_invoices=Sum('invoices__total', filter=Q(invoices__status='unpaid'))
        )

    def perform_create(self, serializer):
        user = serializer.save()
        return user


class AdminCustomerDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/auth/customers/{id}/"""
    
    permission_classes = [IsAdminUser]
    lookup_field = 'id'
    lookup_url_kwarg = 'id'

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return CustomerUpdateSerializer
        return CustomerDetailSerializer

    def get_queryset(self):
        return User.objects.filter(role='client').prefetch_related(
            'invoices', 'orders', 'services'
        )

    def perform_update(self, serializer):
        user = serializer.save()
        logger.info(f"Admin {self.request.user.email} updated customer {user.email}")
        return user

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])

