import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User

u = User.objects.get(email='admin@pulsedesk.com')
u.set_password('AdminPassword123!')
u.save()
print('Password set successfully for admin@pulsedesk.com')
