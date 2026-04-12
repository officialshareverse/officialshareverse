import base64
import hashlib
import hmac
import json
from urllib import error, request

from django.conf import settings


class PaymentGatewayError(Exception):
    pass


def _get_razorpay_credentials():
    key_id = (getattr(settings, "RAZORPAY_KEY_ID", "") or "").strip()
    key_secret = (getattr(settings, "RAZORPAY_KEY_SECRET", "") or "").strip()
    if not key_id or not key_secret:
        raise PaymentGatewayError("Razorpay is not configured on this server.")
    return key_id, key_secret


def _get_razorpay_webhook_secret():
    webhook_secret = (getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "") or "").strip()
    if not webhook_secret:
        raise PaymentGatewayError("Razorpay webhook secret is not configured on this server.")
    return webhook_secret


def _razorpay_request(method, path, payload=None):
    key_id, key_secret = _get_razorpay_credentials()
    base_url = getattr(settings, "RAZORPAY_API_BASE_URL", "https://api.razorpay.com/v1").rstrip("/")
    url = f"{base_url}/{path.lstrip('/')}"
    body = None
    headers = {
        "Authorization": "Basic "
        + base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("utf-8"),
    }

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = request.Request(url, data=body, headers=headers, method=method.upper())

    try:
        with request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        raw_body = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            payload = {"error": {"description": raw_body or exc.reason}}
        description = (
            payload.get("error", {}).get("description")
            or payload.get("error", {}).get("reason")
            or str(exc.reason)
        )
        raise PaymentGatewayError(description) from exc
    except error.URLError as exc:
        raise PaymentGatewayError("Payment gateway is unreachable right now.") from exc


def create_razorpay_order(amount_subunits, currency, receipt, notes=None):
    payload = {
        "amount": amount_subunits,
        "currency": currency,
        "receipt": receipt,
    }
    if notes:
        payload["notes"] = notes
    return _razorpay_request("POST", "/orders", payload=payload)


def fetch_razorpay_payment(payment_id):
    return _razorpay_request("GET", f"/payments/{payment_id}")


def capture_razorpay_payment(payment_id, amount_subunits, currency):
    return _razorpay_request(
        "POST",
        f"/payments/{payment_id}/capture",
        payload={
            "amount": amount_subunits,
            "currency": currency,
        },
    )


def verify_razorpay_signature(order_id, payment_id, signature):
    _, key_secret = _get_razorpay_credentials()
    generated_signature = hmac.new(
        key_secret.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(generated_signature, signature)


def verify_razorpay_webhook_signature(raw_body, signature):
    webhook_secret = _get_razorpay_webhook_secret()
    generated_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(generated_signature, signature)
