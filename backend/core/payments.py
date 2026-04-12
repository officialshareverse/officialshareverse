import base64
import hashlib
import hmac
import json
from urllib import error, request

from django.conf import settings


class PaymentGatewayError(Exception):
    def __init__(self, message, status_code=None, payload=None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


def _get_razorpay_credentials():
    key_id = (getattr(settings, "RAZORPAY_KEY_ID", "") or "").strip()
    key_secret = (getattr(settings, "RAZORPAY_KEY_SECRET", "") or "").strip()
    if not key_id or not key_secret:
        raise PaymentGatewayError("Razorpay is not configured on this server.")
    return key_id, key_secret


def _get_razorpayx_credentials():
    key_id = (
        getattr(settings, "RAZORPAYX_KEY_ID", "")
        or getattr(settings, "RAZORPAY_KEY_ID", "")
        or ""
    ).strip()
    key_secret = (
        getattr(settings, "RAZORPAYX_KEY_SECRET", "")
        or getattr(settings, "RAZORPAY_KEY_SECRET", "")
        or ""
    ).strip()
    if not key_id or not key_secret:
        raise PaymentGatewayError("RazorpayX is not configured on this server.")
    return key_id, key_secret


def _get_razorpay_webhook_secret():
    webhook_secret = (getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "") or "").strip()
    if not webhook_secret:
        raise PaymentGatewayError("Razorpay webhook secret is not configured on this server.")
    return webhook_secret


def _get_razorpayx_webhook_secret():
    webhook_secret = (
        getattr(settings, "RAZORPAYX_WEBHOOK_SECRET", "")
        or getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
        or ""
    ).strip()
    if not webhook_secret:
        raise PaymentGatewayError("RazorpayX webhook secret is not configured on this server.")
    return webhook_secret


def _razorpay_request(method, path, payload=None, *, key_id=None, key_secret=None, extra_headers=None, base_url=None):
    if not key_id or not key_secret:
        key_id, key_secret = _get_razorpay_credentials()
    base_url = (base_url or getattr(settings, "RAZORPAY_API_BASE_URL", "https://api.razorpay.com/v1")).rstrip("/")
    url = f"{base_url}/{path.lstrip('/')}"
    body = None
    headers = {
        "Authorization": "Basic "
        + base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("utf-8"),
    }
    if extra_headers:
        headers.update(extra_headers)

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
        raise PaymentGatewayError(description, status_code=exc.code, payload=payload) from exc
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


def verify_razorpayx_webhook_signature(raw_body, signature):
    webhook_secret = _get_razorpayx_webhook_secret()
    generated_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(generated_signature, signature)


def create_razorpayx_contact(name, email="", contact="", contact_type="customer", reference_id="", notes=None):
    key_id, key_secret = _get_razorpayx_credentials()
    payload = {
        "name": name,
        "type": contact_type,
    }
    if email:
        payload["email"] = email
    if contact:
        payload["contact"] = contact
    if reference_id:
        payload["reference_id"] = reference_id
    if notes:
        payload["notes"] = notes
    return _razorpay_request(
        "POST",
        "/contacts",
        payload=payload,
        key_id=key_id,
        key_secret=key_secret,
    )


def create_razorpayx_bank_fund_account(contact_id, account_holder_name, ifsc, account_number):
    key_id, key_secret = _get_razorpayx_credentials()
    return _razorpay_request(
        "POST",
        "/fund_accounts",
        payload={
            "contact_id": contact_id,
            "account_type": "bank_account",
            "bank_account": {
                "name": account_holder_name,
                "ifsc": ifsc,
                "account_number": account_number,
            },
        },
        key_id=key_id,
        key_secret=key_secret,
    )


def create_razorpayx_vpa_fund_account(contact_id, vpa_address):
    key_id, key_secret = _get_razorpayx_credentials()
    return _razorpay_request(
        "POST",
        "/fund_accounts",
        payload={
            "contact_id": contact_id,
            "account_type": "vpa",
            "vpa": {
                "address": vpa_address,
            },
        },
        key_id=key_id,
        key_secret=key_secret,
    )


def create_razorpayx_payout(
    *,
    source_account_number,
    fund_account_id,
    amount_subunits,
    currency,
    mode,
    purpose="payout",
    narration="",
    reference_id="",
    notes=None,
    idempotency_key="",
    queue_if_low_balance=True,
):
    key_id, key_secret = _get_razorpayx_credentials()
    payload = {
        "account_number": source_account_number,
        "fund_account_id": fund_account_id,
        "amount": amount_subunits,
        "currency": currency,
        "mode": mode,
        "purpose": purpose,
        "queue_if_low_balance": bool(queue_if_low_balance),
    }
    if narration:
        payload["narration"] = narration
    if reference_id:
        payload["reference_id"] = reference_id
    if notes:
        payload["notes"] = notes

    extra_headers = {}
    if idempotency_key:
        extra_headers["X-Payout-Idempotency"] = idempotency_key

    return _razorpay_request(
        "POST",
        "/payouts",
        payload=payload,
        key_id=key_id,
        key_secret=key_secret,
        extra_headers=extra_headers,
    )


def fetch_razorpayx_payout(payout_id):
    key_id, key_secret = _get_razorpayx_credentials()
    return _razorpay_request(
        "GET",
        f"/payouts/{payout_id}",
        key_id=key_id,
        key_secret=key_secret,
    )
