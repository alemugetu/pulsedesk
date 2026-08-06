from django.test import TestCase
from django.contrib.auth import get_user_model
from accounts.permissions import IsOwnerOrReadOnly

User = get_user_model()


class IsOwnerOrReadOnlyPermissionTest(TestCase):
    """Test cases for IsOwnerOrReadOnly permission"""
    
    def setUp(self):
        """Set up test users and client"""
        self.owner = User.objects.create_user(
            email='owner@example.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            email='other@example.com',
            password='testpass123'
        )
    
    def test_permission_class_exists(self):
        """Test that the permission class can be instantiated"""
        permission = IsOwnerOrReadOnly()
        self.assertIsNotNone(permission)
