# accounts/views.py

from rest_framework_simplejwt.views import TokenObtainPairView
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
    Custom serializer that allows login with either email
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Rename the 'username' field to 'email' for clarity
        self.fields['email'] = self.fields.pop('username')
        self.fields['email'].label = 'Email'
        self.fields['email'].help_text = 'Enter your email address'
    
    def validate(self, attrs):
        """
        Validate the login credentials allowing email
        """
        # Get the email and password from request
        email = attrs.get('email')
        password = attrs.get('password')
        
        # Initialize user as None
        user = None
        
        # Check if the input is valid
        if not email or not password:
            raise serializers.ValidationError(
                'Both email/username and password are required.',
                code='authorization'
            )
        
        if '@' in email:
            # Input contains @, treat as email
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    'No active account found with the given credentials.',
                    code='authorization'
                )
        else:
            # Input doesn't contain @, treat as username
            try:
                user = User.objects.get(username=email)
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    'No active account found with the given credentials.',
                    code='authorization'
                )
        
        # Check if user exists and password is correct
        if user and user.check_password(password):
            # Check if user is active
            if not user.is_active:
                raise serializers.ValidationError(
                    'This account is inactive.',
                    code='authorization'
                )
            
            # Set the username field for the parent serializer
            attrs['username'] = user.username
            
            # Call parent validation
            data = super().validate(attrs)
            
            # Add custom user data to response
            data['user'] = {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role,
                'referral_code': user.referral_code,
            }
            
            return data
        else:
            raise serializers.ValidationError(
                'Unable to log in with provided credentials.',
                code='authorization'
            )
    
    @classmethod
    def get_token(cls, user):
        """
        Customize token claims with additional user information
        """
        token = super().get_token(user)
        
        # Add custom claims to the token payload
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
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class CustomTokenRefreshView(APIView):
    """
    Custom token refresh view with better error handling
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        refresh_token = request.data.get('refresh')
        
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)
            
            return Response({
                'access': access_token,
                'refresh': str(refresh),
            }, status=status.HTTP_200_OK)
            
        except TokenError as e:
            return Response(
                {'error': 'Invalid or expired refresh token', 'detail': str(e)},
                status=status.HTTP_401_UNAUTHORIZED
            )


class CustomLogoutView(APIView):
    """
    Custom logout view that blacklists the refresh token
    Requires 'rest_framework_simplejwt.token_blacklist' app
    """
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            
            if not refresh_token:
                return Response(
                    {'error': 'Refresh token is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            token = RefreshToken(refresh_token)
            token.blacklist()
            
            return Response(
                {'message': 'Successfully logged out'},
                status=status.HTTP_200_OK
            )
        except AttributeError:
            # If token_blacklist app is not installed
            return Response(
                {'message': 'Logout successful (token not blacklisted)'},
                status=status.HTTP_200_OK
            )
        except TokenError:
            return Response(
                {'error': 'Invalid token'},
                status=status.HTTP_400_BAD_REQUEST
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
    serializer_class = CustomerListSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role'] #,'status', 'email_verified'
    search_fields = ['email', 'full_name', 'company_name', 'phone_number']
    ordering_fields = ['date_joined', 'full_name', 'email']
    ordering = ['-date_joined']
    
    def get_queryset(self):
        return User.objects.filter(role='client').annotate(
            services_count=Count('services'),
            total_invoices=Sum('invoices__total'),
            unpaid_invoices=Sum('invoices__total', filter=Q(invoices__status='unpaid'))
        )
    
    def perform_create(self, serializer):
        # When admin creates customer manually
        user = serializer.save(role='client')
        # Send welcome email?
        # Create audit log
        return user


class AdminCustomerDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/auth/customers/{id}/"""
    
    permission_classes = [IsAdminUser]
    serializer_class = CustomerDetailSerializer

    lookup_field = 'id'  # ← Add this line (it was missing)
    lookup_url_kwarg = 'id'  # ← Add this line
    
    def get_queryset(self):
        return User.objects.filter(role='client').prefetch_related(
            'invoices', 'orders', 'services'
        )
    
    def perform_update(self, serializer):
        user = serializer.save()
        # Log who made the change
        audit_logger.info(
            f"Admin {self.request.user.email} updated customer {user.email}"
        )
        return user
    
    def perform_destroy(self, instance):
        # Soft delete instead of hard delete
        instance.is_active = False
        instance.status = 'suspended'  # If you have status field
        instance.save()
        # Or hard delete: instance.delete()
        

