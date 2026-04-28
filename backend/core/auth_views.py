import math
import re
import secrets
from datetime import timedelta

import requests
from django.conf import settings
from django.contrib.auth import authenticate
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import ExpressionWrapper, F, IntegerField, Q, Sum, Value
from django.utils import timezone
from rest_framework.exceptions import ValidationError as RestValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import get_md5_hash_password

from .auth_identity import find_user_by_login_identifier, normalize_login_identifier
from .consumers import create_notification
from .models import PasswordResetOTP, Referral, ReferralCode, SignupOTP, User
from .rate_limit import (
    check_and_increment_rate_limit,
    get_rate_limit_status,
    reset_rate_limit,
)
from .serializers import (
    ForgotPasswordConfirmSerializer,
    ForgotPasswordRequestSerializer,
    GoogleAuthSerializer,
    SignupAvailabilitySerializer,
    SignupConfirmSerializer,
    SignupRequestOTPSerializer,
    SignupSerializer,
)

PASSWORD_RESET_OTP_TTL_MINUTES = 10
PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5
PASSWORD_RESET_OTP_COOLDOWN_SECONDS = 60
PASSWORD_RESET_OTP_REQUEST_LIMIT = 5
PASSWORD_RESET_OTP_REQUEST_WINDOW_MINUTES = 15
PASSWORD_RESET_OTP_FAILED_ATTEMPT_LIMIT = 8
PASSWORD_RESET_OTP_FAILED_ATTEMPT_WINDOW_MINUTES = 30
PASSWORD_RESET_OTP_REQUEST_RATE_LIMIT = 10
PASSWORD_RESET_OTP_REQUEST_RATE_WINDOW_SECONDS = 15 * 60
PASSWORD_RESET_OTP_CONFIRM_RATE_LIMIT = 20
PASSWORD_RESET_OTP_CONFIRM_RATE_WINDOW_SECONDS = 15 * 60
SIGNUP_OTP_TTL_MINUTES = 10
SIGNUP_OTP_MAX_ATTEMPTS = 5
SIGNUP_OTP_COOLDOWN_SECONDS = 60
SIGNUP_OTP_REQUEST_LIMIT = 5
SIGNUP_OTP_REQUEST_WINDOW_MINUTES = 15
SIGNUP_OTP_REQUEST_RATE_LIMIT = 10
SIGNUP_OTP_REQUEST_RATE_WINDOW_SECONDS = 15 * 60
SIGNUP_OTP_CONFIRM_RATE_LIMIT = 20
SIGNUP_OTP_CONFIRM_RATE_WINDOW_SECONDS = 15 * 60
LOGIN_FAILED_ATTEMPT_LIMIT = 5
LOGIN_FAILED_ATTEMPT_WINDOW_SECONDS = 15 * 60
GOOGLE_TOKEN_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


def get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def build_rate_limit_identity(request, username=None):
    ip_part = get_client_ip(request)
    user_part = (username or "").strip().lower()
    return f"{ip_part}:{user_part}"


def normalize_google_username_candidate(value):
    normalized = re.sub(r"[^A-Za-z0-9@.+_-]+", "", (value or "").strip().lower())
    normalized = normalized[:150]
    return normalized.strip("._-+") or ""


def build_unique_google_username(email, claims):
    email_local_part = (email or "").split("@", 1)[0]
    full_name = " ".join(
        part
        for part in [
            (claims.get("given_name") or "").strip(),
            (claims.get("family_name") or "").strip(),
        ]
        if part
    )

    candidates = [
        email_local_part,
        full_name.replace(" ", "."),
        (claims.get("name") or "").strip().replace(" ", "."),
        "shareverseuser",
    ]

    for raw_candidate in candidates:
        candidate = normalize_google_username_candidate(raw_candidate)
        if candidate and not User.objects.filter(username__iexact=candidate).exists():
            return candidate

    base = normalize_google_username_candidate(email_local_part) or "shareverseuser"
    for index in range(1, 1000):
        suffix = f"-{index}"
        trimmed_base = base[: max(1, 150 - len(suffix))].rstrip("._-+") or "shareverseuser"
        candidate = f"{trimmed_base}{suffix}"
        if not User.objects.filter(username__iexact=candidate).exists():
            return candidate

    random_suffix = secrets.token_hex(4)
    fallback_base = "shareverseuser"
    return f"{fallback_base[: max(1, 150 - len(random_suffix) - 1)]}-{random_suffix}"


