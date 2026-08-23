from django.db import transaction
from organizations.models import (
    Membership,
    MembershipStatus,
    Organization,
    OrganizationStatus,
    Permission,
    Role,
    RolePermission,
)
from rest_framework.exceptions import ValidationError


class OrganizationAccessValidationError(ValidationError):
    """Validation error that preserves a stable code for permission handling."""

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code)
        self.code = code


# ---------------------------------------------------------------------------
# Initial permissions — only for currently implemented functionality
# ---------------------------------------------------------------------------

INITIAL_PERMISSIONS = [
    # Organization
    {
        "codename": "organization.view",
        "name": "View Organization",
        "resource": "organization",
        "action": "view",
        "description": "View organization details.",
    },
    {
        "codename": "organization.update",
        "name": "Update Organization",
        "resource": "organization",
        "action": "update",
        "description": "Update organization name and settings.",
    },
    # Members
    {
        "codename": "member.view",
        "name": "View Members",
        "resource": "member",
        "action": "view",
        "description": "List and view organization members.",
    },
    {
        "codename": "member.invite",
        "name": "Invite Members",
        "resource": "member",
        "action": "invite",
        "description": "Invite new users to the organization.",
    },
    {
        "codename": "member.remove",
        "name": "Remove Members",
        "resource": "member",
        "action": "remove",
        "description": "Remove members from the organization.",
    },
    {
        "codename": "member.suspend",
        "name": "Suspend Members",
        "resource": "member",
        "action": "suspend",
        "description": "Suspend member access to the organization.",
    },
    # Roles
    {
        "codename": "role.view",
        "name": "View Roles",
        "resource": "role",
        "action": "view",
        "description": "List and view roles in the organization.",
    },
    {
        "codename": "role.manage",
        "name": "Manage Roles",
        "resource": "role",
        "action": "manage",
        "description": "Create, update, delete custom roles and assign permissions.",
    },
    {
        "codename": "role.assign",
        "name": "Assign Roles",
        "resource": "role",
        "action": "assign",
        "description": "Assign roles to organization members.",
    },
    # Incidents (Phase 5)
    {
        "codename": "incident.view",
        "name": "View Incidents",
        "resource": "incident",
        "action": "view",
        "description": "View organization incidents and incident categories.",
    },
    {
        "codename": "incident.create",
        "name": "Create Incidents",
        "resource": "incident",
        "action": "create",
        "description": "Create new incidents and categories in the organization.",
    },
    {
        "codename": "incident.update",
        "name": "Update Incidents",
        "resource": "incident",
        "action": "update",
        "description": "Update incident details and status transitions.",
    },
    {
        "codename": "incident.assign",
        "name": "Assign Incidents",
        "resource": "incident",
        "action": "assign",
        "description": "Assign incidents to organization members.",
    },
    {
        "codename": "incident.resolve",
        "name": "Resolve Incidents",
        "resource": "incident",
        "action": "resolve",
        "description": "Mark incidents as resolved.",
    },
    {
        "codename": "incident.close",
        "name": "Close Incidents",
        "resource": "incident",
        "action": "close",
        "description": "Mark incidents as closed.",
    },
    # SLA (Phase 6)
    {
        "codename": "sla.view",
        "name": "View SLA Policies",
        "resource": "sla",
        "action": "view",
        "description": "View SLA policies and targets in the organization.",
    },
    {
        "codename": "sla.manage",
        "name": "Manage SLA Policies",
        "resource": "sla",
        "action": "manage",
        "description": "Create and update SLA policies and targets.",
    },
    # Escalation (Phase 7)
    {
        "codename": "escalation.view",
        "name": "View Escalation Policies",
        "resource": "escalation",
        "action": "view",
        "description": "View escalation policies, levels, rules, and incident escalation history.",
    },
    {
        "codename": "escalation.manage",
        "name": "Manage Escalation Policies",
        "resource": "escalation",
        "action": "manage",
        "description": "Create and update escalation policies, levels, and rules.",
    },
    {
        "codename": "escalation.evaluate",
        "name": "Evaluate Escalations",
        "resource": "escalation",
        "action": "evaluate",
        "description": "Manually trigger escalation evaluation for incidents.",
    },
    # Audit Logs (Phase 13.3)
    {
        "codename": "audit_log.view",
        "name": "View Audit Logs",
        "resource": "audit_log",
        "action": "view",
        "description": "View the organization audit log history.",
    },
    # Reports (Phase 13.5)
    {
        "codename": "report.view",
        "name": "View Reports",
        "resource": "report",
        "action": "view",
        "description": "View operational reports and analytics for the organization.",
    },
]

