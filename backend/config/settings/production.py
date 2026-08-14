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

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["127.0.0.1", "localhost"])

# DB_URL must be present in the production environment.
# The production deployment environment provides its own DB_URL pointing
# to the production database — NOT the same as the development Supabase instance.
DATABASES = {
    "default": env.db("DB_URL"),
}

DATABASES["default"].setdefault("OPTIONS", {})
DATABASES["default"]["OPTIONS"].setdefault("sslmode", "require")

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
# Redis must not be publicly exposed; restrict network access in deployment.
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND = env(
    "CELERY_RESULT_BACKEND",
    default=env("CELERY_BROKER_URL"),
)
