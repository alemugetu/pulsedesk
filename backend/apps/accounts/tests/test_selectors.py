import uuid

from django.test import TestCase
from django.contrib.auth import get_user_model
from accounts.selectors import get_user_by_email, get_user_by_id

User = get_user_model()


class UserSelectorsTest(TestCase):
    """Test cases for user selectors"""
    
    def setUp(self):
        """Set up test users"""
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
    
    def test_get_user_by_email(self):
        """Test getting user by email"""
        user = get_user_by_email(email='test@example.com')
        self.assertEqual(user, self.user)
    
    def test_get_user_by_email_not_found(self):
        """Test getting non-existent user by email"""
        user = get_user_by_email(email='nonexistent@example.com')
        self.assertIsNone(user)
    
    def test_get_user_by_id(self):
        """Test getting user by ID"""
        user = get_user_by_id(user_id=self.user.id)
        self.assertEqual(user, self.user)
    
    def test_get_user_by_id_not_found(self):
        """Test getting non-existent user by ID"""
        user = get_user_by_id(user_id=uuid.uuid4())
        self.assertIsNone(user)
