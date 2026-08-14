"""Celery infrastructure tests."""

from __future__ import annotations

import logging
from unittest.mock import MagicMock, patch

from celery.exceptions import Retry
from common.services.dependency_health import check_redis_connectivity
from common.services.health_check import TransientInfrastructureError
from common.tasks import health_check_task
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from config.celery import app as celery_app


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_BROKER_URL="memory://",
    CELERY_RESULT_BACKEND="cache+memory://",
)
class CeleryApplicationTests(TestCase):
    def test_celery_app_imports(self) -> None:
        self.assertEqual(celery_app.main, "config")

    def test_celery_app_discovers_common_tasks(self) -> None:
        self.assertIn("common.health_check", celery_app.tasks)

    def test_health_check_task_executes_successfully(self) -> None:
        result = health_check_task.delay()
        self.assertEqual(result.get(), {"status": "ok", "component": "celery"})

    def test_health_check_task_arguments_are_json_serializable(self) -> None:
        result = health_check_task.apply()
        self.assertIsInstance(result.result, dict)
        self.assertEqual(result.result["status"], "ok")


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_BROKER_URL="memory://",
    CELERY_RESULT_BACKEND="cache+memory://",
)
class CeleryRetryBehaviorTests(TestCase):
    def test_transient_failure_triggers_retry(self) -> None:
        with patch(
            "common.tasks.perform_health_check",
            side_effect=TransientInfrastructureError("redis unavailable"),
        ), self.assertRaises(Retry):
            health_check_task.apply(throw=True)

    def test_validation_error_is_not_retried(self) -> None:
        with patch(
            "common.tasks.perform_health_check",
            side_effect=ValueError("invalid input"),
        ), self.assertRaises(ValueError):
            health_check_task.apply(throw=True)


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_BROKER_URL="memory://",
    CELERY_RESULT_BACKEND="cache+memory://",
)
class CeleryFailureLoggingTests(TestCase):
    def test_failure_logging_does_not_include_secrets(self) -> None:
        secret_token = "super-secret-jwt-token-value"
        logger = logging.getLogger("celery.task")

        with patch.object(logger, "error") as mock_error, patch(
            "common.tasks.perform_health_check",
            side_effect=RuntimeError(secret_token),
        ), self.assertRaises(RuntimeError):
            health_check_task.apply(throw=True)

        logged_messages = " ".join(str(call) for call in mock_error.call_args_list)
        self.assertNotIn(secret_token, logged_messages)


class CeleryConfigurationTests(TestCase):
    def test_testing_settings_do_not_require_real_redis(self) -> None:
        from django.conf import settings

        self.assertTrue(settings.CELERY_TASK_ALWAYS_EAGER)
        self.assertEqual(settings.CELERY_BROKER_URL, "memory://")

    @override_settings(
        CELERY_BROKER_URL="redis://broker.example.com:6379/0",
        CELERY_RESULT_BACKEND="redis://result.example.com:6379/1",
    )
    def test_broker_and_result_backend_loaded_from_settings(self) -> None:
        from django.conf import settings

        self.assertEqual(
            settings.CELERY_BROKER_URL,
            "redis://broker.example.com:6379/0",
        )
        self.assertEqual(
            settings.CELERY_RESULT_BACKEND,
            "redis://result.example.com:6379/1",
        )


class DependencyHealthServiceTests(TestCase):
    def test_redis_connectivity_success(self) -> None:
        mock_client = MagicMock()
        with patch("redis.from_url", return_value=mock_client):
            result = check_redis_connectivity("redis://:secret@localhost:6379/0")

        self.assertEqual(result["status"], "healthy")
        self.assertNotIn("secret", str(result))

    def test_redis_connectivity_failure_sanitizes_credentials(self) -> None:
        with patch("redis.from_url", side_effect=ConnectionError("connection refused")):
            result = check_redis_connectivity("redis://:secret@localhost:6379/0")

        self.assertEqual(result["status"], "unhealthy")
        self.assertNotIn("secret", str(result))


@override_settings(
    CELERY_BROKER_URL="memory://",
    CELERY_RESULT_BACKEND="cache+memory://",
)
class DependencyHealthEndpointTests(APITestCase):
    def test_main_health_endpoint_does_not_check_redis(self) -> None:
        response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "healthy")

    def test_dependency_health_skips_redis_in_test_environment(self) -> None:
        response = self.client.get("/api/v1/health/dependencies/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["dependencies"]["redis"]["status"], "skipped")

    @override_settings(CELERY_BROKER_URL="redis://127.0.0.1:6379/0")
    def test_dependency_health_reports_unhealthy_redis(self) -> None:
        with patch(
            "api_v1.views.check_redis_connectivity",
            return_value={"status": "unhealthy", "message": "ConnectionError"},
        ):
            response = self.client.get("/api/v1/health/dependencies/")

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["status"], "degraded")