def verify_google_id_token(credential):
    client_ids = getattr(settings, "GOOGLE_OAUTH_CLIENT_IDS", [])
    if not client_ids:
        raise ImproperlyConfigured("Google OAuth client ID is not configured.")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token
    except ImportError as exc:
        raise ImproperlyConfigured("google-auth dependency is not installed.") from exc

    request_adapter = google_requests.Request()
    last_error = None

    for client_id in client_ids:
        try:
            claims = google_id_token.verify_oauth2_token(
                credential,
                request_adapter,
                client_id,
            )
        except ValueError as exc:
            last_error = exc
            continue

        issuer = (claims.get("iss") or "").strip()
        if issuer not in GOOGLE_TOKEN_ISSUERS:
            last_error = ValueError("Unexpected Google token issuer.")
            continue

        return claims

    raise ValueError("Google sign-in could not be verified.") from last_error


def get_or_create_google_user(claims):
    email = (claims.get("email") or "").strip().lower()
    given_name = (claims.get("given_name") or "").strip()
    family_name = (claims.get("family_name") or "").strip()
    full_name = (claims.get("name") or "").strip()

    if not given_name and full_name:
        name_parts = full_name.split()
        given_name = name_parts[0] if name_parts else ""
        family_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else family_name

    existing_user = User.objects.filter(email__iexact=email).order_by("id").first()
    if existing_user:
        updated_fields = []

        if given_name and not (existing_user.first_name or "").strip():
            existing_user.first_name = given_name
            updated_fields.append("first_name")
        if family_name and not (existing_user.last_name or "").strip():
            existing_user.last_name = family_name
            updated_fields.append("last_name")
        if not existing_user.is_verified:
            existing_user.is_verified = True
            updated_fields.append("is_verified")

        if updated_fields:
            existing_user.save(update_fields=updated_fields)

        return existing_user, False

    username = build_unique_google_username(email, claims)
    user = User(
        username=username,
        email=email,
        first_name=given_name,
        last_name=family_name,
        is_verified=True,
    )
    user.set_unusable_password()
    user.save()
    return user, True


def issue_password_reset_otp(user, channel):
    PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)

    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    otp_session = PasswordResetOTP.objects.create(
        user=user,
        channel=channel,
        otp_hash=PasswordResetOTP.build_otp_hash(otp_code),
        expires_at=timezone.now() + timedelta(minutes=PASSWORD_RESET_OTP_TTL_MINUTES),
        attempts_remaining=PASSWORD_RESET_OTP_MAX_ATTEMPTS,
    )
    return otp_session, otp_code


def format_phone_destination_for_sms(destination):
    normalized = re.sub(r"\D+", "", (destination or "").strip())
    if not normalized:
        raise ValueError("A valid phone number is required for SMS delivery.")
    if len(normalized) != 10:
        raise ValueError("Phone number must be a valid 10-digit Indian mobile number.")
    return f"+91{normalized}"


def get_msg91_flow_id_for_purpose(purpose):
    if purpose == "Signup verification":
        return getattr(settings, "MSG91_SIGNUP_FLOW_ID", "").strip()
    if purpose == "Password reset":
        return getattr(settings, "MSG91_PASSWORD_RESET_FLOW_ID", "").strip()
    return ""


