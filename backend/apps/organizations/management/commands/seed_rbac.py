from django.core.management.base import BaseCommand
from organizations.models import Organization
from organizations.services import RBACService


class Command(BaseCommand):
    help = "Seed RBAC permissions and system roles for all existing organizations."

    def handle(self, *args, **options):
        self.stdout.write("Seeding permissions...")
        RBACService.seed_permissions()
        self.stdout.write(self.style.SUCCESS("  ✓ Permissions seeded."))

        organizations = Organization.objects.all()
        for org in organizations:
            self.stdout.write(f"  Seeding system roles for: {org.name}")
            RBACService.seed_system_roles(org)

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Seeded system roles for {organizations.count()} organization(s)."
            )
        )
