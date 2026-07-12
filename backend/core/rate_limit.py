import hashlib
import logging
import math
import time

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


def _normalize_identity(identity):
    raw = (identity or "").strip().lower()
    if not raw:
        return "anonymous"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _build_cache_keys(scope, identity):
    normalized_identity = _normalize_identity(identity)
    base = f"ratelimit:{scope}:{normalized_identity}"
    return f"{base}:count", f"{base}:reset"


# Fail-closed by default for security-sensitive scopes. Override per-scope if needed.
RATE_LIMIT_FAIL_OPEN_SCOPES = set(getattr(settings, "RATE_LIMIT_FAIL_OPEN_SCOPES", []))


def _cache_failure_response(scope, action):
    fail_open = scope in RATE_LIMIT_FAIL_OPEN_SCOPES
    logger.warning(
        "Rate-limit cache unavailable during %s for scope %s. Failing %s.",
        action,
        scope,
        "open (allowed)" if fail_open else "closed (denied)",
    )
    return {
        "allowed": fail_open,
        # When failing closed, tell the client to retry shortly so legitimate users aren't hard-blocked.
        "retry_after_seconds": 0 if fail_open else 30,
        "count": 0,
    }


def get_rate_limit_status(scope, identity):
    try:
        now = int(time.time())
        count_key, reset_key = _build_cache_keys(scope, identity)

        reset_at = cache.get(reset_key)
        if not reset_at or int(reset_at) <= now:
            return {
                "allowed": True,
                "retry_after_seconds": 0,
                "count": 0,
            }

        count = cache.get(count_key) or 0
        return {
            "allowed": True,
            "retry_after_seconds": max(int(reset_at) - now, 0),
            "count": int(count),
        }
    except Exception:
        return _cache_failure_response(scope, "status lookup")


def reset_rate_limit(scope, identity):
    try:
        count_key, reset_key = _build_cache_keys(scope, identity)
        cache.delete_many([count_key, reset_key])
    except Exception:
        logger.warning(
            "Rate-limit cache unavailable during reset for scope %s. Continuing without clearing state.",
            scope,
        )


def check_and_increment_rate_limit(scope, identity, limit, window_seconds):
    try:
        now = int(time.time())
        window_seconds = max(int(window_seconds), 1)

        count_key, reset_key = _build_cache_keys(scope, identity)

        reset_at = cache.get(reset_key)
        if not reset_at or int(reset_at) <= now:
            expires_at = now + window_seconds
            cache.set(count_key, 1, timeout=window_seconds)
            cache.set(reset_key, expires_at, timeout=window_seconds)
            return {
                "allowed": True,
                "retry_after_seconds": 0,
                "count": 1,
            }

        if cache.add(count_key, 1, timeout=window_seconds):
            count = 1
        else:
            try:
                count = cache.incr(count_key)
            except ValueError:
                remaining = max(int(reset_at) - now, 1)
                cache.set(count_key, 1, timeout=remaining)
                count = 1

        if count > limit:
            retry_after = max(int(math.ceil(int(reset_at) - now)), 1)
            return {
                "allowed": False,
                "retry_after_seconds": retry_after,
                "count": count,
            }

        return {
            "allowed": True,
            "retry_after_seconds": max(int(reset_at) - now, 0),
            "count": count,
        }
    except Exception:
        return _cache_failure_response(scope, "increment")
