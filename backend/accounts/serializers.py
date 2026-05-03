from djoser.serializers import UserCreateSerializer as BaseUserCreateSerializer, UserSerializer as BaseUserSerializer
import logging
from djoser.serializers import UserCreateSerializer as BaseUserCreateSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model

# Initialize the logger for this specific module
logger = logging.getLogger(__name__)

User = get_user_model()

class UserCreateSerializer(BaseUserCreateSerializer):
    full_name = serializers.CharField(required=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    referred_by = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta(BaseUserCreateSerializer.Meta):
        model = User
        fields = (
            'id', 
            'email', 
            'username', 
            'full_name', 
            'phone_number', 
            'password', 
            're_password', 
            'referred_by'
        )

    def validate_referred_by(self, value):
        if value and not User.objects.filter(referral_code=value).exists():
            logger.warning(f"Registration attempt with invalid referral code: {value}")
            raise serializers.ValidationError("Invalid referral code.")
        return value

    def create(self, validated_data):
        referred_by_code = validated_data.pop('referred_by', None)
        
        if not validated_data.get('username'):
            validated_data['username'] = validated_data.get('email')

        try:
            user = super().create(validated_data)
            logger.info(f"New user created successfully: {user.email}")
        except Exception as e:
            logger.error(f"Failed to create user: {str(e)}")
            raise e

        if referred_by_code:
            try:
                referrer = User.objects.get(referral_code=referred_by_code)
                # referral logic here...
                logger.info(f"User {user.email} successfully linked to referrer {referrer.email}")
            except User.DoesNotExist:
                logger.error(f"Referral code {referred_by_code} disappeared during processing for user {user.email}")
            
        return user

class CustomUserSerializer(BaseUserSerializer):
    """
    Serializer for the 'me' endpoint and viewing user profiles.
    This defines what is returned when you call /api/auth/users/me/
    """
    class Meta(BaseUserSerializer.Meta):
        model = User
        fields = [
            'id',
            'email',
            'username',
            'full_name',
            'phone_number',
            'referral_code',
        ]
        read_only_fields = ['referral_code', 'email']

