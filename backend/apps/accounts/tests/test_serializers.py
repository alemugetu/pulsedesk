from accounts.serializers import (
    UserLoginSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)
from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()


class UserRegistrationSerializerTest(TestCase):
    """Test cases for UserRegistrationSerializer"""

    def test_valid_registration(self):
        """Test valid registration data"""
        data = {
            "email": "test@example.com",
            "password": "testpass123",
            "password_confirm": "testpass123",
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        user = serializer.save()
        self.assertEqual(user.email, "test@example.com")

    def test_password_mismatch(self):
        """Test password mismatch raises validation error"""
        data = {
            "email": "test@example.com",
            "password": "testpass123",
            "password_confirm": "differentpass",
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("password_confirm", serializer.errors)

    def test_duplicate_email(self):
        """Test duplicate email raises validation error"""
        User.objects.create_user(email="test@example.com", password="testpass123")
        data = {
            "email": "test@example.com",
            "password": "testpass123",
            "password_confirm": "testpass123",
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)


class UserLoginSerializerTest(TestCase):
    """Test cases for UserLoginSerializer"""

    def setUp(self):
        """Set up test user — must be verified for login to succeed."""
        from django.utils import timezone

        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.user.email_verified_at = timezone.now()
        self.user.save(update_fields=["email_verified_at"])

    def test_valid_login(self):
        """Test valid login credentials"""
        data = {"email": "test@example.com", "password": "testpass123"}
        serializer = UserLoginSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_invalid_password(self):
        """Test invalid password raises validation error"""
        data = {"email": "test@example.com", "password": "wrongpass"}
        serializer = UserLoginSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

    def test_nonexistent_user(self):
        """Test non-existent user raises validation error"""
        data = {"email": "nonexistent@example.com", "password": "testpass123"}
        serializer = UserLoginSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)


class UserProfileSerializerTest(TestCase):
    """Test cases for UserProfileSerializer"""

    def test_user_serialization(self):
        """Test user data serialization"""
        user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
            first_name="John",
            last_name="Doe",
        )
        serializer = UserProfileSerializer(user)
        data = serializer.data
        self.assertEqual(data["email"], "test@example.com")
        self.assertEqual(data["first_name"], "John")
        self.assertEqual(data["last_name"], "Doe")
        self.assertNotIn("password", data)
