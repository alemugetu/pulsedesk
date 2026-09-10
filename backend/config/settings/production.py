from pathlib import Path

import environ

from .base import *

# ---------------------------------------------------------------------------
# Production settings
# ---------------------------------------------------------------------------
DEBUG = False

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
env.read_env(BASE_DIR / ".env")

# In production, SECRET_KEY must come from the environment.
SECRET_KEY = env("SECRET_KEY")

ALLOWED_HOSTS = env.list(
    "ALLOWED_HOSTS",
    default=["127.0.0.1", "localhost", ".onrender.com"],
)

# ---------------------------------------------------------------------------
# Database — Render Managed PostgreSQL (or external DB_URL)
# DB_URL is automatically injected by Render from pulsedesk-db.
# Uses 'prefer' as default sslmode so both internal Render private network
# connections and SSL-enforced connections work smoothly.
# ---------------------------------------------------------------------------
DATABASES = {
    "default": env.db("DB_URL"),
}

DATABASES["default"].setdefault("OPTIONS", {})
DATABASES["default"]["OPTIONS"].setdefault(
    "sslmode", env("DB_SSLMODE", default="prefer")
)

# ---------------------------------------------------------------------------
# Static Files & WhiteNoise
# WhiteNoise enables the production ASGI server (Daphne) to serve static files
# without requiring an external web server or Nginx.
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Insert WhiteNoiseMiddleware directly after SecurityMiddleware
MIDDLEWARE = list(MIDDLEWARE)
if "whitenoise.middleware.WhiteNoiseMiddleware" not in MIDDLEWARE:
    try:
        sec_idx = MIDDLEWARE.index("django.middleware.security.SecurityMiddleware")
        MIDDLEWARE.insert(sec_idx + 1, "whitenoise.middleware.WhiteNoiseMiddleware")
    except ValueError:
        MIDDLEWARE.insert(0, "whitenoise.middleware.WhiteNoiseMiddleware")

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# ---------------------------------------------------------------------------
# Security & Reverse Proxy (Render terminates SSL at its load balancer)
# ---------------------------------------------------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# ---------------------------------------------------------------------------
# CORS & CSRF — Production
# Allows cross-origin API and WebSocket communication from the Vercel frontend.
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

# ---------------------------------------------------------------------------
# Email — production SMTP (all values from environment, no hard-coded defaults)
# ---------------------------------------------------------------------------
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env("EMAIL_HOST")
EMAIL_PORT = env.int("EMAIL_PORT")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS")
EMAIL_HOST_USER = env("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")

# ---------------------------------------------------------------------------
# Celery — production Redis (credentials from environment only)
# Supports CELERY_BROKER_URL with fallback to REDIS_URL (Render default)
# ---------------------------------------------------------------------------
_default_redis = env("REDIS_URL", default="")
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default=_default_redis)
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default=CELERY_BROKER_URL)

# ---------------------------------------------------------------------------
# Channels — production Redis channel layer
# Reuses the same Redis instance as Celery for production.
# ---------------------------------------------------------------------------
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [env("CHANNEL_REDIS_URL", default=CELERY_BROKER_URL)],
        },
    },
}
