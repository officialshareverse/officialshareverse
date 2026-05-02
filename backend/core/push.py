from django.utils import timezone

import requests

from .models import MobilePushDevice

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"


def build_push_title(notification_payload):
    context_title = (notification_payload or {}).get("context_title") or ""
    category_label = (notification_payload or {}).get("category_label") or "ShareVerse"

    if context_title:
        return f"{category_label}: {context_title}"
    return category_label


def send_push_notification_to_user(user_id, notification_payload):
    devices = list(
        MobilePushDevice.objects.filter(user_id=user_id, is_active=True)
        .only("id", "expo_push_token", "platform")
        .order_by("id")
    )
    if not devices:
        return {"sent": 0, "inactive": 0}

    message = (notification_payload or {}).get("message") or "You have a new ShareVerse update."
    title = build_push_title(notification_payload)
    push_data = {
        "notification_id": notification_payload.get("id"),
        "category": notification_payload.get("category"),
        "kind": notification_payload.get("kind"),
        "context_title": notification_payload.get("context_title"),
    }
    payload = [
        {
            "to": device.expo_push_token,
            "title": title,
            "body": message,
            "sound": "default",
            "priority": "high",
            "data": push_data,
        }
        for device in devices
    ]

    try:
        response = requests.post(
            EXPO_PUSH_API_URL,
            json=payload,
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            timeout=8,
        )
        response.raise_for_status()
        response_payload = response.json()
    except Exception as exc:
        MobilePushDevice.objects.filter(id__in=[device.id for device in devices]).update(
            last_error=str(exc)[:500]
        )
        return {"sent": 0, "inactive": 0, "error": str(exc)}

    results = response_payload.get("data") or []
    success_ids = []
    inactive_ids = []
    error_updates = {}

    for index, device in enumerate(devices):
        ticket = results[index] if index < len(results) else {}
        if ticket.get("status") == "ok":
            success_ids.append(device.id)
            continue

        details = ticket.get("details") or {}
        error_value = (
            details.get("error")
            or ticket.get("message")
            or ticket.get("status")
            or "Push send failed."
        )
        error_updates[device.id] = str(error_value)[:500]
        if details.get("error") == "DeviceNotRegistered":
            inactive_ids.append(device.id)

    now = timezone.now()
    if success_ids:
        MobilePushDevice.objects.filter(id__in=success_ids).update(
            last_notified_at=now,
            last_error="",
        )
    for device_id, error_value in error_updates.items():
        MobilePushDevice.objects.filter(id=device_id).update(last_error=error_value)
    if inactive_ids:
        MobilePushDevice.objects.filter(id__in=inactive_ids).update(is_active=False)

    return {
        "sent": len(success_ids),
        "inactive": len(inactive_ids),
        "errors": len(error_updates),
    }
