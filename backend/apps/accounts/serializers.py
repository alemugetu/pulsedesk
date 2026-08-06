from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    """
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
    class Meta:
        model = User
        fields = ['id', 'email', 'password', 'password_confirm', 'first_name', 'last_name']
        read_only_fields = ['id']
    
    def validate(self, attrs):
        """
        Validate password confirmation and password strength.
        """
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': ['Passwords do not match.']})
        
        # Validate password strength
        try:
            validate_password(attrs['password'])
        except DjangoValidationError as e:
            raise serializers.ValidationError({'password': list(e.messages)})
        
        return attrs
    
    def create(self, validated_data):
        """
        Create a new user instance.
        """
        validated_data.pop('password_confirm')
        from accounts.services import AuthService
        
        user = AuthService.register_user(**validated_data)
        return user


class UserLoginSerializer(serializers.Serializer):
    """
    Serializer for user login.
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, style={'input_type': 'password'})
    
    def validate(self, attrs):
        """
        Validate credentials and return tokens.
        """
        from accounts.services import AuthService
        
        try:
            tokens = AuthService.login_user(attrs['email'], attrs['password'])
            return tokens
        except ValidationError as e:
            # Re-raise as DRF validation error
            raise serializers.ValidationError(e.detail)


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile.
    """
    full_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'is_verified', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'email', 'is_verified', 'is_active', 'created_at', 'updated_at']


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profile.
    """
    class Meta:
        model = User
        fields = ['first_name', 'last_name']


class PasswordChangeSerializer(serializers.Serializer):
    """
    Serializer for password change.
    """
    old_password = serializers.CharField(required=True, style={'input_type': 'password'})
    new_password = serializers.CharField(required=True, style={'input_type': 'password'})
    new_password_confirm = serializers.CharField(required=True, style={'input_type': 'password'})
    
    def validate(self, attrs):
        """
        Validate password confirmation and strength.
        """
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': ['Passwords do not match.']})
        
        # Validate password strength
        try:
            validate_password(attrs['new_password'])
        except DjangoValidationError as e:
            raise serializers.ValidationError({'new_password': list(e.messages)})
        
        return attrs
    
    def validate_old_password(self, value):
        """
        Validate old password.
        """
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value


class TokenRefreshSerializer(serializers.Serializer):
    """
    Serializer for token refresh.
    """
    refresh = serializers.CharField(required=True)
    
    def validate(self, attrs):
        """
        Validate refresh token and return new tokens.
        """
        from accounts.services import AuthService
        
        try:
            tokens = AuthService.refresh_token(attrs['refresh'])
            return tokens
        except Exception as e:
            raise serializers.ValidationError({'non_field_errors': [str(e)]})


class LogoutSerializer(serializers.Serializer):
    """
    Serializer for logout.
    """
    refresh = serializers.CharField(required=True)
