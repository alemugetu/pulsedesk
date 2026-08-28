from pathlib import Path

import environ

from .base import *

# ---------------------------------------------------------------------------
# Development settings
# ---------------------------------------------------------------------------
DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
env.read_env(BASE_DIR / ".env")

# ---------------------------------------------------------------------------
# CORS — Development
# Explicitly allow Vite dev server origins for local development.
# Supports both default port 5173 and fallback port 5174.
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
]

CORS_ALLOW_CREDENTIALS = True

# Allow common headers for authentication and content negotiation
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

# Allow common HTTP methods
CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

# DB_URL must be present — no silent SQLite fallback.
# A missing or invalid DB_URL will raise ImproperlyConfigured immediately,
# preventing accidental development against the wrong database.
DATABASES = {
    "default": env.db("DB_URL"),
}

# Supabase requires SSL. django-environ parses sslmode from the connection
# string if present; add it explicitly as a safe default for Supabase.
DATABASES["default"].setdefault("OPTIONS", {})
DATABASES["default"]["OPTIONS"].setdefault("sslmode", "require")


# Email configuration

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

EMAIL_HOST = env("EMAIL_HOST")
EMAIL_PORT = env.int("EMAIL_PORT")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS")

EMAIL_HOST_USER = env("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")

DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")

# ---------------------------------------------------------------------------
# Celery — local Redis broker/result backend
# CELERY_BROKER_URL and CELERY_RESULT_BACKEND take precedence.
# REDIS_URL is a convenience fallback for local development only.
# ---------------------------------------------------------------------------
_default_redis_url = env("REDIS_URL", default="redis://127.0.0.1:6379/0")
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default=_default_redis_url)
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default=_default_redis_url)

# ---------------------------------------------------------------------------
# Channels — local Redis channel layer
# Reuses the same Redis instance as Celery for development.
# CHANNEL_LAYERS takes precedence over REDIS_URL.
# ---------------------------------------------------------------------------
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [env("CHANNEL_REDIS_URL", default=_default_redis_url)],
        },
    },
}
