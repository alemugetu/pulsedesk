from .base import *
from pathlib import Path
import environ

# Development-specific overrides
DEBUG = True
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']

# Development uses PostgreSQL if configured, otherwise uses SQLite from base.py
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env = environ.Env(
    DATABASE_NAME=(str, 'DB_NAME'),
    DATABASE_USER=(str, 'DB_USER'),
    DATABASE_PASSWORD=(str, 'DB_PASSWORD'),
    DATABASE_HOST=(str, 'DB_HOST'),
    DATABASE_PORT=(int, 5433),
)
env.read_env(BASE_DIR / '.env')

# Override with PostgreSQL if DATABASE_PASSWORD is provided
if env('DATABASE_PASSWORD', default=None):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': env('DATABASE_NAME'),
            'USER': env('DATABASE_USER'),
            'PASSWORD': env('DATABASE_PASSWORD'),
            'HOST': env('DATABASE_HOST'),
            'PORT': env('DATABASE_PORT'),
        }
    }
