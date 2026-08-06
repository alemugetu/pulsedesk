from .base import *
from pathlib import Path
import environ

# Production-specific overrides
DEBUG = False

# Production always uses PostgreSQL
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env = environ.Env(
    DATABASE_NAME=(str, 'DB_NAME'),
    DATABASE_USER=(str, 'DB_USER'),
    DATABASE_PASSWORD=(str, 'DB_PASSWORD'),
    DATABASE_HOST=(str, 'DB_HOST'),
    DATABASE_PORT=(int, 5433),
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

