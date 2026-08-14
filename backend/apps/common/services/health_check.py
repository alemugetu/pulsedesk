"""Infrastructure health-check service used by Celery validation tasks."""

from __future__ import annotations


class TransientInfrastructureError(Exception):
    """Raised when a temporary infrastructure failure should trigger a Celery retry."""


def perform_health_check() -> dict[str, str]:
    """
    Run a safe, idempotent infrastructure health check.

    Does not read or modify business data. Safe to execute more than once.
    """
    return {
        "status": "ok",
        "component": "celery",
    }
