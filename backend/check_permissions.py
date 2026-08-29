#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from accounts.models import User
from organizations.models import Organization, Membership, Role, Permission

print("=== Permissions in System ===")
permissions = Permission.objects.all()
print(f"Total permissions: {permissions.count()}")
for perm in permissions:
    print(f"  {perm.codename}: {perm.name}")

print("\n=== Roles ===")
roles = Role.objects.all()
print(f"Total roles: {roles.count()}")
for role in roles:
    print(f"  {role.name} ({role.slug})")
    role_perms = role.permissions.all()
    print(f"    Permissions: {role_perms.count()}")
    for perm in role_perms:
        print(f"      - {perm.codename}")

print("\n=== User Memberships ===")
user = User.objects.filter(email='alemugetu78@gmail.com').first()
if user:
    print(f"User: {user.email}")
    memberships = Membership.objects.filter(user=user)
    for membership in memberships:
        print(f"  Organization: {membership.organization.name}")
        print(f"  Role: {membership.role.name if membership.role else 'None'}")
        if membership.role:
            role_perms = membership.role.permissions.all()
            print(f"  Permissions: {[p.codename for p in role_perms]}")
