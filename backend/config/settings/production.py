from .base import *
from pathlib import Path
import environ

# Production-specific overrides
DEBUG = False

# Production always uses PostgreSQL
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env = environ.Env(
    DATABASE_NAME=(str, 'pulsedesk_db'),
    DATABASE_USER=(str, 'pulsedesk_user'),
    DATABASE_PASSWORD=(str, ''),
    DATABASE_HOST=(str, 'localhost'),
    DATABASE_PORT=(int, 5432),
)
env.read_env(BASE_DIR / '.env')

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['127.0.0.1', 'localhost'])

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

