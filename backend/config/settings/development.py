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
