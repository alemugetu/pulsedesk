"""
Celery tasks for the common application.

Tasks orchestrate execution only; business logic lives in services.
"""

from __future__ import annotations

import logging

from celery import shared_task
from common.services.health_check import (
    TransientInfrastructureError,
    perform_health_check,
)

logger = logging.getLogger("celery.task")


@shared_task(
    bind=True,
    name="common.health_check",
    autoretry_for=(TransientInfrastructureError,),
    dont_autoretry_for=(ValueError, TypeError),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=3,
)
def health_check_task(self) -> dict[str, str]:
    """
    Infrastructure validation task.

    Safe, idempotent, and does not modify business data. Intended for verifying
    that Celery workers can execute tasks end-to-end.
    """
    try:
        result = perform_health_check()
    except TransientInfrastructureError:
        logger.warning(
            "health_check_task transient failure",
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
            "health_check_task permanent validation failure",
            extra={
                "task_name": self.name,
                "task_id": self.request.id,
                "retry_count": self.request.retries,
                "status": "failure",
            },
        )
        raise

    logger.info(
        "health_check_task completed",
        extra={
            "task_name": self.name,
            "task_id": self.request.id,
            "retry_count": self.request.retries,
            "status": "success",
        },
    )
    return result