def deliver_otp_code(channel, destination, otp_code, purpose):
    if channel == "email" and destination:
        send_mail(
            subject=f"Your ShareVerse {purpose} OTP",
            message=(
                f"Your ShareVerse {purpose.lower()} code is {otp_code}.\n\n"
                f"It expires in 10 minutes."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[destination],
            fail_silently=False,
        )
        return True

    if channel != "phone" or not destination:
        return False

    sms_destination = format_phone_destination_for_sms(destination)
    msg91_auth_key = getattr(settings, "MSG91_AUTH_KEY", "").strip()
    msg91_flow_id = get_msg91_flow_id_for_purpose(purpose)
    otp_variable_name = getattr(settings, "MSG91_OTP_VARIABLE_NAME", "OTP").strip() or "OTP"
    if not (msg91_auth_key and msg91_flow_id):
        print(
            f"[ShareVerse SMS OTP] To: {sms_destination} | Purpose: {purpose} | OTP: {otp_code}"
        )
        return False

    recipient_payload = {
        "mobiles": sms_destination.lstrip("+"),
        otp_variable_name: otp_code,
    }
    payload = {
        "flow_id": msg91_flow_id,
        "recipients": [recipient_payload],
    }
    sender_id = getattr(settings, "MSG91_SENDER_ID", "").strip()
    if sender_id:
        payload["sender"] = sender_id

    response = requests.post(
        getattr(settings, "MSG91_SMS_FLOW_API_URL", "").strip(),
        json=payload,
        headers={
            "authkey": msg91_auth_key,
            "content-type": "application/json",
        },
        timeout=15,
    )
    response.raise_for_status()

    response_data = response.json()
    return response_data.get("type") == "success"


def issue_signup_otp(username, email, phone, channel):
    filters = Q(username__iexact=username) | Q(email__iexact=email)
    if phone:
        filters |= Q(phone=phone)
    SignupOTP.objects.filter(is_used=False).filter(filters).update(is_used=True)

    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    otp_session = SignupOTP.objects.create(
        username=username,
        email=email,
        phone=phone or "",
        channel=channel,
        otp_hash=SignupOTP.build_otp_hash(otp_code),
        expires_at=timezone.now() + timedelta(minutes=SIGNUP_OTP_TTL_MINUTES),
        attempts_remaining=SIGNUP_OTP_MAX_ATTEMPTS,
    )
    return otp_session, otp_code


def get_signup_otp_request_queryset(username, email, phone=""):
    filters = Q(username__iexact=username) | Q(email__iexact=email)
    if phone:
        filters |= Q(phone=phone)
    return SignupOTP.objects.filter(filters)


def get_signup_otp_request_limit_retry_after_seconds(username, email, phone=""):
    now = timezone.now()
    request_window_start = now - timedelta(minutes=SIGNUP_OTP_REQUEST_WINDOW_MINUTES)
    oldest_in_window = (
        get_signup_otp_request_queryset(username, email, phone)
        .filter(created_at__gte=request_window_start)
        .order_by("created_at")
        .first()
    )
    if not oldest_in_window:
        return SIGNUP_OTP_COOLDOWN_SECONDS

    window_end = oldest_in_window.created_at + timedelta(
        minutes=SIGNUP_OTP_REQUEST_WINDOW_MINUTES
    )
    return max(math.ceil((window_end - now).total_seconds()), 1)


def validate_signup_request_guardrails(request, username, email, phone=""):
    identity_seed = f"{username}:{email}:{phone}".strip(":")
    request_identity = build_rate_limit_identity(request, identity_seed)
    request_rate_result = check_and_increment_rate_limit(
        scope="signup_otp_request",
        identity=request_identity,
        limit=SIGNUP_OTP_REQUEST_RATE_LIMIT,
        window_seconds=SIGNUP_OTP_REQUEST_RATE_WINDOW_SECONDS,
    )
    if not request_rate_result["allowed"]:
        return Response(
            {
                "error": "Too many verification code requests. Try again later.",
                "retry_after_seconds": request_rate_result["retry_after_seconds"],
            },
            status=429,
        )

    recent_session = (
        get_signup_otp_request_queryset(username, email, phone)
        .filter(created_at__gte=timezone.now() - timedelta(seconds=SIGNUP_OTP_COOLDOWN_SECONDS))
        .order_by("-created_at")
        .first()
    )
    if recent_session:
        retry_after = max(
            math.ceil(
                (
                    recent_session.created_at
                    + timedelta(seconds=SIGNUP_OTP_COOLDOWN_SECONDS)
                    - timezone.now()
                ).total_seconds()
            ),
            1,
        )
        return Response(
            {
                "error": "A verification code was just generated. Please wait before requesting another one.",
                "retry_after_seconds": retry_after,
            },
            status=429,
        )

    requests_in_window = (
        get_signup_otp_request_queryset(username, email, phone)
        .filter(
            created_at__gte=timezone.now() - timedelta(minutes=SIGNUP_OTP_REQUEST_WINDOW_MINUTES)
        )
        .count()
    )
    if requests_in_window >= SIGNUP_OTP_REQUEST_LIMIT:
        return Response(
            {
                "error": "Too many verification code requests. Try again later.",
                "retry_after_seconds": get_signup_otp_request_limit_retry_after_seconds(
                    username,
                    email,
                    phone,
                ),
            },
            status=429,
        )

    return None


def get_recent_otp_failed_attempts(user):
    failed_window_start = timezone.now() - timedelta(
        minutes=PASSWORD_RESET_OTP_FAILED_ATTEMPT_WINDOW_MINUTES
    )
    attempts_used_expression = ExpressionWrapper(
        Value(PASSWORD_RESET_OTP_MAX_ATTEMPTS) - F("attempts_remaining"),
        output_field=IntegerField(),
    )
    return (
        PasswordResetOTP.objects.filter(
            user=user,
            created_at__gte=failed_window_start,
        ).aggregate(total=Sum(attempts_used_expression))["total"]
        or 0
    )


def get_otp_lockout_retry_after_seconds(user):
    now = timezone.now()
    failed_window_start = now - timedelta(
        minutes=PASSWORD_RESET_OTP_FAILED_ATTEMPT_WINDOW_MINUTES
    )
    oldest_in_window = (
        PasswordResetOTP.objects.filter(
            user=user,
            created_at__gte=failed_window_start,
        )
        .order_by("created_at")
        .first()
    )
    if not oldest_in_window:
        return PASSWORD_RESET_OTP_COOLDOWN_SECONDS

    window_end = oldest_in_window.created_at + timedelta(
        minutes=PASSWORD_RESET_OTP_FAILED_ATTEMPT_WINDOW_MINUTES
    )
    seconds_remaining = max(math.ceil((window_end - now).total_seconds()), 1)
    return seconds_remaining


def get_otp_request_limit_retry_after_seconds(user):
    now = timezone.now()
    request_window_start = now - timedelta(
        minutes=PASSWORD_RESET_OTP_REQUEST_WINDOW_MINUTES
    )
    oldest_in_window = (
        PasswordResetOTP.objects.filter(
            user=user,
            created_at__gte=request_window_start,
        )
        .order_by("created_at")
        .first()
    )
    if not oldest_in_window:
        return PASSWORD_RESET_OTP_COOLDOWN_SECONDS

    window_end = oldest_in_window.created_at + timedelta(
        minutes=PASSWORD_RESET_OTP_REQUEST_WINDOW_MINUTES
    )
    seconds_remaining = max(math.ceil((window_end - now).total_seconds()), 1)
    return seconds_remaining


def validate_password_reset_request_guardrails(request, user):
    username = user.username if user else ""
    request_identity = build_rate_limit_identity(request, username)
    request_rate_result = check_and_increment_rate_limit(
        scope="otp_request",
        identity=request_identity,
        limit=PASSWORD_RESET_OTP_REQUEST_RATE_LIMIT,
        window_seconds=PASSWORD_RESET_OTP_REQUEST_RATE_WINDOW_SECONDS,
    )
    if not request_rate_result["allowed"]:
        return Response(
            {
                "error": "Too many OTP requests. Try again later.",
                "retry_after_seconds": request_rate_result["retry_after_seconds"],
            },
            status=429,
        )

    failed_attempts = get_recent_otp_failed_attempts(user)
    if failed_attempts >= PASSWORD_RESET_OTP_FAILED_ATTEMPT_LIMIT:
        return Response(
            {
                "error": "Too many invalid OTP attempts. Try again later.",
                "retry_after_seconds": get_otp_lockout_retry_after_seconds(user),
            },
            status=429,
        )

    latest_otp = PasswordResetOTP.objects.filter(user=user).order_by("-created_at").first()
    if latest_otp:
        elapsed_seconds = (timezone.now() - latest_otp.created_at).total_seconds()
        if elapsed_seconds < PASSWORD_RESET_OTP_COOLDOWN_SECONDS:
            retry_after = max(
                int(math.ceil(PASSWORD_RESET_OTP_COOLDOWN_SECONDS - elapsed_seconds)),
                1,
            )
            return Response(
                {
                    "error": "Please wait before requesting another OTP.",
                    "retry_after_seconds": retry_after,
                },
                status=429,
            )

    request_window_start = timezone.now() - timedelta(
        minutes=PASSWORD_RESET_OTP_REQUEST_WINDOW_MINUTES
    )
    request_count = PasswordResetOTP.objects.filter(
        user=user,
        created_at__gte=request_window_start,
    ).count()
    if request_count >= PASSWORD_RESET_OTP_REQUEST_LIMIT:
        return Response(
            {
                "error": "Too many OTP requests. Try again later.",
                "retry_after_seconds": get_otp_request_limit_retry_after_seconds(user),
            },
            status=429,
        )

    return None


def serialize_auth_user(user):
    return {
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


def attach_refresh_cookie(response, refresh_token):
    refresh_lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        str(refresh_token),
        max_age=int(refresh_lifetime.total_seconds()),
        httponly=True,
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        domain=settings.AUTH_REFRESH_COOKIE_DOMAIN,
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        domain=settings.AUTH_REFRESH_COOKIE_DOMAIN,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )
    return response


def build_invalid_refresh_response(message="Refresh session is invalid or expired."):
    response = Response({"error": message}, status=401)
    clear_refresh_cookie(response)
    return response


def blacklist_refresh_token_value(refresh_token):
    if not refresh_token:
        return False

    try:
        RefreshToken(refresh_token).blacklist()
    except (AttributeError, TokenError):
        return False

    return True


def blacklist_user_refresh_tokens(user):
    outstanding_tokens = OutstandingToken.objects.filter(
        user=user,
        expires_at__gt=timezone.now(),
        blacklistedtoken__isnull=True,
    )
    blacklisted_count = 0

    for token in outstanding_tokens.iterator():
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        blacklisted_count += int(created)

    return blacklisted_count


def is_refresh_token_invalid_for_current_password(refresh_token, user):
    if not api_settings.CHECK_REVOKE_TOKEN:
        return False

    revoke_claim = api_settings.REVOKE_TOKEN_CLAIM
    token_password_hash = refresh_token.get(revoke_claim)
    current_password_hash = get_md5_hash_password(user.password)
    return token_password_hash != current_password_hash


def build_auth_payload(user, *, created=None, refresh=None, include_refresh=False):
    resolved_refresh = refresh or RefreshToken.for_user(user)
    payload = {
        "access": str(resolved_refresh.access_token),
        "user": serialize_auth_user(user),
    }
    if include_refresh:
        payload["refresh"] = str(resolved_refresh)
    if created is not None:
        payload["created"] = created
    return payload, resolved_refresh


def build_auth_response(user, *, created=None):
    payload, refresh = build_auth_payload(user, created=created)
    response = Response(payload)
    attach_refresh_cookie(response, refresh)
    return response


def build_mobile_auth_response(user, *, created=None, status_code=200):
    payload, _ = build_auth_payload(user, created=created, include_refresh=True)
    return Response(payload, status=status_code)


def create_user_from_verified_signup(request, serializer):
    username = serializer.validated_data["username"]
    email = serializer.validated_data["email"]
    phone = serializer.validated_data.get("phone", "")
    signup_session_id = serializer.validated_data["signup_session_id"]
    otp = serializer.validated_data["otp"]
    referral_code_value = serializer.validated_data.get("referral_code", "")

    confirm_identity = build_rate_limit_identity(request, f"{username}:{email}")
    confirm_rate_result = check_and_increment_rate_limit(
        scope="signup_otp_confirm",
        identity=confirm_identity,
        limit=SIGNUP_OTP_CONFIRM_RATE_LIMIT,
        window_seconds=SIGNUP_OTP_CONFIRM_RATE_WINDOW_SECONDS,
    )
    if not confirm_rate_result["allowed"]:
        return Response(
            {
                "error": "Too many OTP verification attempts. Try again later.",
                "retry_after_seconds": confirm_rate_result["retry_after_seconds"],
            },
            status=429,
        )

    with transaction.atomic():
        try:
            otp_session = SignupOTP.objects.select_for_update().get(id=signup_session_id)
        except SignupOTP.DoesNotExist:
            return None, Response({"error": "Invalid verification session."}, status=400)

        if otp_session.is_used:
            return None, Response(
                {"error": "This verification session has already been used."},
                status=400,
            )

        if otp_session.expires_at <= timezone.now():
            return None, Response({"error": "OTP expired. Request a new code."}, status=400)

        if otp_session.attempts_remaining <= 0:
            return None, Response(
                {"error": "OTP attempts exceeded. Request a new code."},
                status=400,
            )

        if otp_session.username.strip().lower() != username.lower():
            return None, Response(
                {"error": "Verification session does not match this username."},
                status=400,
            )

        if otp_session.email.strip().lower() != email.lower():
            return None, Response(
                {"error": "Verification session does not match this email."},
                status=400,
            )

        if (otp_session.phone or "").strip() != (phone or "").strip():
            return None, Response(
                {"error": "Verification session does not match this phone number."},
                status=400,
            )

        if not otp_session.verify_otp(otp):
            otp_session.attempts_remaining = max(otp_session.attempts_remaining - 1, 0)
            otp_session.save(update_fields=["attempts_remaining"])
            return None, Response(
                {
                    "error": "Invalid OTP.",
                    "attempts_remaining": otp_session.attempts_remaining,
                },
                status=400,
            )

        user_serializer = SignupSerializer(
            data={
                "username": serializer.validated_data["username"],
                "first_name": serializer.validated_data.get("first_name", ""),
                "last_name": serializer.validated_data.get("last_name", ""),
                "email": serializer.validated_data["email"],
                "phone": serializer.validated_data.get("phone") or None,
                "password": serializer.validated_data["password"],
                "referral_code": referral_code_value,
            }
        )
        if not user_serializer.is_valid():
            return None, Response(user_serializer.errors, status=400)

        user = user_serializer.save(is_verified=True)

        if referral_code_value:
            referral_code = (
                ReferralCode.objects.select_for_update()
                .select_related("user")
                .filter(code__iexact=referral_code_value)
                .first()
            )
            if (
                referral_code
                and referral_code.user_id != user.id
                and not Referral.objects.filter(referred_user=user).exists()
            ):
                Referral.objects.create(
                    referrer=referral_code.user,
                    referred_user=user,
                    referral_code=referral_code,
                    status="signed_up",
                )
                referral_code.total_referrals += 1
                referral_code.save(update_fields=["total_referrals"])

        otp_session.is_used = True
        otp_session.save(update_fields=["is_used"])

        get_signup_otp_request_queryset(username, email, phone).exclude(
            id=otp_session.id
        ).update(is_used=True)

    create_notification(
        user=user,
        message="Your account was created and verified successfully.",
    )
    return user, None


def authenticate_login_request(request):
    login_identifier = normalize_login_identifier(request.data.get("username"))
    password = request.data.get("password")
    login_user = find_user_by_login_identifier(login_identifier)
    rate_limit_identity_seed = login_user.username if login_user else login_identifier

    login_identity = build_rate_limit_identity(request, rate_limit_identity_seed)
    current_lockout = get_rate_limit_status("login_failed", login_identity)
    if current_lockout["count"] >= LOGIN_FAILED_ATTEMPT_LIMIT:
        return None, Response(
            {
                "error": "Too many failed login attempts.",
                "retry_after_seconds": current_lockout["retry_after_seconds"],
            },
            status=429,
        )

    authenticate_username = login_user.username if login_user else login_identifier
    user = authenticate(username=authenticate_username, password=password)

    if user is None:
        rate_result = check_and_increment_rate_limit(
            scope="login_failed",
            identity=login_identity,
            limit=LOGIN_FAILED_ATTEMPT_LIMIT,
            window_seconds=LOGIN_FAILED_ATTEMPT_WINDOW_SECONDS,
        )
        if not rate_result["allowed"]:
            return None, Response(
                {
                    "error": "Too many failed login attempts.",
                    "retry_after_seconds": rate_result["retry_after_seconds"],
                },
                status=429,
            )
        return None, Response({"error": "Invalid credentials"}, status=401)

    reset_rate_limit("login_failed", login_identity)
    return user, None


def build_mobile_refresh_response(refresh_token):
    try:
        refresh = RefreshToken(refresh_token)
        user = User.objects.get(id=refresh["user_id"])
    except (KeyError, TokenError, User.DoesNotExist):
        return None, Response({"error": "Refresh token is invalid or expired."}, status=401)

    if is_refresh_token_invalid_for_current_password(refresh, user):
        blacklist_refresh_token_value(refresh_token)
        return None, Response(
            {"error": "Refresh session is no longer valid. Please sign in again."},
            status=401,
        )

    serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
    try:
        serializer.is_valid(raise_exception=True)
    except RestValidationError:
        blacklist_refresh_token_value(refresh_token)
        return None, Response({"error": "Refresh token is invalid or expired."}, status=401)

    rotated_refresh_token = serializer.validated_data.get("refresh") or refresh_token
    return Response(
        {
            "access": serializer.validated_data["access"],
            "refresh": rotated_refresh_token,
            "user": serialize_auth_user(user),
        }
    ), None


class SignupRequestOTPView(APIView):
    def post(self, request):
        serializer = SignupRequestOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        username = serializer.validated_data["username"]
        email = serializer.validated_data["email"]
        phone = serializer.validated_data.get("phone", "")
        channel = serializer.validated_data["channel"]

        guardrail_response = validate_signup_request_guardrails(request, username, email, phone)
        if guardrail_response:
            return guardrail_response

        otp_session, otp_code = issue_signup_otp(username, email, phone, channel)
        delivered = False
        destination = phone if channel == "phone" else email
        try:
            delivered = deliver_otp_code(channel, destination, otp_code, "Signup verification")
        except Exception:
            delivered = False

        response = {
            "message": "Verification code generated.",
            "signup_session_id": str(otp_session.id),
            "expires_in_seconds": SIGNUP_OTP_TTL_MINUTES * 60,
            "delivery_channel": channel,
            "delivery_status": "sent" if delivered else "generated",
        }

        if getattr(settings, "EXPOSE_DEV_OTP", False):
            response["dev_otp"] = otp_code

        return Response(response)


class SignupAvailabilityView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupAvailabilitySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        username = serializer.validated_data["username"]
        available = not User.objects.filter(username__iexact=username).exists()
        return Response(
            {
                "username": username,
                "available": available,
                "message": "Username is available."
                if available
                else "This username is already in use.",
            }
        )


class SignupView(APIView):
    def post(self, request):
        serializer = SignupConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        user, error_response = create_user_from_verified_signup(request, serializer)
        if error_response:
            return error_response

        return Response({"message": "User created and verified."}, status=201)


class MobileSignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        user, error_response = create_user_from_verified_signup(request, serializer)
        if error_response:
            return error_response

        return build_mobile_auth_response(user, status_code=201)


class LoginView(APIView):
    def post(self, request):
        user, error_response = authenticate_login_request(request)
        if error_response:
            return error_response

        return build_auth_response(user)


class MobileLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user, error_response = authenticate_login_request(request)
        if error_response:
            return error_response

        return build_mobile_auth_response(user)


class MobileGoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            claims = verify_google_id_token(serializer.validated_data["credential"])
        except ImproperlyConfigured:
            return Response(
                {"error": "Google sign-in is not configured right now."},
                status=503,
            )
        except ValueError:
            return Response({"error": "Google sign-in could not be verified."}, status=400)

        email = (claims.get("email") or "").strip().lower()
        if not email:
            return Response({"error": "Google account email is missing."}, status=400)

        if not claims.get("email_verified"):
            return Response(
                {"error": "Please use a Google account with a verified email."},
                status=400,
            )

        user, created = get_or_create_google_user(claims)
        return build_mobile_auth_response(user, created=created)


class RefreshSessionView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = (request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME) or "").strip()
        if not refresh_token:
            return build_invalid_refresh_response("Refresh session missing.")

        try:
            refresh = RefreshToken(refresh_token)
            user = User.objects.get(id=refresh["user_id"])
        except (KeyError, TokenError, User.DoesNotExist):
            return build_invalid_refresh_response()

        if is_refresh_token_invalid_for_current_password(refresh, user):
            blacklist_refresh_token_value(refresh_token)
            return build_invalid_refresh_response(
                "Refresh session is no longer valid. Please sign in again."
            )

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except RestValidationError:
            blacklist_refresh_token_value(refresh_token)
            return build_invalid_refresh_response()

        response = Response(
            {
                "access": serializer.validated_data["access"],
                "user": serialize_auth_user(user),
            }
        )
        rotated_refresh_token = serializer.validated_data.get("refresh")
        if rotated_refresh_token:
            attach_refresh_cookie(response, rotated_refresh_token)
        return response


