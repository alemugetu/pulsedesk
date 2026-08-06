from django.test import TestCase
from django.contrib.auth import get_user_model
from accounts.services import AuthService

User = get_user_model()


class AuthServiceTest(TestCase):
    """Test cases for AuthService"""
    
    def test_register_user_success(self):
        """Test successful user registration"""
        user = AuthService.register_user(
            email='test@example.com',
            password='testpass123'
        )
        self.assertEqual(user.email, 'test@example.com')
        self.assertTrue(user.check_password('testpass123'))
    
    def test_register_user_with_extra_fields(self):
        """Test user registration with additional fields"""
        user = AuthService.register_user(
            email='test@example.com',
            password='testpass123',
            first_name='John',
            last_name='Doe'
        )
        self.assertEqual(user.first_name, 'John')
        self.assertEqual(user.last_name, 'Doe')
    
    def test_register_user_normalizes_email(self):
        """Test that registration normalizes email"""
        user = AuthService.register_user(
            email='TEST@EXAMPLE.COM',
            password='testpass123'
        )
        self.assertEqual(user.email, 'test@example.com')
