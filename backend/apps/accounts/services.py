from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import ValidationError
from accounts.models import User


class AuthService:
    """
    Service layer for authentication operations.
    Handles business logic for user authentication and token management.
    """
    
    @staticmethod
    def register_user(email: str, password: str, first_name: str = '', last_name: str = '') -> User:
        """
        Register a new user with email and password.
        
        Args:
            email: User's email address (must be unique)
            password: User's password
            first_name: User's first name (optional)
            last_name: User's last name (optional)
            
        Returns:
            Created User instance
            
        Raises:
            ValidationError: If email exists or password is invalid
        """
        # Normalize email
        email = email.lower()
        
        # Check if user already exists
        if User.objects.filter(email=email).exists():
            raise ValidationError({'email': ['A user with this email already exists.']})
        
        # Validate password strength
        try:
            validate_password(password)
        except DjangoValidationError as e:
            raise ValidationError({'password': list(e.messages)})
        
        # Create user
        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        
        return user
    
    @staticmethod
    def login_user(email: str, password: str) -> dict:
        """
        Authenticate user and return JWT tokens.
        
        Args:
            email: User's email address
            password: User's password
            
        Returns:
            Dictionary containing access and refresh tokens
            
        Raises:
            ValidationError: If authentication fails
        """
        user = authenticate(email=email, password=password)
        
        if not user:
            raise ValidationError({'non_field_errors': ['Invalid email or password.']})
        
        if not user.is_active:
            raise ValidationError({'non_field_errors': ['User account is disabled.']})
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    
    @staticmethod
    def refresh_token(refresh_token: str) -> dict:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: Valid refresh token
            
        Returns:
            Dictionary containing new access and refresh tokens
            
        Raises:
            ValidationError: If token is invalid or expired
        """
        try:
            refresh = RefreshToken(refresh_token)
            return {
                'access': str(refresh.access_token),
                'refresh': str(refresh),  # New refresh token due to rotation
            }
        except Exception as e:
            raise ValidationError({'non_field_errors': ['Invalid or expired refresh token.']})
    
    @staticmethod
    def logout_user(refresh_token: str) -> None:
        """
        Blacklist refresh token to logout user.
        
        Args:
            refresh_token: Refresh token to blacklist
            
        Raises:
            ValidationError: If token is invalid
        """
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception as e:
            raise ValidationError({'non_field_errors': ['Invalid refresh token.']})
    
    @staticmethod
    def update_user_profile(user: User, **kwargs) -> User:
        """
        Update user profile information.
        
        Args:
            user: User instance to update
            **kwargs: Fields to update (first_name, last_name, etc.)
            
        Returns:
            Updated User instance
        """
        allowed_fields = {'first_name', 'last_name'}
        
        for field, value in kwargs.items():
            if field in allowed_fields:
                setattr(user, field, value)
        
        user.save()
        return user
    
    @staticmethod
    def change_password(user: User, old_password: str, new_password: str) -> None:
        """
        Change user password.
        
        Args:
            user: User instance
            old_password: Current password
            new_password: New password
            
        Raises:
            ValidationError: If old password is incorrect or new password is invalid
        """
        if not user.check_password(old_password):
            raise ValidationError({'old_password': ['Current password is incorrect.']})
        
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            raise ValidationError({'new_password': list(e.messages)})
        
        user.set_password(new_password)
        user.save()