# ---------------------------------------------------------------------------
# System role permission matrix
# ---------------------------------------------------------------------------

_ALL_PERMISSIONS = {p["codename"] for p in INITIAL_PERMISSIONS}
_BASE_READ_ONLY = {"organization.view", "member.view", "role.view"}
_INCIDENT_VIEW = {"incident.view"}
_INCIDENT_AGENT = _INCIDENT_VIEW | {"incident.create", "incident.update"}
_INCIDENT_FULL = _INCIDENT_AGENT | {
    "incident.assign",
    "incident.resolve",
    "incident.close",
}

# SLA permission sets (Phase 6)
_SLA_VIEW = {"sla.view"}
_SLA_MANAGE = _SLA_VIEW | {"sla.manage"}

# Escalation permission sets (Phase 7)
_ESCALATION_VIEW = {"escalation.view"}
_ESCALATION_MANAGE = _ESCALATION_VIEW | {"escalation.manage", "escalation.evaluate"}

# Audit log permission sets (Phase 13.3)
# Owner, Admin, Operations Manager see audit logs.
# Agent and Viewer do not — audit logs contain sensitive org-wide operational data.
_AUDIT_LOG_VIEW = {"audit_log.view"}

# Report permission sets (Phase 13.5)
# Owner, Admin, Operations Manager, Agent can view reports.
# Viewer cannot — reports contain sensitive operational analytics.
_REPORT_VIEW = {"report.view"}

_VIEWER = _BASE_READ_ONLY | _INCIDENT_VIEW | _SLA_VIEW | _ESCALATION_VIEW
_AGENT = _BASE_READ_ONLY | _INCIDENT_AGENT | _SLA_VIEW | _ESCALATION_VIEW | _REPORT_VIEW
_OPS_MANAGER = (
    _BASE_READ_ONLY
    | {
        "member.invite",
        "member.remove",
        "member.suspend",
        "role.assign",
    }
    | _INCIDENT_FULL
    | _SLA_VIEW
    | _ESCALATION_MANAGE
    | _AUDIT_LOG_VIEW
    | _REPORT_VIEW
)
_ADMIN = (
    _OPS_MANAGER
    | {"organization.update", "role.view", "role.manage"}
    | _INCIDENT_FULL
    | _SLA_MANAGE
    | _ESCALATION_MANAGE
    | _AUDIT_LOG_VIEW
    | _REPORT_VIEW
)
_OWNER = _ALL_PERMISSIONS  # Already includes report.view via INITIAL_PERMISSIONS

SYSTEM_ROLES = [
    {
        "name": "Organization Owner",
        "slug": "organization-owner",
        "description": "Full control over the organization. Only one owner per organization.",
        "permissions": _OWNER,
    },
    {
        "name": "Organization Admin",
        "slug": "organization-admin",
        "description": "Manages members, roles, organization settings, incidents, and can view reports and audit logs.",
        "permissions": _ADMIN,
    },
    {
        "name": "Operations Manager",
        "slug": "operations-manager",
        "description": "Manages members, assigns roles, manages incidents, and can view reports and audit logs. Cannot change org settings.",
        "permissions": _OPS_MANAGER,
    },
    {
        "name": "Agent",
        "slug": "agent",
        "description": "Operational user with read/write access to incidents, read access to org, and access to reports.",
        "permissions": _AGENT,
    },
    {
        "name": "Viewer",
        "slug": "viewer",
        "description": "Read-only access to organization, members, roles, and incidents. No access to reports or audit logs.",
        "permissions": _VIEWER,
    },
]


