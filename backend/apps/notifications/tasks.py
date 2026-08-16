"""
Celery Tasks for Notification Delivery — Phase 10

Asynchronous notification delivery tasks.

Design decisions:
- Tasks remain thin and delegate to the delivery dispatcher.
- Retry behavior is configured for temporary failures (SMTP issues, network timeouts).
- Permanent failures are not retried indefinitely.
- Tasks are idempotent - duplicate executions will not cause duplicate deliveries.
"""

import logging

from celery import shared_task
from celery.utils.log import get_task_logger

from .delivery import DeliveryDispatcher
from .models import DeliveryStatus, Notification, NotificationDelivery

logger = get_task_logger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # 1 minute between retries
)
def deliver_notification_task(self, notification_id: str, channels: list[str]) -> dict:
    """
    Deliver a notification through specified channels.

    This task is enqueued after the notification transaction commits.
    It uses the delivery dispatcher to execute delivery through each channel.

    Args:
        notification_id: The notification ID to deliver
        channels: List of channel identifiers to deliver through

    Returns:
        Dictionary with delivery results per channel

    Raises:
        Notification.DoesNotExist: If notification was deleted
    """
    try:
        # Fetch notification
        notification = Notification.objects.get(id=notification_id)

        logger.info(
            f"Delivering notification {notification_id} through channels: {channels}"
        )

        # Use delivery dispatcher to deliver
        dispatcher = DeliveryDispatcher()
        results = dispatcher.deliver(notification, channels)

        # Log results
        for channel, success in results.items():
            status = "SENT" if success else "FAILED"
            logger.info(
                f"Notification {notification_id} delivery to {channel}: {status}"
            )

        return results

    except Notification.DoesNotExist:
        logger.error(f"Notification {notification_id} not found for delivery")
        raise

    except Exception as exc:
        # Check if this is a retryable error
        if is_retryable_error(exc):
            # Increment retry count and retry
            retry_count = self.request.retries + 1
            logger.warning(
                f"Notification {notification_id} delivery failed (attempt {retry_count}), "
                f"retrying in 60 seconds. Error: {exc}"
            )
            raise self.retry(exc=exc)

        # Non-retryable error - mark as failed
        logger.error(
            f"Notification {notification_id} delivery failed permanently: {exc}"
        )
        raise


def is_retryable_error(error: Exception) -> bool:
    """
    Determine if an error is retryable.

    Retryable errors include:
    - Network timeouts
    - Temporary SMTP failures
    - Temporary provider issues

    Non-retryable errors include:
    - Invalid recipient
    - Template errors
    - Configuration errors
    - Permission errors

    Args:
        error: The exception to evaluate

    Returns:
        True if error should be retried, False otherwise
    """
    retryable_error_types = (
        ConnectionError,
        TimeoutError,
        OSError,
    )

    # Check for specific retryable error types
    if isinstance(error, retryable_error_types):
        return True

    # Check for SMTP-specific retryable errors
    error_message = str(error).lower()
    retryable_keywords = [
        "timeout",
        "connection",
        "temporary",
        "try again later",
        "service unavailable",
    ]

    for keyword in retryable_keywords:
        if keyword in error_message:
            return True

    return False


@shared_task
def retry_failed_deliveries() -> int:
    """
    Retry failed notification deliveries.

    This task can be scheduled periodically to retry deliveries that failed
    due to temporary issues. It only retries deliveries that haven't exceeded
    the maximum retry count.

    Returns:
        Number of deliveries retried
    """
    max_retries = 3

    # Find failed deliveries with retry count below max
    failed_deliveries = NotificationDelivery.objects.filter(
        status=DeliveryStatus.FAILED,
        retry_count__lt=max_retries,
    )

    retried_count = 0

    for delivery in failed_deliveries:
        try:
            # Increment retry count
            delivery.increment_retry()

            # Reset status to pending
            delivery.status = DeliveryStatus.PENDING
            delivery.save(update_fields=["status"])

            # Re-enqueue delivery
            deliver_notification_task.delay(
                str(delivery.notification_id),
                [delivery.channel],
            )

            retried_count += 1

        except Exception as exc:
            logger.error(f"Failed to retry delivery {delivery.id}: {exc}")

    logger.info(f"Retried {retried_count} failed deliveries")
    return retried_count
