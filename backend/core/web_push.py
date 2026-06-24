import json
import logging

from django.conf import settings

from .models import WebPushSubscription

logger = logging.getLogger(__name__)


def _get_vapid_claims():
    return {
        "sub": getattr(settings, "VAPID_CLAIM_EMAIL", "mailto:officialshareverse@gmail.com"),
    }


def send_web_push_to_user(user_id, notification_payload):
    subscriptions = list(
        WebPushSubscription.objects.filter(user_id=user_id, is_active=True)
        .only("id", "endpoint", "p256dh_key", "auth_key")
        .order_by("id")
    )
    if not subscriptions:
        return {"sent": 0, "inactive": 0}

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush is not installed, skipping web push.")
        return {"sent": 0, "inactive": 0, "error": "pywebpush not installed"}

    vapid_private_key = getattr(settings, "VAPID_PRIVATE_KEY", "")
    if not vapid_private_key:
        logger.warning("VAPID_PRIVATE_KEY is not configured, skipping web push.")
        return {"sent": 0, "inactive": 0, "error": "VAPID key not configured"}

    from .push import build_push_title

    message = (notification_payload or {}).get("message") or "You have a new ShareVerse update."
    title = build_push_title(notification_payload)

    frontend_origin = "https://shareverse.in"
    cors_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
    if cors_origins:
        for origin in cors_origins:
            if "shareverse.in" in origin and "api." not in origin:
                frontend_origin = origin.rstrip("/")
                break

    push_data = json.dumps({
        "title": title,
        "body": message,
        "icon": f"{frontend_origin}/shareverse-notification-icon.png",
        "badge": f"{frontend_origin}/shareverse-notification-badge.png",
        "data": {
            "notification_id": notification_payload.get("id"),
            "category": notification_payload.get("category"),
            "kind": notification_payload.get("kind"),
            "url": "/notifications",
        },
    })

    sent = 0
    inactive_ids = []

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh_key,
                "auth": sub.auth_key,
            },
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=push_data,
                vapid_private_key=vapid_private_key,
                vapid_claims=_get_vapid_claims(),
            )
            sent += 1
        except WebPushException as ex:
            response = getattr(ex, "response", None)
            status_code = response.status_code if response is not None else 0
            if status_code in (404, 410):
                inactive_ids.append(sub.id)
            else:
                logger.warning("Web push failed for sub %s: %s", sub.id, ex)
        except Exception as ex:
            logger.warning("Web push unexpected error for sub %s: %s", sub.id, ex)

    if inactive_ids:
        WebPushSubscription.objects.filter(id__in=inactive_ids).update(is_active=False)

    return {"sent": sent, "inactive": len(inactive_ids)}
