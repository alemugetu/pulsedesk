"""Dependency health probes for operational monitoring."""

from __future__ import annotations

from urllib.parse import urlparse

import redis


def _sanitize_redis_url(redis_url: str) -> str:
    """Return a Redis URL with credentials removed for safe logging/responses."""
    parsed = urlparse(redis_url)
    host = parsed.hostname or "unknown"
    port = parsed.port or 6379
    db = parsed.path.lstrip("/") or "0"
    return f"redis://{host}:{port}/{db}"


def check_redis_connectivity(redis_url: str) -> dict[str, object]:
    """
    Probe Redis broker connectivity.

    Returns a structured result suitable for dependency health endpoints.
    Does not expose credentials in error messages.
    """
    safe_url = _sanitize_redis_url(redis_url)

    try:
        client = redis.from_url(redis_url, socket_connect_timeout=2)
        client.ping()
        return {
            "status": "healthy",
            "endpoint": safe_url,
        }
    except (redis.ConnectionError, redis.TimeoutError, OSError) as exc:
        return {
            "status": "unhealthy",
            "endpoint": safe_url,
            "message": type(exc).__name__,
        }
