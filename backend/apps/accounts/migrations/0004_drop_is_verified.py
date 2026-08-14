"""
Drop the legacy is_verified boolean column from the users table.

Migration 0003 already added email_verified_at (nullable timestamp) and
migrated existing verified users. The old is_verified column was NOT NULL
with no default, causing IntegrityError on every INSERT because Django's
model no longer includes it as a real field (it is now a Python property
derived from email_verified_at).

This migration removes that column so new registrations succeed.
"""

from typing import ClassVar

from django.db import migrations


class Migration(migrations.Migration):
    dependencies: ClassVar = [
        ("accounts", "0003_remove_user_is_verified_user_email_verified_at"),
    ]

    operations: ClassVar = [
        migrations.RemoveField(
            model_name="user",
            name="is_verified",
        ),
    ]