class MobileRefreshSessionView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = (request.data.get("refresh") or "").strip()
        if not refresh_token:
            return Response({"error": "Refresh token is required."}, status=400)

        response, error_response = build_mobile_refresh_response(refresh_token)
        if error_response:
            return error_response
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = (request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME) or "").strip()
        blacklist_refresh_token_value(refresh_token)
        response = Response({"message": "Logged out."}, status=200)
        clear_refresh_cookie(response)
        return response


class MobileLogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = (request.data.get("refresh") or "").strip()
        blacklist_refresh_token_value(refresh_token)
        return Response({"message": "Logged out."}, status=200)


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            claims = verify_google_id_token(serializer.validated_data["credential"])
        except ImproperlyConfigured:
            return Response(
                {"error": "Google sign-in is not configured right now."},
                status=503,
            )
        except ValueError:
            return Response({"error": "Google sign-in could not be verified."}, status=400)

        email = (claims.get("email") or "").strip().lower()
        if not email:
            return Response({"error": "Google account email is missing."}, status=400)

        if not claims.get("email_verified"):
            return Response(
                {"error": "Please use a Google account with a verified email."},
                status=400,
            )

        user, created = get_or_create_google_user(claims)
        return build_auth_response(user, created=created)


class ForgotPasswordRequestOTPView(APIView):
    def post(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        user = serializer.validated_data["user"]
        channel = serializer.validated_data["channel"]
        guardrail_response = validate_password_reset_request_guardrails(request, user)
        if guardrail_response:
            return guardrail_response

        otp_session, otp_code = issue_password_reset_otp(user, channel)
        delivered = False
        destination = user.phone if channel == "phone" else user.email
        try:
            delivered = deliver_otp_code(channel, destination, otp_code, "Password reset")
        except Exception:
            delivered = False

        create_notification(
            user=user,
            message=f"Password reset OTP generated for {channel}.",
        )

        response = {
            "message": "OTP sent for password reset.",
            "reset_session_id": str(otp_session.id),
            "expires_in_seconds": PASSWORD_RESET_OTP_TTL_MINUTES * 60,
            "delivery_channel": channel,
            "delivery_status": "sent" if delivered else "generated",
        }

        if getattr(settings, "EXPOSE_DEV_OTP", False):
            response["dev_otp"] = otp_code

        return Response(response)


class ForgotPasswordConfirmOTPView(APIView):
    def post(self, request):
        serializer = ForgotPasswordConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        login_identifier = serializer.validated_data["username"]
        reset_session_id = serializer.validated_data["reset_session_id"]
        otp = serializer.validated_data["otp"]
        new_password = serializer.validated_data["new_password"]
        user = find_user_by_login_identifier(login_identifier)
        confirm_identity_seed = user.username if user else login_identifier

        confirm_identity = build_rate_limit_identity(request, confirm_identity_seed)
        confirm_rate_result = check_and_increment_rate_limit(
            scope="otp_confirm",
            identity=confirm_identity,
            limit=PASSWORD_RESET_OTP_CONFIRM_RATE_LIMIT,
            window_seconds=PASSWORD_RESET_OTP_CONFIRM_RATE_WINDOW_SECONDS,
        )
        if not confirm_rate_result["allowed"]:
            return Response(
                {
                    "error": "Too many OTP verification attempts. Try again later.",
                    "retry_after_seconds": confirm_rate_result["retry_after_seconds"],
                },
                status=429,
            )

        with transaction.atomic():
            if not user:
                return Response({"error": "Invalid reset session."}, status=400)

            failed_attempts = get_recent_otp_failed_attempts(user)
            if failed_attempts >= PASSWORD_RESET_OTP_FAILED_ATTEMPT_LIMIT:
                return Response(
                    {
                        "error": "Too many invalid OTP attempts. Try again later.",
                        "retry_after_seconds": get_otp_lockout_retry_after_seconds(user),
                    },
                    status=429,
                )

            try:
                otp_session = PasswordResetOTP.objects.select_for_update().get(
                    id=reset_session_id,
                    user=user,
                )
            except PasswordResetOTP.DoesNotExist:
                return Response({"error": "Invalid reset session."}, status=400)

            if otp_session.is_used:
                return Response(
                    {"error": "This OTP session has already been used."},
                    status=400,
                )

            if otp_session.expires_at <= timezone.now():
                return Response({"error": "OTP expired. Request a new code."}, status=400)

            if otp_session.attempts_remaining <= 0:
                return Response(
                    {"error": "OTP attempts exceeded. Request a new code."},
                    status=400,
                )

            if not otp_session.verify_otp(otp):
                otp_session.attempts_remaining = max(otp_session.attempts_remaining - 1, 0)
                otp_session.save(update_fields=["attempts_remaining"])
                updated_failed_attempts = get_recent_otp_failed_attempts(user)
                if updated_failed_attempts >= PASSWORD_RESET_OTP_FAILED_ATTEMPT_LIMIT:
                    return Response(
                        {
                            "error": "Too many invalid OTP attempts. Try again later.",
                            "retry_after_seconds": get_otp_lockout_retry_after_seconds(user),
                        },
                        status=429,
                    )
                return Response(
                    {
                        "error": "Invalid OTP.",
                        "attempts_remaining": otp_session.attempts_remaining,
                    },
                    status=400,
                )

            user.set_password(new_password)
            user.save()
            blacklist_user_refresh_tokens(user)

            otp_session.is_used = True
            otp_session.save(update_fields=["is_used"])

            PasswordResetOTP.objects.filter(
                user=user,
                is_used=False,
            ).exclude(id=otp_session.id).update(is_used=True)

        return Response({"message": "Password reset successful"})
