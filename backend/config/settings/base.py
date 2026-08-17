import sys
from pathlib import Path

import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Add project root and apps directory to Python path
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "apps"))

# Initialize environ for base settings
env = environ.Env()

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = "django-insecure-j8mogq#6!+h2hy*_n4lb&=+6ime_**n0f=p*#0kaj1=(sk7#(-"

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    # Local apps
    "common.apps.CommonConfig",
    "api_v1",
    "accounts",
    "organizations",
    "incidents",
    "sla",
    "escalation",
    "notifications.apps.NotificationsConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# DATABASES is intentionally not set here.
# Each environment (development, production, testing) configures its own
# database in the corresponding settings module.

# Custom User Model
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# ---------------------------------------------------------------------------
# Email — shared defaults only
# Each environment overrides EMAIL_BACKEND and credentials.
# ---------------------------------------------------------------------------
DEFAULT_FROM_EMAIL = "PulseDesk <noreply@pulsedesk.io>"

# Email verification / password-reset token lifetimes (seconds)
EMAIL_VERIFICATION_TIMEOUT = 60 * 60 * 24  # 24 hours
PASSWORD_RESET_TIMEOUT = 60 * 60 * 1  # 1 hour (also used by Django's built-in checker)

# Base URL for links in emails.
# In development this is the Django dev server.
# When a frontend is deployed, set FRONTEND_URL in the environment instead
# and update email_services.py to use it.
BACKEND_URL = "http://127.0.0.1:8000"

# Frontend URL for email verification and password reset links
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True

STATIC_URL = "static/"

# Django REST Framework Configuration
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

# drf-spectacular — OpenAPI 3 schema configuration
SPECTACULAR_SETTINGS = {
    "TITLE": "PulseDesk API",
    "DESCRIPTION": (
        "PulseDesk is a multi-tenant incident and escalation operations platform. "
        "This API provides authentication, organization management, and membership "
        "operations. All protected endpoints require a Bearer JWT in the "
        "Authorization header."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # Security scheme — must match the project's actual JWT setup
    "SECURITY": [{"BearerAuth": []}],
    "COMPONENTS": {
        "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": (
                    "Enter your JWT access token. "
                    "Obtain one via POST /api/v1/auth/login/."
                ),
            }
        }
    },
    # Schema quality
    "SORT_OPERATIONS": False,
    "ENUM_GENERATE_CHOICE_DESCRIPTION": True,
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
    ],
    # Contact
    "CONTACT": {"name": "PulseDesk Engineering"},
    # Servers
    "SERVERS": [{"url": "/", "description": "Current server"}],
}

# JWT Configuration
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
}

# ---------------------------------------------------------------------------
# Celery — shared configuration
# Broker and result backend URLs are set per environment (development,
# production, testing). Celery Beat is introduced in Phase 9.
# ---------------------------------------------------------------------------
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = USE_TZ

# Safe JSON serialization only — never use pickle for task payloads.
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]

CELERY_TASK_TRACK_STARTED = True

# Execution limits: most PulseDesk tasks should complete well under 4 minutes.
# Soft limit allows graceful cleanup; hard limit terminates the worker process.
CELERY_TASK_SOFT_TIME_LIMIT = 240
CELERY_TASK_TIME_LIMIT = 300

# Reliability: acknowledge after task completion so unacked tasks are redelivered
# if a worker dies mid-execution. Prefetch=1 avoids one worker hoarding tasks.
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

# Default retry policy for tasks that opt into autoretry_for.
CELERY_TASK_DEFAULT_RETRY_DELAY = 60

# ---------------------------------------------------------------------------
# SLA monitoring — Phase 9
#
# SLA_MONITOR_INTERVAL_SECONDS controls how often Celery Beat dispatches the
# SLA monitoring task.  The default of 60 seconds balances:
#   - SLA accuracy  (breaches detected within ~1 minute of occurrence)
#   - Database load (one lightweight query per minute across all orgs)
#   - Worker load   (iterator-based processing; low memory footprint)
#
# To change it:
#   Set the SLA_MONITOR_INTERVAL_SECONDS environment variable, or override
#   this setting in the environment-specific settings module
#   (e.g. config/settings/production.py).
#
# SLA_WARNING_THRESHOLD controls what fraction of the SLA window must have
# elapsed before a "warning" is logged.  Default: 0.80 (80 % elapsed).
# ---------------------------------------------------------------------------
SLA_MONITOR_INTERVAL_SECONDS: int = env.int("SLA_MONITOR_INTERVAL_SECONDS", default=60)
SLA_WARNING_THRESHOLD: float = env.float("SLA_WARNING_THRESHOLD", default=0.80)

# ---------------------------------------------------------------------------
# Celery Beat periodic schedule
#
# There is ONE authoritative SLA monitoring schedule defined here.
# All environments inherit it; production overrides only the interval via
# SLA_MONITOR_INTERVAL_SECONDS in the environment.
#
# To disable the schedule entirely in a specific environment, set
# CELERY_BEAT_SCHEDULE = {} in that environment's settings module.
# ---------------------------------------------------------------------------
CELERY_BEAT_SCHEDULE = {
    "sla-monitor": {
        "task": "sla.monitor_sla",
        "schedule": SLA_MONITOR_INTERVAL_SECONDS,
        # options: route to a specific queue if desired in production
        # "options": {"queue": "monitoring"},
    },
}

# Use the database scheduler backend for Beat.  This allows the schedule to be
# adjusted at runtime without restarting workers.
# django-celery-beat must be installed: pip install django-celery-beat
# Add "django_celery_beat" to INSTALLED_APPS in the environment settings if
# you want the Django Admin integration.  For static schedules the default
# PersistentScheduler (file-based) is sufficient and requires no extra deps.
# We intentionally leave this unset so that the default PersistentScheduler
# is used — django-celery-beat is not required for Phase 9.

# Logging Configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {asctime} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "django.db.backends": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "celery.task": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
