import hashlib


def build_razorpay_webhook_event_id(raw_body, event_type="", payment_id="", provider_order_id="", provided_id=""):
    normalized_provided_id = (provided_id or "").strip()
    if normalized_provided_id:
        return normalized_provided_id[:120]

    fingerprint = hashlib.sha256(raw_body).hexdigest()[:24]
    return f"{event_type}:{payment_id}:{provider_order_id}:{fingerprint}"[:120]


def build_razorpayx_webhook_event_id(raw_body, event_type="", payout_id="", provided_id=""):
    normalized_provided_id = (provided_id or "").strip()
    if normalized_provided_id:
        return normalized_provided_id[:120]

    fingerprint = hashlib.sha256(raw_body).hexdigest()[:24]
    return f"{event_type}:{payout_id}:{fingerprint}"[:120]


__all__ = [
    "build_razorpay_webhook_event_id",
    "build_razorpayx_webhook_event_id",
]
