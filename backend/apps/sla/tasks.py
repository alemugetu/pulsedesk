"""
Celery tasks for the SLA application 

Architecture:
  Celery Beat → monitor_sla task → SLAMonitoringService.run()
                                         |
                                  SLACalculationService (authoritative SLA)
                                         |
                                  EscalationEvaluationService (authoritative escalation)

The task is intentionally thin — all business logic lives in SLAMonitoringService.
"""

from __future__ import annotations

import logging

from celery import shared_task
from common.services.health_check import TransientInfrastructureError

logger = logging.getLogger("celery.task")


@shared_task(
    bind=True,
    name="sla.monitor_sla",
    autoretry_for=(TransientInfrastructureError,),
    dont_autoretry_for=(ValueError, TypeError),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=3,
)
def monitor_sla(self) -> dict[str, int]:
    """
    Periodic SLA monitoring task.

    Evaluates every active incident with an SLA, updates breach state via the
    authoritative SLA engine, and triggers escalation via the authoritative
    escalation engine when a breach is detected.

    This task is idempotent — it may execute many times for the same incident
    without creating duplicate escalation events (guaranteed by Phase 7
    idempotency layers: select_for_update + DB unique constraint).

    Returns a summary dict suitable for Celery result storage:
        {
            "examined": int,
            "skipped": int,
            "warnings": int,
            "breaches": int,
            "escalations": int,
            "errors": int,
        }
    """
    # Imported here to avoid circular imports at module load time.
    from sla.services import SLAMonitoringService

    try:
        result = SLAMonitoringService.run()
    except TransientInfrastructureError:
        logger.warning(
            "monitor_sla: transient infrastructure failure — retrying",
            extra={
                "task_name": self.name,
                "task_id": self.request.id,
                "retry_count": self.request.retries,
                "status": "retry",
            },
        )
        raise
    except (ValueError, TypeError):
        logger.exception(
            "monitor_sla: permanent validation error — not retrying",
            extra={
                "task_name": self.name,
                "task_id": self.request.id,
                "retry_count": self.request.retries,
                "status": "failure",
            },
        )
        raise

    logger.info(
        "monitor_sla completed",
        extra={
            "task_name": self.name,
            "task_id": self.request.id,
            "retry_count": self.request.retries,
            "status": "success",
            **result.to_dict(),
        },
    )

    return result.to_dict()
