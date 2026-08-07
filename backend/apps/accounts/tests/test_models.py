from accounts.models import User
from django.db import IntegrityError
from django.test import TestCase


class UserModelTest(TestCase):
    """Test cases for the User model"""

    def test_create_user(self):
        """Test creating a standard user"""
        user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.assertEqual(user.email, "test@example.com")
        self.assertTrue(user.check_password("testpass123"))
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_create_superuser(self):
        """Test creating a superuser"""
        user = User.objects.create_superuser(
            email="admin@example.com", password="adminpass123"
        )
        self.assertEqual(user.email, "admin@example.com")
        self.assertTrue(user.check_password("adminpass123"))
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_user_email_normalized(self):
        """Test that email is normalized"""
        email = "test@EXAMPLE.COM"
        user = User.objects.create_user(email=email, password="testpass123")
        self.assertEqual(user.email, email.lower())

    def test_user_email_unique(self):
        """Test that email is unique"""
        User.objects.create_user(email="test@example.com", password="testpass123")
        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                email="test@example.com", password="anotherpass123"
            )

    def test_user_str_representation(self):
        """Test string representation of user"""
        user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.assertEqual(str(user), "test@example.com")

    def test_user_without_email_raises_error(self):
        """Test that creating user without email raises error"""
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="testpass123")
