from .base import *

# Testing-specific overrides
DEBUG = False
ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

# Testing uses SQLite for faster test execution
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Email — never send real email during tests; inspect via django.core.mail.outbox
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
DEFAULT_FROM_EMAIL = "PulseDesk Test <test@pulsedesk.io>"
