import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class AuthViewTest(TestCase):
    """Test cases for authentication views."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
        )

    def _login(self, email='test@example.com', password='testpass123'):
        return self.client.post(
            '/api/v1/auth/login/',
            {'email': email, 'password': password},
            format='json',
        )

    def test_user_registration(self):
        data = {
            'email': 'newuser@example.com',
            'password': 'newpass123',
            'password_confirm': 'newpass123',
        }
        response = self.client.post('/api/v1/auth/register/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], 'newuser@example.com')

    def test_registration_invalid_email(self):
        data = {
            'email': 'not-an-email',
            'password': 'newpass123',
            'password_confirm': 'newpass123',
        }
        response = self.client.post('/api/v1/auth/register/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_registration_weak_password(self):
        data = {
            'email': 'weak@example.com',
            'password': '123',
            'password_confirm': '123',
        }
        response = self.client.post('/api/v1/auth/register/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_registration_password_mismatch(self):
        data = {
            'email': 'mismatch@example.com',
            'password': 'newpass123',
            'password_confirm': 'differentpass',
        }
        response = self.client.post('/api/v1/auth/register/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data)

    def test_registration_duplicate_email(self):
        data = {
            'email': 'test@example.com',
            'password': 'newpass123',
            'password_confirm': 'newpass123',
        }
        response = self.client.post('/api/v1/auth/register/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_user_login(self):
        response = self._login()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_user_login_invalid_credentials(self):
        response = self._login(password='wrongpass')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_login_unknown_email(self):
        response = self._login(email='unknown@example.com')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_login_inactive_user(self):
        inactive_user = User.objects.create_user(
            email='inactive@example.com',
            password='testpass123',
        )
        inactive_user.is_active = False
        inactive_user.save(update_fields=['is_active'])

        response = self._login(email='inactive@example.com')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_authenticated(self):
        login_response = self._login()
        token = login_response.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'test@example.com')
        self.assertNotIn('password', response.data)

    def test_me_unauthenticated(self):
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_correct_user(self):
        other_user = User.objects.create_user(
            email='other@example.com',
            password='testpass123',
        )
        login_response = self._login(email='other@example.com')
        token = login_response.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], other_user.email)
        self.assertNotEqual(response.data['email'], self.user.email)

    def test_token_refresh(self):
        login_response = self._login()
        refresh_token = login_response.data['refresh']

        response = self.client.post(
            '/api/v1/auth/token/refresh/',
            {'refresh': refresh_token},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_token_refresh_invalid_token(self):
        response = self.client.post(
            '/api/v1/auth/token/refresh/',
            {'refresh': 'invalid-token'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout(self):
        login_response = self._login()
        access_token = login_response.data['access']
        refresh_token = login_response.data['refresh']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.post(
            '/api/v1/auth/logout/',
            {'refresh': refresh_token},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_logout_blacklists_refresh_token(self):
        login_response = self._login()
        access_token = login_response.data['access']
        refresh_token = login_response.data['refresh']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_response = self.client.post(
            '/api/v1/auth/logout/',
            {'refresh': refresh_token},
            format='json',
        )
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

        refresh_response = self.client.post(
            '/api/v1/auth/token/refresh/',
            {'refresh': refresh_token},
            format='json',
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_invalid_refresh_token(self):
        login_response = self._login()
        access_token = login_response.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.post(
            '/api/v1/auth/logout/',
            {'refresh': 'invalid-token'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
