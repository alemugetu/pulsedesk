from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from incidents.models import (
    Incident,
    IncidentCategory,
    IncidentPriority,
    IncidentStatus,
)
from incidents.selectors import get_category
from organizations.models import Membership, MembershipStatus, Organization
from organizations.selectors import user_has_permission
from rest_framework.exceptions import ValidationError


class IncidentValidationError(ValidationError):
    """Validation error that preserves a stable error code."""

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code)
        self.code = code


ALLOWED_TRANSITIONS = {
    IncidentStatus.OPEN: {IncidentStatus.ACKNOWLEDGED},
    IncidentStatus.ACKNOWLEDGED: {IncidentStatus.IN_PROGRESS},
    IncidentStatus.IN_PROGRESS: {IncidentStatus.RESOLVED},
    IncidentStatus.RESOLVED: {IncidentStatus.CLOSED},
    IncidentStatus.CLOSED: set(),
}

REQUIRED_PERMISSIONS_FOR_STATUS = {
    IncidentStatus.ACKNOWLEDGED: "incident.update",
    IncidentStatus.IN_PROGRESS: "incident.update",
    IncidentStatus.RESOLVED: "incident.resolve",
    IncidentStatus.CLOSED: "incident.close",
}


class CategoryService:
    """Business logic for Incident Categories."""

    @staticmethod
    def generate_unique_slug(
        organization: Organization, name: str, slug: str | None = None
    ) -> str:
        base_slug = IncidentCategory.normalize_slug(slug or name)
        if not base_slug:
            raise IncidentValidationError(
                {"slug": ["A valid category slug could not be generated."]},
                code="invalid_slug",
            )

        candidate = base_slug
        counter = 1
        while IncidentCategory.objects.filter(
            organization=organization, slug=candidate
        ).exists():
            candidate = f"{base_slug}-{counter}"
            counter += 1
        return candidate

    @staticmethod
    @transaction.atomic
    def create_category(
        organization: Organization,
        name: str,
        slug: str | None = None,
        description: str = "",
    ) -> IncidentCategory:
        clean_name = name.strip() if name else ""
        if not clean_name:
            raise IncidentValidationError(
                {"name": ["Category name is required."]},
                code="invalid_name",
            )

        if IncidentCategory.objects.filter(
            organization=organization, name__iexact=clean_name
        ).exists():
            raise IncidentValidationError(
                {
                    "name": [
                        "A category with this name already exists in this organization."
                    ]
                },
                code="duplicate_name",
            )

        unique_slug = CategoryService.generate_unique_slug(
            organization, clean_name, slug
        )

        return IncidentCategory.objects.create(
            organization=organization,
            name=clean_name,
            slug=unique_slug,
            description=description.strip() if description else "",
            is_active=True,
        )

    @staticmethod
    @transaction.atomic
    def update_category(
        category: IncidentCategory,
        name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
    ) -> IncidentCategory:
        if name is not None:
            clean_name = name.strip()
            if not clean_name:
                raise IncidentValidationError(
                    {"name": ["Category name cannot be empty."]},
                    code="invalid_name",
                )
            if (
                IncidentCategory.objects.filter(
                    organization=category.organization, name__iexact=clean_name
                )
                .exclude(id=category.id)
                .exists()
            ):
                raise IncidentValidationError(
                    {
                        "name": [
                            "A category with this name already exists in this organization."
                        ]
                    },
                    code="duplicate_name",
                )
            category.name = clean_name

        if description is not None:
            category.description = description.strip()

        if is_active is not None:
            category.is_active = is_active

        category.save()
        return category


