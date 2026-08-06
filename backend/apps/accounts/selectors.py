from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


def get_user_by_email(email: str):
    """
    Get user by email address.
    
    Args:
        email: User's email address
        
    Returns:
        User instance or None if not found
    """
    try:
        return User.objects.get(email=email)
    except User.DoesNotExist:
        return None


def get_user_by_id(user_id: str):
    """
    Get user by ID.
    
    Args:
        user_id: User's UUID
        
    Returns:
        User instance or None if not found
    """
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None


def search_users(query: str):
    """
    Search users by email, first name, or last name.
    
    Args:
        query: Search query string
        
    Returns:
        QuerySet of matching users
    """
    return User.objects.filter(
        Q(email__icontains=query) |
        Q(first_name__icontains=query) |
        Q(last_name__icontains=query)
    )


def get_all_users():
    """
    Get all users.
    
    Returns:
        QuerySet of all users
    """
    return User.objects.all()


def get_active_users():
    """
    Get all active users.
    
    Returns:
        QuerySet of active users
    """
    return User.objects.filter(is_active=True)


def get_verified_users():
    """
    Get all verified users.
    
    Returns:
        QuerySet of verified users
    """
    return User.objects.filter(is_verified=True)
