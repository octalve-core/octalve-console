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
