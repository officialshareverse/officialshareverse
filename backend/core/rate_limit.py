import hashlib
import math
import time

from django.core.cache import cache


def _normalize_identity(identity):
    raw = (identity or "").strip().lower()
    if not raw:
        return "anonymous"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _build_cache_keys(scope, identity):
    normalized_identity = _normalize_identity(identity)
    base = f"ratelimit:{scope}:{normalized_identity}"
    return f"{base}:count", f"{base}:reset"


def check_and_increment_rate_limit(scope, identity, limit, window_seconds):
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
