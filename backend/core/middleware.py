import ipaddress
import logging

from django.conf import settings
from django.http import JsonResponse


logger = logging.getLogger(__name__)


class EnsureCorsCredentialsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        allow_origin = response.get("Access-Control-Allow-Origin")
        if allow_origin and allow_origin != "*":
            response["Access-Control-Allow-Credentials"] = "true"

        return response


class APIContentSecurityPolicyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if not self._should_apply(request):
            return response

        csp = getattr(settings, "API_CONTENT_SECURITY_POLICY", "")
        if csp and not response.has_header("Content-Security-Policy"):
            response["Content-Security-Policy"] = csp

        security_headers = getattr(settings, "API_SECURITY_HEADERS", {})
        for header_name, header_value in security_headers.items():
            if header_value and not response.has_header(header_name):
                response[header_name] = header_value

        return response

    def _should_apply(self, request):
        path_prefixes = getattr(settings, "API_SECURITY_HEADER_PATH_PREFIXES", ["/api/"])
        return any(request.path.startswith(path_prefix) for path_prefix in path_prefixes)


class RazorpayWebhookIPAllowlistMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not self._should_check_request(request):
            return self.get_response(request)

        client_ip = self._get_client_ip(request)
        if self._is_allowed_ip(client_ip):
            return self.get_response(request)

        logger.warning(
            "Blocked Razorpay webhook from non-allowlisted IP.",
            extra={
                "client_ip": client_ip,
                "path": request.path,
                "remote_addr": request.META.get("REMOTE_ADDR", ""),
                "x_forwarded_for": request.META.get("HTTP_X_FORWARDED_FOR", ""),
            },
        )
        return JsonResponse(
            {"error": "Webhook source IP is not allowed."},
            status=403,
        )

    def _should_check_request(self, request):
        if not getattr(settings, "RAZORPAY_WEBHOOK_IP_ALLOWLIST_ENABLED", False):
            return False
        if request.method.upper() != "POST":
            return False

        webhook_paths = set(getattr(settings, "RAZORPAY_WEBHOOK_PATHS", []))
        return request.path in webhook_paths

    def _get_client_ip(self, request):
        remote_addr = (request.META.get("REMOTE_ADDR") or "").strip()
        trusted_proxies = set(getattr(settings, "RAZORPAY_WEBHOOK_TRUSTED_PROXY_IPS", []))

        if remote_addr in trusted_proxies:
            forwarded_for = (request.META.get("HTTP_X_FORWARDED_FOR") or "").strip()
            if forwarded_for:
                return forwarded_for.split(",", 1)[0].strip()

            real_ip = (request.META.get("HTTP_X_REAL_IP") or "").strip()
            if real_ip:
                return real_ip

        return remote_addr

    def _is_allowed_ip(self, client_ip):
        try:
            parsed_client_ip = ipaddress.ip_address(client_ip)
        except ValueError:
            return False

        for allowed_entry in getattr(settings, "RAZORPAY_WEBHOOK_ALLOWED_IPS", []):
            try:
                allowed_network = ipaddress.ip_network(allowed_entry, strict=False)
            except ValueError:
                logger.warning("Ignoring invalid Razorpay webhook allowlist entry: %s", allowed_entry)
                continue

            if parsed_client_ip in allowed_network:
                return True

        return False