# ---------------------------------------------------------------------------
# Organization service
# ---------------------------------------------------------------------------


class OrganizationService:
    """Business logic for organization and membership operations."""

    @staticmethod
    def generate_unique_slug(name: str, slug: str | None = None) -> str:
        base_slug = Organization.normalize_slug(slug or name)
        if not base_slug:
            raise OrganizationAccessValidationError(
                {"slug": ["A valid slug could not be generated."]},
                code="invalid_slug",
            )

        candidate = base_slug
        counter = 1
        while Organization.objects.filter(slug=candidate).exists():
            candidate = f"{base_slug}-{counter}"
            counter += 1
        return candidate

    @staticmethod
    @transaction.atomic
    def create_organization(user, name: str, slug: str | None = None) -> Organization:
        if not name or not name.strip():
            raise OrganizationAccessValidationError(
                {"name": ["Organization name is required."]},
                code="invalid_name",
            )

        normalized_slug = OrganizationService.generate_unique_slug(name.strip(), slug)

        organization = Organization.objects.create(
            name=name.strip(),
            slug=normalized_slug,
            status=OrganizationStatus.ACTIVE,
        )

        # Seed system roles for this new organization.
        RBACService.seed_system_roles(organization)

        # Assign the owner role to the founding member.
        owner_role = Role.objects.get(
            organization=organization,
            slug="organization-owner",
            is_system_role=True,
        )
        Membership.objects.create(
            user=user,
            organization=organization,
            role=owner_role,
            status=MembershipStatus.ACTIVE,
        )
        return organization

    @staticmethod
    def validate_organization_access(user, organization: Organization) -> Membership:
        """
        Verify that a user may access an organization.

        Raises ValidationError with codes used by views to map to HTTP responses.
        """
        if organization.status != OrganizationStatus.ACTIVE:
            raise OrganizationAccessValidationError(
                {"detail": "Organization is not accessible."},
                code="organization_inactive",
            )

        try:
            membership = Membership.objects.get(user=user, organization=organization)
        except Membership.DoesNotExist:
            raise OrganizationAccessValidationError(
                {"detail": "Organization not found."},
                code="not_found",
            ) from None

        if membership.status == MembershipStatus.REMOVED:
            raise OrganizationAccessValidationError(
                {"detail": "You do not have access to this organization."},
                code="membership_removed",
            )

        if membership.status == MembershipStatus.SUSPENDED:
            raise OrganizationAccessValidationError(
                {"detail": "Your membership in this organization is suspended."},
                code="membership_suspended",
            )

        if membership.status != MembershipStatus.ACTIVE:
            raise OrganizationAccessValidationError(
                {"detail": "You do not have access to this organization."},
                code="membership_inactive",
            )

        return membership


# ---------------------------------------------------------------------------
# RBAC service
# ---------------------------------------------------------------------------


