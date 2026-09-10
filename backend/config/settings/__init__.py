import os

if os.environ.get("RENDER") or os.environ.get("DJANGO_ENV") == "production":
    from .production import *
else:
    from .development import *