class IncidentService:
    """Business logic for Incident management."""

    @staticmethod
    def generate_next_incident_number(organization: Organization) -> str:
        """
        Generate sequential incident number INC-000001 per organization.
        Must be called within an atomic block.
        """
        # Lock organization row to guarantee safe sequential numbering under concurrency
        Organization.objects.select_for_update().get(id=organization.id)
        count = Incident.objects.filter(organization=organization).count()
        next_num = count + 1

        candidate = f"INC-{next_num:06d}"
        while Incident.objects.filter(
            organization=organization, incident_number=candidate
        ).exists():
            next_num += 1
            candidate = f"INC-{next_num:06d}"

        return candidate

    @staticmethod
    @transaction.atomic
    def create_incident(
        organization: Organization,
        reporter_user,
        title: str,
        description: str = "",
        category_id: str | None = None,
        priority: str = IncidentPriority.P3,
        assignee_membership_id: str | None = None,
    ) -> Incident:
        clean_title = title.strip() if title else ""
        if not clean_title:
            raise IncidentValidationError(
                {"title": ["Incident title is required."]},
                code="invalid_title",
            )

        # Validate reporter active membership in organization
        try:
            Membership.objects.get(
                user=reporter_user,
                organization=organization,
                status=MembershipStatus.ACTIVE,
            )
        except Membership.DoesNotExist:
            raise IncidentValidationError(
                {
                    "reporter": [
                        "Reporter must be an active member of this organization."
                    ]
                },
                code="invalid_reporter",
            ) from None

        # Validate Category scoping if provided
        category = None
        if category_id:
            category = get_category(organization, category_id)
            if not category or not category.is_active:
                raise IncidentValidationError(
                    {
                        "category": [
                            "Category does not belong to this organization or is inactive."
                        ]
                    },
                    code="invalid_category",
                )

        # Validate Assignee scoping if provided
        assignee_membership = None
        if assignee_membership_id:
            try:
                assignee_membership = Membership.objects.get(
                    id=assignee_membership_id,
                    organization=organization,
                    status=MembershipStatus.ACTIVE,
                )
            except (
                Membership.DoesNotExist,
                DjangoValidationError,
                TypeError,
                ValueError,
            ):
                raise IncidentValidationError(
                    {
                        "assignee": [
                            "Assignee must be an active member of this organization."
                        ]
                    },
                    code="invalid_assignee",
                ) from None

        # Validate Priority choice
        if priority not in IncidentPriority.values:
            raise IncidentValidationError(
                {"priority": [f"Invalid priority choice '{priority}'."]},
                code="invalid_priority",
            )

        incident_number = IncidentService.generate_next_incident_number(organization)

        incident = Incident.objects.create(
            organization=organization,
            incident_number=incident_number,
            title=clean_title,
            description=description.strip() if description else "",
            status=IncidentStatus.OPEN,
            priority=priority,
            category=category,
            reporter=reporter_user,
            assignee=assignee_membership,
            resolved_at=None,
        )

        # Calculate and attach SLA if an active default policy exists.
        # Intentionally imported here to avoid circular imports at module level.
        # If no policy is configured this is a no-op — incident creation never fails.
        from sla.services import SLACalculationService

        SLACalculationService.calculate_incident_sla(incident)

        # Publish realtime event after successful transaction
        from realtime.services import RealtimeEventService

        RealtimeEventService.publish_incident_created(incident)

        return incident

    @staticmethod
    @transaction.atomic
    def update_incident(
        incident: Incident,
        actor_membership: Membership,
        title: str | None = None,
        description: str | None = None,
        category_id: str | None = None,
        priority: str | None = None,
    ) -> Incident:
        if not user_has_permission(
            actor_membership.user, incident.organization, "incident.update"
        ):
            raise IncidentValidationError(
                {"detail": "You do not have permission to update incidents."},
                code="permission_denied",
            )

        if title is not None:
            clean_title = title.strip()
            if not clean_title:
                raise IncidentValidationError(
                    {"title": ["Incident title cannot be empty."]},
                    code="invalid_title",
                )
            incident.title = clean_title

        if description is not None:
            incident.description = description.strip()

        if category_id is not None:
            if category_id == "" or category_id is None:
                incident.category = None
            else:
                cat = get_category(incident.organization, category_id)
                if not cat or not cat.is_active:
                    raise IncidentValidationError(
                        {
                            "category": [
                                "Category does not belong to this organization or is inactive."
                            ]
                        },
                        code="invalid_category",
                    )
                incident.category = cat

        if priority is not None:
            if priority not in IncidentPriority.values:
                raise IncidentValidationError(
                    {"priority": [f"Invalid priority choice '{priority}'."]},
                    code="invalid_priority",
                )
            incident.priority = priority

        incident.save()

        # Publish realtime event after successful transaction
        from realtime.services import RealtimeEventService

        RealtimeEventService.publish_incident_updated(incident)

        return incident

    @staticmethod
    @transaction.atomic
    def assign_incident(
        incident: Incident,
        actor_membership: Membership,
        assignee_membership: Membership | None,
    ) -> Incident:
        if not user_has_permission(
            actor_membership.user, incident.organization, "incident.assign"
        ):
            raise IncidentValidationError(
                {"detail": "You do not have permission to assign incidents."},
                code="permission_denied",
            )

        if assignee_membership is not None and (
            assignee_membership.organization != incident.organization
            or assignee_membership.status != MembershipStatus.ACTIVE
        ):
            raise IncidentValidationError(
                {
                    "assignee": [
                        "Assignee must be an active member of this organization."
                    ]
                },
                code="invalid_assignee",
            )

        incident.assignee = assignee_membership
        incident.save()

        # Publish realtime event after successful transaction
        from realtime.services import RealtimeEventService

        RealtimeEventService.publish_incident_assigned(
            incident, str(assignee_membership.id) if assignee_membership else None
        )

        return incident

    @staticmethod
    @transaction.atomic
    def transition_incident_status(
        incident: Incident,
        actor_membership: Membership,
        new_status: str,
    ) -> Incident:
        old_status = incident.status

        if new_status == incident.status:
            return incident

        if new_status not in IncidentStatus.values:
            raise IncidentValidationError(
                {"status": [f"Invalid status choice '{new_status}'."]},
                code="invalid_status",
            )

        allowed = ALLOWED_TRANSITIONS.get(incident.status, set())
        if new_status not in allowed:
            raise IncidentValidationError(
                {
                    "status": [
                        f"Cannot transition incident status from {incident.status} to {new_status}."
                    ]
                },
                code="invalid_status_transition",
            )

        required_perm = REQUIRED_PERMISSIONS_FOR_STATUS.get(
            new_status, "incident.update"
        )
        if not user_has_permission(
            actor_membership.user, incident.organization, required_perm
        ):
            raise IncidentValidationError(
                {
                    "detail": f"You do not have permission to perform '{required_perm}' on this incident."
                },
                code="permission_denied",
            )

        incident.status = new_status
        if (
            new_status in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}
            and incident.resolved_at is None
        ):
            incident.resolved_at = timezone.now()

        incident.save()

        # SLA completion hooks — must run inside the same transaction.
        # Imported here to avoid circular imports at module level.
        from sla.services import SLACalculationService

        if new_status == IncidentStatus.ACKNOWLEDGED:
            # OPEN → ACKNOWLEDGED: mark response SLA as completed.
            SLACalculationService.complete_response_sla(incident)

        elif new_status == IncidentStatus.RESOLVED:
            # IN_PROGRESS → RESOLVED: mark resolution SLA as completed.
            SLACalculationService.complete_resolution_sla(incident)

        # Publish realtime event after successful transaction
        from realtime.services import RealtimeEventService

        RealtimeEventService.publish_incident_status_changed(
            incident, old_status, new_status
        )

        return incident
