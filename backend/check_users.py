#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from accounts.models import User
from organizations.models import Organization, Membership

print("=== Users ===")
users = User.objects.all()
print(f"Total users: {users.count()}")
for user in users:
    print(f"  {user.email} ({user.id})")

print("\n=== Memberships ===")
memberships = Membership.objects.all()
print(f"Total memberships: {memberships.count()}")
for membership in memberships:
    print(f"  User: {membership.user.email}, Org: {membership.organization.name}, Status: {membership.status}, Role: {membership.role}")

print("\n=== Organization ===")
org = Organization.objects.first()
print(f"Organization: {org.name} ({org.id})")
