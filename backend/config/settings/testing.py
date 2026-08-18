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

# ---------------------------------------------------------------------------
# Celery — deterministic in-process execution (no real Redis required)
# ---------------------------------------------------------------------------
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"

# ---------------------------------------------------------------------------
# Channels — in-memory channel layer for testing
# Uses channels.layers.InMemoryChannelLayer for deterministic test execution.
# ---------------------------------------------------------------------------
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}
