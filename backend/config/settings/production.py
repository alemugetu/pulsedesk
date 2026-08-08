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