class RBACService:
    """Business logic for roles and permissions."""

    @staticmethod
    @transaction.atomic
    def seed_permissions() -> None:
        """Create all initial permissions if they don't exist. Idempotent."""
        # Early exit if permissions are already seeded (check if any permission exists)
        if Permission.objects.exists():
            return

        for pdata in INITIAL_PERMISSIONS:
            Permission.objects.get_or_create(
                codename=pdata["codename"],
                defaults={
                    "name": pdata["name"],
                    "resource": pdata["resource"],
                    "action": pdata["action"],
                    "description": pdata["description"],
                },
            )

    @staticmethod
    @transaction.atomic
    def seed_system_roles(organization: Organization) -> None:
        """
        Create system roles with their permissions for an organization.
        Idempotent — safe to call on an org that already has system roles.
        """
        # Ensure all permissions exist first.
        RBACService.seed_permissions()

        for rdata in SYSTEM_ROLES:
            role, _ = Role.objects.get_or_create(
                organization=organization,
                slug=rdata["slug"],
                defaults={
                    "name": rdata["name"],
                    "description": rdata["description"],
                    "is_system_role": True,
                },
            )
            # Attach permissions.
            for codename in rdata["permissions"]:
                try:
                    perm = Permission.objects.get(codename=codename)
                    RolePermission.objects.get_or_create(role=role, permission=perm)
                except Permission.DoesNotExist:
                    pass

    @staticmethod
    @transaction.atomic
    def create_role(
        organization: Organization,
        name: str,
        description: str = "",
        permission_codenames: list[str] | None = None,
        actor_membership: Membership | None = None,
    ) -> Role:
        """
        Create a custom role in an organization.

        actor_membership — the membership of the user performing the action.
        They must have role.manage permission.
        """
        if actor_membership is not None:
            from organizations.selectors import user_has_permission

            if not user_has_permission(
                actor_membership.user, organization, "role.manage"
            ):
                raise OrganizationAccessValidationError(
                    {"detail": "You do not have permission to manage roles."},
                    code="permission_denied",
                )

        if not name or not name.strip():
            raise OrganizationAccessValidationError(
                {"name": ["Role name is required."]},
                code="invalid_name",
            )

        slug = Role.normalize_slug(name.strip())
        if not slug:
            raise OrganizationAccessValidationError(
                {"name": ["Role name could not be slugified."]},
                code="invalid_name",
            )

        if Role.objects.filter(organization=organization, slug=slug).exists():
            raise OrganizationAccessValidationError(
                {
                    "name": [
                        "A role with this name already exists in this organization."
                    ]
                },
                code="duplicate_role",
            )

        role = Role.objects.create(
            organization=organization,
            name=name.strip(),
            slug=slug,
            description=description,
            is_system_role=False,
        )

        if permission_codenames:
            RBACService._attach_permissions(
                role, permission_codenames, actor_membership
            )

        # Audit log
        from audit_logs.models import AuditAction
        from audit_logs.services import AuditLogService

        actor = actor_membership.user if actor_membership else None
        AuditLogService.log(
            organization=organization,
            actor=actor,
            action=AuditAction.ROLE_CREATED,
            resource_type="role",
            resource_id=str(role.id),
            changes={"name": role.name, "slug": role.slug},
        )

        return role

    @staticmethod
    @transaction.atomic
    def update_role(
        role: Role,
        actor_membership: Membership,
        name: str | None = None,
        description: str | None = None,
        permission_codenames: list[str] | None = None,
    ) -> Role:
        from organizations.selectors import user_has_permission

        if not user_has_permission(
            actor_membership.user, role.organization, "role.manage"
        ):
            raise OrganizationAccessValidationError(
                {"detail": "You do not have permission to manage roles."},
                code="permission_denied",
            )

        if role.is_system_role:
            raise OrganizationAccessValidationError(
                {"detail": "System roles cannot be modified."},
                code="system_role_protected",
            )

        if name is not None:
            name = name.strip()
            if not name:
                raise OrganizationAccessValidationError(
                    {"name": ["Role name is required."]},
                    code="invalid_name",
                )
            new_slug = Role.normalize_slug(name)
            existing = Role.objects.filter(
                organization=role.organization, slug=new_slug
            ).exclude(id=role.id)
            if existing.exists():
                raise OrganizationAccessValidationError(
                    {"name": ["A role with this name already exists."]},
                    code="duplicate_role",
                )
            role.name = name
            role.slug = new_slug

        if description is not None:
            role.description = description

        role.save(update_fields=["name", "slug", "description", "updated_at"])

        if permission_codenames is not None:
            RolePermission.objects.filter(role=role).delete()
            RBACService._attach_permissions(
                role, permission_codenames, actor_membership
            )

        # Audit log
        from audit_logs.models import AuditAction
        from audit_logs.services import AuditLogService

        AuditLogService.log(
            organization=role.organization,
            actor=actor_membership.user,
            action=AuditAction.ROLE_UPDATED,
            resource_type="role",
            resource_id=str(role.id),
            changes={"name": role.name},
        )

        return role

    @staticmethod
    @transaction.atomic
    def delete_role(role: Role, actor_membership: Membership) -> None:
        from organizations.selectors import user_has_permission

        if not user_has_permission(
            actor_membership.user, role.organization, "role.manage"
        ):
            raise OrganizationAccessValidationError(
                {"detail": "You do not have permission to manage roles."},
                code="permission_denied",
            )

        if role.is_system_role:
            raise OrganizationAccessValidationError(
                {"detail": "System roles cannot be deleted."},
                code="system_role_protected",
            )

        role_id = str(role.id)
        role_name = role.name
        organization = role.organization
        role.delete()

        # Audit log
        from audit_logs.models import AuditAction
        from audit_logs.services import AuditLogService

        AuditLogService.log(
            organization=organization,
            actor=actor_membership.user,
            action=AuditAction.ROLE_DELETED,
            resource_type="role",
            resource_id=role_id,
            changes={"name": role_name},
        )

    @staticmethod
    @transaction.atomic
    def assign_role_to_membership(
        membership: Membership,
        role: Role | None,
        actor_membership: Membership,
    ) -> Membership:
        """
        Assign (or remove) a role from a membership.

        Security invariants enforced:
        - Actor must have role.assign permission in the organization.
        - The role must belong to the same organization as the membership.
        - The owner role may only be transferred by the current owner (not self-granted).
        - An owner cannot remove their own role if they are the sole owner.
        """
        from organizations.selectors import user_has_permission

        organization = membership.organization

        if not user_has_permission(actor_membership.user, organization, "role.assign"):
            raise OrganizationAccessValidationError(
                {"detail": "You do not have permission to assign roles."},
                code="permission_denied",
            )

        if role is not None and role.organization_id != organization.pk:
            raise OrganizationAccessValidationError(
                {"detail": "Role does not belong to this organization."},
                code="cross_tenant_role",
            )

        # Prevent owner self-elevation: a non-owner cannot assign the owner role.
        if role is not None and role.slug == "organization-owner":
            actor_role = actor_membership.role
            if actor_role is None or actor_role.slug != "organization-owner":
                raise OrganizationAccessValidationError(
                    {
                        "detail": "Only the organization owner can assign the owner role."
                    },
                    code="owner_escalation",
                )

        # Prevent sole-owner from removing their own owner role.
        if (  # noqa: SIM102
            membership.role is not None and membership.role.slug == "organization-owner"
        ):
            if role is None or role.slug != "organization-owner":
                owner_count = Membership.objects.filter(
                    organization=organization,
                    status=MembershipStatus.ACTIVE,
                    role__slug="organization-owner",
                ).count()
                if owner_count <= 1:
                    raise OrganizationAccessValidationError(
                        {
                            "detail": (
                                "Cannot remove the sole owner. "
                                "Transfer ownership before changing this role."
                            )
                        },
                        code="sole_owner_protected",
                    )

        membership.role = role
        membership.save(update_fields=["role", "updated_at"])

        # Audit log
        from audit_logs.models import AuditAction
        from audit_logs.services import AuditLogService

        AuditLogService.log(
            organization=organization,
            actor=actor_membership.user,
            action=AuditAction.ROLE_ASSIGNED,
            resource_type="membership",
            resource_id=str(membership.id),
            changes={
                "membership_user_id": str(membership.user_id),
                "new_role_id": str(role.id) if role else None,
                "new_role_name": role.name if role else None,
            },
        )

        return membership

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _attach_permissions(
        role: Role,
        codenames: list[str],
        actor_membership: Membership | None,
    ) -> None:
        """
        Attach a list of permissions to a role.
        Actor may only attach permissions that exist.
        """
        permissions = Permission.objects.filter(codename__in=codenames)
        found = {p.codename for p in permissions}
        unknown = set(codenames) - found
        if unknown:
            raise OrganizationAccessValidationError(
                {"permissions": [f"Unknown permissions: {sorted(unknown)}"]},
                code="unknown_permissions",
            )

        for perm in permissions:
            RolePermission.objects.get_or_create(role=role, permission=perm)
