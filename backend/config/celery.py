"""
Celery application for PulseDesk.

Loaded by Django via config/__init__.py so that @shared_task decorators bind to
this app without circular imports.
"""

from __future__ import annotations

import logging
import os

from celery import Celery
from celery.signals import task_failure, task_postrun, task_prerun  # type: ignore

logger = logging.getLogger("celery.task")

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("config")
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all INSTALLED_APPS.
# Celery will look for a tasks.py module inside each app package.
app.autodiscover_tasks()


def _safe_task_context(
    task_id: str | None, task_name: str | None, retries: int | None
) -> dict:
    """Build structured log context without sensitive payload data."""
    return {
        "task_id": task_id,
        "task_name": task_name,
        "retry_count": retries if retries is not None else 0,
    }


@task_prerun.connect
def task_prerun_handler(
    task_id: str | None = None,
    task: object | None = None,
    **kwargs: object,
) -> None:
    task_name = getattr(task, "name", None)
    retries = getattr(getattr(task, "request", None), "retries", 0)
    logger.info(
        "Task starting",
        extra={**_safe_task_context(task_id, task_name, retries), "status": "started"},
    )


@task_postrun.connect
def task_postrun_handler(
    task_id: str | None = None,
    task: object | None = None,
    state: str | None = None,
    **kwargs: object,
) -> None:
    task_name = getattr(task, "name", None)
    retries = getattr(getattr(task, "request", None), "retries", 0)
    logger.info(
        "Task finished",
        extra={
            **_safe_task_context(task_id, task_name, retries),
            "status": state or "unknown",
        },
    )


def _retry_count(value: object) -> int:
    if isinstance(value, int):
        return value
    return 0


@task_failure.connect
def task_failure_handler(
    task_id: str | None = None,
    exception: BaseException | None = None,
    sender: object | None = None,
    **kwargs: object,
) -> None:
    task_name = getattr(sender, "name", None)
    retries = kwargs.get("retries")
    if retries is None:
        retries = getattr(getattr(sender, "request", None), "retries", 0)

    logger.error(
        "Task failed: %s",
        exception,
        extra={
            **_safe_task_context(task_id, task_name, _retry_count(retries)),
            "status": "failure",
        },
        exc_info=exception is not None,
    )
