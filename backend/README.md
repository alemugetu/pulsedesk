# PulseDesk Backend

Backend service for PulseDesk.

## Technology Stack

- Django
- Django REST Framework
- PostgreSQL
- Redis
- Celery

## Status

- Phase 1 — Backend Foundation: complete
- Phase 2 — Authentication & Identity Foundation: complete
- Phase 8 — Asynchronous Processing Infrastructure: complete

See [docs/celery.md](docs/celery.md) for Celery/Redis setup, worker startup, and testing.

## Authentication (Phase 2)

Base path: `/api/v1/auth/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register/` | Public | Create a user account |
| POST | `/login/` | Public | Obtain JWT access and refresh tokens |
| POST | `/token/refresh/` | Public | Refresh an access token |
| POST | `/logout/` | Required | Invalidate a refresh token |
| GET | `/me/` | Required | Return the authenticated user profile |

### JWT strategy

- Access tokens expire after 1 hour; refresh tokens expire after 1 day.
- Refresh token rotation and blacklisting are enabled via `rest_framework_simplejwt.token_blacklist`.
- JWT signing uses the project `SECRET_KEY` from environment-based settings.

### Logout strategy

Logout accepts a refresh token and blacklists it server-side. Access tokens cannot be revoked before expiry without a separate denylist mechanism; clients must discard both tokens locally after logout. Subsequent refresh attempts with a blacklisted token are rejected.

### `/me/` response

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "is_active": true
}
```

Passwords, password hashes, and internal security metadata are never exposed in API responses.
