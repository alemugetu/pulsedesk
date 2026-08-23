"""
AuditLogService — central audit-recording service for PulseDesk.

Design rules:
- Single entry point: AuditLogService.log(...)
- Fire-and-forget: a logging failure MUST NEVER raise or roll back the
  calling business transaction.  The try/except wrapper around the DB write
  guarantees this.
- Actor is always derived server-side; callers must never pass client-supplied
  actor IDs.
- Organization is always derived server-side from the business object context.
- Metadata (changes dict) must be sanitized before calling this service — no
  passwords, tokens, or secrets.
- System-generated events (SLA monitor, escalation engine) pass actor=None.
- IP address extraction is optional and is only attempted from a request object
  when one is available (HTTP context).

Transaction safety:
  The audit record is created inside the same database transaction as the
  calling business operation.  If the business transaction rolls back, the
  audit record rolls back with it — which is the CORRECT behaviour (we must
  not audit events that did not actually happen).

  The try/except in log() catches unexpected logging errors (e.g. a corrupt
  metadata dict, an unexpected model error) and logs them without re-raising,
  so that an audit infrastructure failure never breaks the primary operation.
"""

import logging

logger = logging.getLogger(__name__)

# Sentinel to represent the system process (SLA monitor, escalation engine)
# when no authenticated user is available.
SYSTEM_ACTOR = None  # stored as NULL in the database


class AuditLogService:
    """
    Central audit-logging service.

    All domain services that perform auditable operations should call
    AuditLogService.log(...) after the primary operation succeeds.
    """

    @staticmethod
    def log(
        organization,
        action: str,
        resource_type: str,
        resource_id: str,
        actor=None,
        changes: dict | None = None,
        request=None,
    ) -> None:
        """
        Record an audit event.

        This method is intentionally resilient: it catches all exceptions so
        that an audit infrastructure failure never rolls back or blocks the
        primary business operation.

        Parameters
        ----------
        organization : Organization
            The tenant that owns this audit record.  Never accepted from
            client input — always passed by the calling service.
        action : str
            A stable AuditAction value, e.g. "incident.created".
        resource_type : str
            The entity class/table, e.g. "incident", "comment".
        resource_id : str
            String primary key of the affected resource.
        actor : User | None
            The authenticated user.  Pass None for system-generated events.
        changes : dict | None
            Safe contextual metadata.  Must not contain secrets.
        request : HttpRequest | None
            If provided, the client IP is extracted for the record.

        Returns
        -------
        None
            Intentionally returns nothing — callers must not depend on the
            return value.
        """
        try:
            from audit_logs.models import AuditLog

            ip_address = None
            if request is not None:
                ip_address = AuditLogService._extract_ip(request)

            AuditLog.objects.create(
                organization=organization,
                actor=actor,
                action=action,
                resource_type=resource_type,
                resource_id=str(resource_id),
                changes=changes or {},
                ip_address=ip_address,
            )
        except Exception:
            # Audit failure must never propagate to the caller.
            logger.exception(
                "AuditLogService.log failed silently — audit record was NOT created. "
                "action=%s resource_type=%s resource_id=%s org=%s",
                action,
                resource_type,
                resource_id,
                getattr(organization, "id", "unknown"),
            )

    # ------------------------------------------------------------------
    # IP address extraction helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_ip(request) -> str | None:
        """
        Extract the client IP from a Django request, respecting common
        reverse-proxy headers.

        Returns None if no valid IP can be determined.
        """
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            # X-Forwarded-For may contain a comma-separated list; take the first.
            ip = x_forwarded_for.split(",")[0].strip()
            return ip or None
        return request.META.get("REMOTE_ADDR") or None
