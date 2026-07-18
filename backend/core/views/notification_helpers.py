import re


def extract_notification_context_title(message):
    raw_message = (message or "").strip()
    patterns = [
        r"New group chat message in (?P<title>.+?) from ",
        r"for (?P<title>.+?) group experience",
        r"receiving access for (?P<title>.+?)\.",
        r"for (?P<title>.+?)\.",
        r"for your (?P<title>.+?)\.",
        r"for (?P<title>.+?) was recorded",
    ]

    for pattern in patterns:
        match = re.search(pattern, raw_message)
        if match:
            return (match.group("title") or "").strip()

    return ""


def classify_notification_message(message):
    normalized = (message or "").strip().lower()
    context_title = extract_notification_context_title(message)

    if any(keyword in normalized for keyword in ["wallet", "withdraw", "payout", "top-up", "top up", "payment credited"]):
        return {
            "category": "wallet",
            "category_label": "Wallet",
            "kind": "wallet",
            "icon": "wallet",
            "tone": "wallet",
            "context_title": context_title,
        }

    if any(keyword in normalized for keyword in ["password reset", "otp", "account", "verified successfully"]):
        return {
            "category": "system",
            "category_label": "System",
            "kind": "system",
            "icon": "shield",
            "tone": "system",
            "context_title": context_title,
        }

    if "chat" in normalized:
        return {
            "category": "groups",
            "category_label": "Groups",
            "kind": "chat",
            "icon": "chat",
            "tone": "chat",
            "context_title": context_title,
        }

    if any(keyword in normalized for keyword in ["rating", "review"]):
        return {
            "category": "groups",
            "category_label": "Groups",
            "kind": "review",
            "icon": "star",
            "tone": "review",
            "context_title": context_title,
        }

    if any(keyword in normalized for keyword in ["refund", "purchase proof", "access", "group", "split", "member"]):
        return {
            "category": "groups",
            "category_label": "Groups",
            "kind": "group_update",
            "icon": "bell",
            "tone": "group",
            "context_title": context_title,
        }

    return {
        "category": "system",
        "category_label": "System",
        "kind": "system",
        "icon": "bell",
        "tone": "system",
        "context_title": context_title,
    }


def build_notification_payload(notification):
    metadata = classify_notification_message(notification.message)
    return {
        "id": notification.id,
        "message": notification.message,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
        "category": metadata["category"],
        "category_label": metadata["category_label"],
        "kind": metadata["kind"],
        "icon": metadata["icon"],
        "tone": metadata["tone"],
        "context_title": metadata["context_title"],
        "group_id": getattr(notification, "group_id", None),
    }


__all__ = [
    "extract_notification_context_title",
    "classify_notification_message",
    "build_notification_payload",
]
