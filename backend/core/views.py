import secrets
import os
import json
import hashlib
import re
from datetime import timedelta
from decimal import Decimal, InvalidOperation
import math

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.core.exceptions import ValidationError
from django.db import DatabaseError, connections, transaction
from django.db.models import Avg, Count, ExpressionWrapper, F, IntegerField, Q, Sum, Value
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    CredentialRevealToken,
    EscrowLedger,
    Group,
    GroupChatMessage,
    GroupChatPresence,
    GroupChatReadState,
    GroupMember,
    Notification,
    PasswordResetOTP,
    PayoutAccount,
    RazorpayWebhookEvent,
    RazorpayXPayoutWebhookEvent,
    SignupOTP,
    Review,
    Subscription,
    Transaction,
    User,
    Wallet,
    WalletPayout,
    WalletTopupOrder,
)
from .payments import (
    PaymentGatewayError,
    capture_razorpay_payment,
    create_razorpay_order,
    create_razorpayx_bank_fund_account,
    create_razorpayx_contact,
    create_razorpayx_payout,
    create_razorpayx_vpa_fund_account,
    fetch_razorpay_payment,
    fetch_razorpayx_payout,
    verify_razorpay_signature,
    verify_razorpay_webhook_signature,
    verify_razorpayx_webhook_signature,
)
from .manual_payouts import create_manual_wallet_payout_request, save_manual_payout_account
from .operation_logging import log_operation_event
from .pricing import (
    get_group_earning_platform_fee_amount,
    get_group_earning_payout_amount,
    get_group_join_pricing,
    get_member_charged_amount,
    get_member_contribution_amount,
    get_member_platform_fee_amount,
    sum_member_contribution_amounts,
)
from .rate_limit import (
    check_and_increment_rate_limit,
    get_rate_limit_status,
    reset_rate_limit,
)
from .serializers import (
    CreateGroupSerializer,
    ForgotPasswordConfirmSerializer,
    ForgotPasswordRequestSerializer,
    GroupChatPresenceSerializer,
    GroupListSerializer,
    GroupChatMessageSerializer,
    GroupUpdateSerializer,
    PayoutAccountSerializer,
    PayoutAccountUpsertSerializer,
    ProfileUpdateSerializer,
    ReviewSerializer,
    SendGroupChatMessageSerializer,
    SignupAvailabilitySerializer,
    SignupConfirmSerializer,
    SignupRequestOTPSerializer,
    SignupSerializer,
    SubmitReviewSerializer,
    SubmitPurchaseProofSerializer,
    TransactionSerializer,
    WalletPayoutCreateSerializer,
    WalletPayoutSerializer,
    WalletTopupOrderCreateSerializer,
    WalletTopupVerifySerializer,
    get_mode_copy,
    get_status_copy,
)

CREDENTIAL_REVEAL_TTL_MINUTES = 5
PASSWORD_RESET_OTP_TTL_MINUTES = 10
PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5
PASSWORD_RESET_OTP_COOLDOWN_SECONDS = 60
PASSWORD_RESET_OTP_REQUEST_LIMIT = 5
PASSWORD_RESET_OTP_REQUEST_WINDOW_MINUTES = 15
PASSWORD_RESET_OTP_FAILED_ATTEMPT_LIMIT = 8
PASSWORD_RESET_OTP_FAILED_ATTEMPT_WINDOW_MINUTES = 30
GROUP_CHAT_ONLINE_WINDOW_MINUTES = 6
GROUP_CHAT_RECENT_WINDOW_MINUTES = 30
GROUP_CHAT_TYPING_WINDOW_SECONDS = 12
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
BUY_TOGETHER_PURCHASE_DEADLINE_HOURS = 6
BUY_TOGETHER_MEMBER_CONFIRMATION_WINDOW_HOURS = 12


def can_close_group(group):
    member_count = GroupMember.objects.filter(group=group).count()

    if group.status == "closed":
        return False, "This group is already closed."

    if member_count == 0:
        return False, "Empty groups can be deleted instead of closed."

    if group.mode == "group_buy" and group.status != "active":
        return False, "Buy-together groups with members cannot be closed before activation."

    return True, None


def get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def build_rate_limit_identity(request, username=None):
    ip_part = get_client_ip(request)
    user_part = (username or "").strip().lower()
    return f"{ip_part}:{user_part}"


def get_group_buy_held_members(group):
    return GroupMember.objects.filter(group=group, escrow_status="held").select_related("user", "group")


def get_group_buy_held_amount(group):
    return sum_member_contribution_amounts(get_group_buy_held_members(group))


def get_sharing_held_members(group):
    return GroupMember.objects.filter(group=group, escrow_status="held").select_related("user", "group")


def get_group_buy_confirmed_member_count(group):
    return GroupMember.objects.filter(
        group=group,
        escrow_status="held",
        access_confirmed=True,
    ).count()


def get_group_buy_access_issue_count(group):
    return GroupMember.objects.filter(
        group=group,
        escrow_status="held",
        access_issue_reported=True,
    ).count()


def build_group_buy_purchase_proof(group, request=None):
    if group.mode != "group_buy":
        return None

    file_url = None
    file_name = ""
    if group.purchase_proof:
        file_name = os.path.basename(group.purchase_proof.name)
        try:
            relative_url = group.purchase_proof.url
            file_url = request.build_absolute_uri(relative_url) if request else relative_url
        except ValueError:
            file_url = None

    return {
        "available": bool(group.purchase_proof),
        "file_name": file_name,
        "file_url": file_url,
        "purchase_reference": group.purchase_reference,
        "purchase_notes": group.purchase_notes,
        "submitted_at": group.proof_submitted_at,
        "review_status": group.proof_review_status,
        "review_notes": group.proof_review_notes,
        "reviewed_at": group.proof_reviewed_at,
        "reviewed_by": group.proof_reviewed_by.username if group.proof_reviewed_by else "",
    }


def release_group_buy_held_funds(group_id, allow_timeout_release=False):
    release_amount = Decimal("0.00")
    released_at = timezone.now()

    with transaction.atomic():
        try:
            group = Group.objects.select_for_update().get(id=group_id, mode="group_buy")
        except Group.DoesNotExist:
            return release_amount, False

        held_members = list(get_group_buy_held_members(group))
        if not held_members or group.status != "proof_submitted":
            return release_amount, False

        if any(member.access_issue_reported for member in held_members):
            return release_amount, False

        confirmed_count = sum(1 for member in held_members if member.access_confirmed)
        if len(held_members) < group.total_slots:
            return release_amount, False

        if not allow_timeout_release and confirmed_count < len(held_members):
            return release_amount, False

        group.status = "purchasing"
        group.save(update_fields=["status"])

        owner_wallet, _ = Wallet.objects.select_for_update().get_or_create(user=group.owner)
        gross_release_amount = sum_member_contribution_amounts(held_members)
        creator_platform_fee_amount = get_group_earning_platform_fee_amount(gross_release_amount)
        release_amount = get_group_earning_payout_amount(gross_release_amount)
        owner_wallet.balance += release_amount
        owner_wallet.save()

        Transaction.objects.create(
            user=group.owner,
            group=group,
            amount=release_amount,
            type="credit",
            status="success",
            payment_method="group_buy_escrow_release",
        )

        for member in held_members:
            member_amount = get_member_contribution_amount(member)
            member.escrow_status = "released"
            member.save(update_fields=["escrow_status"])
            EscrowLedger.objects.create(
                user=member.user,
                group=group,
                member=member,
                amount=member_amount,
                entry_type="release",
                status="success",
            )

        group.status = "active"
        group.funds_released_at = released_at
        group.purchase_deadline_at = None
        group.auto_refund_at = None
        group.save(update_fields=["status", "funds_released_at", "purchase_deadline_at", "auto_refund_at"])

        fee_note = (
            f" A 5% platform fee of Rs {creator_platform_fee_amount} was deducted from the payout."
            if creator_platform_fee_amount > Decimal("0.00")
            else ""
        )
        owner_message = (
            f"All members confirmed receiving {group.subscription.name}. Held funds were released to your wallet.{fee_note}"
            if not allow_timeout_release
            else f"The confirmation window for {group.subscription.name} ended without disputes. Held funds were released automatically.{fee_note}"
        )
        Notification.objects.create(user=group.owner, message=owner_message)
        for member in GroupMember.objects.filter(group=group).select_related("user"):
            Notification.objects.create(
                user=member.user,
                message=(
                    f"{group.subscription.name} is now active and the buy-together payout has been released."
                    if not allow_timeout_release
                    else f"{group.subscription.name} is now active. The confirmation window ended without disputes, so payout was released automatically."
                ),
            )

    if release_amount > Decimal("0.00"):
        log_operation_event(
            "group_buy_payout_released",
            group_id=group_id,
            owner_id=group.owner_id,
            owner_username=group.owner.username,
            gross_release_amount=gross_release_amount,
            released_amount=release_amount,
            platform_fee_amount=creator_platform_fee_amount,
            member_count=len(held_members),
            release_reason="timeout_release" if allow_timeout_release else "member_confirmed",
        )

    return release_amount, True


def release_sharing_member_funds(member_id):
    released_amount = Decimal("0.00")

    with transaction.atomic():
        try:
            member = (
                GroupMember.objects.select_for_update()
                .select_related("group", "group__owner", "group__subscription", "user")
                .get(id=member_id)
            )
        except GroupMember.DoesNotExist:
            return released_amount, False

        if member.group.mode != "sharing" or member.escrow_status != "held" or not member.has_paid:
            return released_amount, False

        owner_wallet, _ = Wallet.objects.select_for_update().get_or_create(user=member.group.owner)
        gross_release_amount = get_member_contribution_amount(member)
        creator_platform_fee_amount = get_group_earning_platform_fee_amount(gross_release_amount)
        released_amount = get_group_earning_payout_amount(gross_release_amount)
        owner_wallet.balance += released_amount
        owner_wallet.save()

        Transaction.objects.create(
            user=member.group.owner,
            group=member.group,
            amount=released_amount,
            type="credit",
            status="success",
            payment_method="group_share_payout",
        )

        member.escrow_status = "released"
        member.save(update_fields=["escrow_status"])

        EscrowLedger.objects.create(
            user=member.user,
            group=member.group,
            member=member,
            amount=released_amount,
            entry_type="release",
            status="success",
        )

        member.group.status = "active"
        member.group.save(update_fields=["status"])

        Notification.objects.create(
            user=member.group.owner,
            message=(
                f"{member.user.username} confirmed receiving access for {member.group.subscription.name}. "
                f"Your payout was released to your wallet after a 5% platform fee of Rs {creator_platform_fee_amount}."
            ),
        )
        Notification.objects.create(
            user=member.user,
            message=(
                f"You confirmed access for {member.group.subscription.name}. "
                "The host payout has now been released."
            ),
        )

    if released_amount > Decimal("0.00"):
        log_operation_event(
            "sharing_payout_released",
            group_id=member.group_id,
            member_id=member.id,
            member_user_id=member.user_id,
            owner_id=member.group.owner_id,
            owner_username=member.group.owner.username,
            gross_release_amount=gross_release_amount,
            released_amount=released_amount,
            platform_fee_amount=creator_platform_fee_amount,
            subscription_name=member.group.subscription.name,
        )

    return released_amount, True


def refund_group_buy_held_funds(group_id, reason="manual"):
    refunded_amount = Decimal("0.00")
    refunded_at = timezone.now()

    with transaction.atomic():
        try:
            group = (
                Group.objects.select_for_update()
                .select_related("subscription", "owner")
                .get(id=group_id, mode="group_buy")
            )
        except Group.DoesNotExist:
            return refunded_amount

        held_members = list(
            GroupMember.objects.filter(group=group, escrow_status="held").select_related("user")
        )
        if not held_members:
            return refunded_amount

        group.status = "refunding"
        group.save(update_fields=["status"])

        for member in held_members:
            member_amount = get_member_contribution_amount(member)
            refund_amount = get_member_charged_amount(member)
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=member.user)
            wallet.balance += refund_amount
            wallet.save()

            member.escrow_status = "refunded"
            member.refund_amount = refund_amount
            member.refund_processed_at = refunded_at
            member.save(update_fields=["escrow_status", "refund_amount", "refund_processed_at"])

            Transaction.objects.create(
                user=member.user,
                group=group,
                amount=refund_amount,
                type="credit",
                status="success",
                payment_method="refund",
            )
            EscrowLedger.objects.create(
                user=member.user,
                group=group,
                member=member,
                amount=member_amount,
                entry_type="refund",
                status="success",
            )

            if reason == "deadline_expired":
                message = (
                    f"{group.subscription.name} missed its buy-together deadline. "
                    "Your held contribution has been refunded."
                )
            else:
                message = f"Your held contribution for {group.subscription.name} has been refunded."

            Notification.objects.create(
                user=member.user,
                message=message,
            )
            refunded_amount += refund_amount

        group.status = "refunded"
        group.is_refunded = True
        group.purchase_deadline_at = None
        group.auto_refund_at = None
        group.save(
            update_fields=["status", "is_refunded", "purchase_deadline_at", "auto_refund_at"]
        )

        owner_message = (
            f"{group.subscription.name} missed its buy-together deadline and member funds were auto-refunded."
            if reason == "deadline_expired"
            else f"You refunded held member contributions for {group.subscription.name}."
        )
        Notification.objects.create(
            user=group.owner,
            message=owner_message,
        )

    if refunded_amount > Decimal("0.00"):
        log_operation_event(
            "group_buy_funds_refunded",
            group_id=group_id,
            owner_id=group.owner_id,
            owner_username=group.owner.username,
            refunded_amount=refunded_amount,
            reason=reason,
            member_count=len(held_members),
        )

    return refunded_amount


def process_expired_buy_together_refunds(group_ids=None):
    expired_refund_groups = Group.objects.filter(
        mode="group_buy",
        status="awaiting_purchase",
        auto_refund_at__isnull=False,
        auto_refund_at__lte=timezone.now(),
    )
    expired_release_groups = Group.objects.filter(
        mode="group_buy",
        status="proof_submitted",
        auto_refund_at__isnull=False,
        auto_refund_at__lte=timezone.now(),
    )

    if group_ids is not None:
        expired_refund_groups = expired_refund_groups.filter(id__in=group_ids)
        expired_release_groups = expired_release_groups.filter(id__in=group_ids)

    refund_ids = list(expired_refund_groups.values_list("id", flat=True))
    release_ids = list(expired_release_groups.values_list("id", flat=True))
    refunded_total = Decimal("0.00")
    released_total = Decimal("0.00")
    released_groups = 0

    for group_id in refund_ids:
        refunded_total += refund_group_buy_held_funds(group_id, reason="deadline_expired")

    for group_id in release_ids:
        release_amount, released = release_group_buy_held_funds(
            group_id,
            allow_timeout_release=True,
        )
        if released:
            released_groups += 1
            released_total += release_amount

    return {
        "processed_groups": len(refund_ids) + released_groups,
        "refunded_amount": refunded_total,
        "released_amount": released_total,
        "released_groups": released_groups,
    }


def can_user_access_group_credentials(user, group):
    if group.mode != "sharing":
        return False

    return group.owner_id == user.id


def can_user_join_group_chat(user, group):
    if group.owner_id == user.id:
        return True

    return GroupMember.objects.filter(group=group, user=user).exists()


def get_group_chat_participants(group):
    participants = [group.owner_id]
    participants.extend(
        GroupMember.objects.filter(group=group)
        .values_list("user_id", flat=True)
    )
    return set(participants)


def get_group_chat_unread_count(user, group):
    read_state = GroupChatReadState.objects.filter(group=group, user=user).first()
    unread_messages = GroupChatMessage.objects.filter(group=group).exclude(sender=user)
    if read_state:
        unread_messages = unread_messages.filter(created_at__gt=read_state.last_read_at)
    return unread_messages.count()


def mark_group_chat_read(user, group):
    GroupChatReadState.objects.update_or_create(
        group=group,
        user=user,
        defaults={"last_read_at": timezone.now()},
    )


def build_name_initials(value):
    return "".join(part[0].upper() for part in str(value or "").split()[:2] if part) or "SV"


def get_group_chat_presence_state(presence, now=None):
    reference_time = now or timezone.now()
    online_threshold = reference_time - timedelta(minutes=GROUP_CHAT_ONLINE_WINDOW_MINUTES)
    recent_threshold = reference_time - timedelta(minutes=GROUP_CHAT_RECENT_WINDOW_MINUTES)
    typing_threshold = reference_time - timedelta(seconds=GROUP_CHAT_TYPING_WINDOW_SECONDS)

    last_seen_at = getattr(presence, "last_seen_at", None)
    typing_updated_at = getattr(presence, "typing_updated_at", None)
    is_typing = bool(
        presence
        and presence.is_typing
        and typing_updated_at
        and typing_updated_at >= typing_threshold
    )

    if last_seen_at and last_seen_at >= online_threshold:
        status = "online"
        label = "Online"
    elif last_seen_at and last_seen_at >= recent_threshold:
        status = "recent"
        label = "Active recently"
    else:
        status = "offline"
        label = "Offline"

    return {
        "status": status,
        "label": label,
        "is_online": status == "online",
        "is_typing": is_typing,
        "last_seen_at": last_seen_at,
    }


def touch_group_chat_presence(user, group, is_typing=None):
    now = timezone.now()
    defaults = {"last_seen_at": now}
    if is_typing is not None:
        defaults["is_typing"] = bool(is_typing)
        defaults["typing_updated_at"] = now

    return GroupChatPresence.objects.update_or_create(
        group=group,
        user=user,
        defaults=defaults,
    )[0]


def serialize_group_chat_participant(user, role, presence, now=None, current_user=None):
    presence_state = get_group_chat_presence_state(presence, now=now)
    return {
        "username": user.username,
        "role": role,
        "initials": build_name_initials(user.username),
        "is_self": bool(current_user and user.id == current_user.id),
        "presence": presence_state,
    }


def build_group_chat_activity_snapshot(group, current_user=None, presence_map=None, now=None):
    reference_time = now or timezone.now()
    participant_users = [group.owner]
    participant_users.extend(
        member.user
        for member in GroupMember.objects.filter(group=group).select_related("user")
    )

    seen_user_ids = set()
    serialized_participants = []
    active_typing_users = []
    online_participant_count = 0

    for participant in participant_users:
        if participant.id in seen_user_ids:
            continue
        seen_user_ids.add(participant.id)
        presence = (presence_map or {}).get(participant.id)
        serialized_participant = serialize_group_chat_participant(
            participant,
            "owner" if participant.id == group.owner_id else "member",
            presence,
            now=reference_time,
            current_user=current_user,
        )
        serialized_participants.append(serialized_participant)

        if serialized_participant["presence"]["is_online"]:
            online_participant_count += 1

        if (
            serialized_participant["presence"]["is_typing"]
            and current_user
            and participant.id != current_user.id
        ):
            active_typing_users.append(participant.username)

    return {
        "participants": serialized_participants,
        "participant_count": len(serialized_participants),
        "online_participant_count": online_participant_count,
        "active_typing_users": active_typing_users[:3],
        "has_someone_typing": bool(active_typing_users),
    }


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
        "created_at": notification.created_at,
        "category": metadata["category"],
        "category_label": metadata["category_label"],
        "kind": metadata["kind"],
        "icon": metadata["icon"],
        "tone": metadata["tone"],
        "context_title": metadata["context_title"],
    }


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            database_status = "ok"
            status_code = 200
        except DatabaseError:
            database_status = "unavailable"
            status_code = 503

        return Response(
            {
                "status": "ok" if database_status == "ok" else "degraded",
                "database": database_status,
                "payments": build_wallet_payment_config()["mode"],
                "payouts": build_wallet_payout_config()["mode"],
            },
            status=status_code,
        )


def build_wallet_payment_config():
    key_id = (getattr(settings, "RAZORPAY_KEY_ID", "") or "").strip()
    key_secret = (getattr(settings, "RAZORPAY_KEY_SECRET", "") or "").strip()
    webhook_secret = (getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "") or "").strip()
    topup_enabled = bool(key_id and key_secret)
    webhook_enabled = bool(topup_enabled and webhook_secret)
    is_live_mode = key_id.startswith("rzp_live_")

    if not topup_enabled:
        mode = "unconfigured"
        label = "Payments not configured"
        helper_text = "Add Razorpay keys on the backend before accepting wallet top-ups."
    elif is_live_mode:
        mode = "live"
        label = "Live payments"
        helper_text = (
            "Real charges are enabled through your live Razorpay account and webhook confirmation is active."
            if webhook_enabled
            else "Real charges are enabled, but add a Razorpay webhook secret for resilient payment confirmation."
        )
    else:
        mode = "test"
        label = "Test payments"
        helper_text = (
            "Checkout is using Razorpay test mode with webhook confirmation enabled."
            if webhook_enabled
            else "Checkout is using Razorpay test mode and will not charge real money."
        )

    return {
        "provider": "razorpay",
        "topup_enabled": topup_enabled,
        "webhook_enabled": webhook_enabled,
        "mode": mode,
        "mode_label": label,
        "is_live_mode": is_live_mode,
        "helper_text": helper_text,
    }


def build_wallet_payout_config():
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
    webhook_secret = (
        getattr(settings, "RAZORPAYX_WEBHOOK_SECRET", "")
        or getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
        or ""
    ).strip()
    source_account_number = (getattr(settings, "RAZORPAYX_SOURCE_ACCOUNT_NUMBER", "") or "").strip()
    payout_enabled = bool(key_id and key_secret and source_account_number)
    webhook_enabled = bool(payout_enabled and webhook_secret)
    manual_review_enabled = not payout_enabled
    is_live_mode = bool(payout_enabled and key_id.startswith("rzp_live_"))

    if manual_review_enabled:
        mode = "manual_review"
        label = "Manual review payouts"
        helper_text = (
            "Withdrawal requests are live through manual review. "
            "Users can save a payout destination and request a withdrawal, "
            "then admins complete the transfer manually within 24 hours."
        )
    elif is_live_mode:
        mode = "live"
        label = "Live payouts"
        helper_text = (
            "Real withdrawals are enabled through RazorpayX and payout webhooks are active."
            if webhook_enabled
            else "Real withdrawals are enabled. Add a RazorpayX webhook secret to keep payout status resilient."
        )
    else:
        mode = "test"
        label = "Test payouts"
        helper_text = (
            "Withdrawals are using RazorpayX test mode with webhook confirmation enabled."
            if webhook_enabled
            else "Withdrawals are using RazorpayX test mode."
        )

    return {
        "provider": "razorpayx" if payout_enabled else "manual",
        "payout_enabled": payout_enabled,
        "manual_review_enabled": manual_review_enabled,
        "webhook_enabled": webhook_enabled,
        "mode": mode,
        "mode_label": label,
        "is_live_mode": is_live_mode,
        "helper_text": helper_text,
    }


def convert_decimal_amount_to_subunits(amount):
    normalized_amount = amount.quantize(Decimal("0.01"))
    return int((normalized_amount * 100).quantize(Decimal("1")))


def build_wallet_topup_response_payload(order):
    return {
        "topup_id": order.id,
        "amount": str(order.amount),
        "currency": order.currency,
        "status": order.status,
        "provider_order_id": order.provider_order_id,
    }


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


def build_payout_contact_name(user, serializer_data):
    return (
        serializer_data.get("contact_name")
        or serializer_data.get("bank_account_holder_name")
        or user.get_full_name().strip()
        or user.username
    )


def build_payout_destination_label(payout_account):
    if payout_account.account_type == "vpa":
        masked = payout_account.get_masked_destination()
        return f"UPI {masked}" if masked else "UPI payout"
    masked = payout_account.get_masked_destination()
    return f"Bank {masked}" if masked else "Bank payout"


def sanitize_payout_narration(value):
    normalized = re.sub(r"[^A-Za-z0-9 ]+", " ", (value or "").strip())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized[:30] or "ShareVerse Payout"


def sync_payout_account_with_provider(user, validated_data, existing_account=None):
    contact_name = build_payout_contact_name(user, validated_data)
    contact_email = validated_data.get("contact_email") or user.email or ""
    contact_phone = validated_data.get("contact_phone") or user.phone or ""
    account_type = validated_data["account_type"]

    contact_reference = f"user_{user.id}_{secrets.token_hex(4)}"
    contact_payload = create_razorpayx_contact(
        name=contact_name,
        email=contact_email,
        contact=contact_phone,
        contact_type="customer",
        reference_id=contact_reference[:40],
        notes={
            "user_id": str(user.id),
            "username": user.username,
            "purpose": "wallet_payout",
        },
    )

    if account_type == "bank_account":
        fund_account_payload = create_razorpayx_bank_fund_account(
            contact_id=contact_payload["id"],
            account_holder_name=validated_data["bank_account_holder_name"],
            ifsc=validated_data["bank_account_ifsc"],
            account_number=validated_data["bank_account_number"],
        )
    else:
        fund_account_payload = create_razorpayx_vpa_fund_account(
            contact_id=contact_payload["id"],
            vpa_address=validated_data["vpa_address"],
        )

    payout_account = existing_account or PayoutAccount(user=user)
    payout_account.account_type = account_type
    payout_account.contact_name = contact_name
    payout_account.contact_email = contact_email
    payout_account.contact_phone = contact_phone
    payout_account.contact_type = "customer"
    payout_account.provider_contact_id = contact_payload["id"]
    payout_account.provider_fund_account_id = fund_account_payload["id"]
    payout_account.is_active = True
    payout_account.last_error = ""
    payout_account.last_synced_at = timezone.now()

    if account_type == "bank_account":
        payout_account.bank_account_holder_name = validated_data["bank_account_holder_name"]
        payout_account.bank_account_ifsc = validated_data["bank_account_ifsc"]
        payout_account.set_bank_account_number(validated_data["bank_account_number"])
        payout_account.clear_vpa()
    else:
        payout_account.set_vpa_address(validated_data["vpa_address"])
        payout_account.clear_bank_account()

    payout_account.save()
    return payout_account


def normalize_wallet_payout_status(provider_status):
    normalized = (provider_status or "").strip().lower()
    if normalized in {"queued", "pending", "processing", "initiated"}:
        return normalized if normalized != "initiated" else "processing"
    if normalized in {"processed", "reversed", "cancelled", "rejected", "failed"}:
        return normalized
    return "pending"


def restore_wallet_for_failed_payout(locked_payout):
    if locked_payout.wallet_restored_at:
        return False

    wallet, _ = Wallet.objects.select_for_update().get_or_create(user=locked_payout.user)
    wallet.balance += locked_payout.amount
    wallet.save()

    refund_transaction = Transaction.objects.create(
        user=locked_payout.user,
        group=None,
        amount=locked_payout.amount,
        type="credit",
        status="success",
        payment_method="wallet_payout_reversal",
    )

    locked_payout.wallet_restored_at = timezone.now()
    locked_payout.refund_transaction = refund_transaction
    log_operation_event(
        "wallet_payout_restored",
        payout_id=locked_payout.id,
        user_id=locked_payout.user_id,
        username=locked_payout.user.username,
        amount=locked_payout.amount,
        provider=locked_payout.provider,
        status=locked_payout.status,
        refund_transaction_id=refund_transaction.id,
    )
    return True


def apply_wallet_payout_state(wallet_payout_id, payout_details, *, status_source="api"):
    with transaction.atomic():
        locked_payout = (
            WalletPayout.objects.select_for_update()
            .select_related("user", "transaction", "refund_transaction")
            .get(id=wallet_payout_id)
        )

        provider_status = normalize_wallet_payout_status(payout_details.get("status"))
        locked_payout.provider_payout_id = payout_details.get("id") or locked_payout.provider_payout_id
        locked_payout.provider_contact_id = (
            payout_details.get("fund_account", {}) or {}
        ).get("contact_id", locked_payout.provider_contact_id)
        locked_payout.provider_fund_account_id = payout_details.get("fund_account_id") or locked_payout.provider_fund_account_id
        locked_payout.status = provider_status
        locked_payout.status_details = payout_details
        locked_payout.failure_reason = (
            (payout_details.get("status_details") or {}).get("description")
            or payout_details.get("failure_reason")
            or locked_payout.failure_reason
        )
        locked_payout.provider_status_source = status_source
        locked_payout.utr = payout_details.get("utr") or locked_payout.utr
        locked_payout.fees = int(payout_details.get("fees") or locked_payout.fees or 0)
        locked_payout.tax = int(payout_details.get("tax") or locked_payout.tax or 0)

        if provider_status == "processed" and not locked_payout.processed_at:
            locked_payout.processed_at = timezone.now()

        if locked_payout.transaction_id:
            payout_transaction = Transaction.objects.select_for_update().get(id=locked_payout.transaction_id)
            if provider_status == "processed":
                payout_transaction.status = "success"
            elif provider_status in {"queued", "pending", "processing"}:
                payout_transaction.status = "pending"
            else:
                payout_transaction.status = "failed"
            payout_transaction.save(update_fields=["status"])

        if provider_status in {"reversed", "cancelled", "rejected", "failed"}:
            restore_wallet_for_failed_payout(locked_payout)

        locked_payout.save()

    final_payout = WalletPayout.objects.select_related("payout_account").get(id=wallet_payout_id)
    log_operation_event(
        "wallet_payout_state_updated",
        payout_id=final_payout.id,
        user_id=final_payout.user_id,
        username=final_payout.user.username,
        provider=final_payout.provider,
        provider_payout_id=final_payout.provider_payout_id,
        provider_reference_id=final_payout.provider_reference_id,
        amount=final_payout.amount,
        status=final_payout.status,
        status_source=status_source,
        failure_reason=final_payout.failure_reason,
        utr=final_payout.utr,
    )
    return final_payout


def mark_wallet_topup_failed(topup_order, message, payment_id="", signature=""):
    update_fields = ["last_error", "status", "updated_at"]
    topup_order.last_error = message
    topup_order.status = "failed"

    if payment_id and topup_order.provider_payment_id != payment_id:
        topup_order.provider_payment_id = payment_id
        update_fields.append("provider_payment_id")

    if signature and topup_order.provider_signature != signature:
        topup_order.provider_signature = signature
        update_fields.append("provider_signature")

    topup_order.save(update_fields=update_fields)
    log_operation_event(
        "wallet_topup_failed",
        topup_order_id=topup_order.id,
        user_id=topup_order.user_id,
        username=topup_order.user.username,
        amount=topup_order.amount,
        currency=topup_order.currency,
        provider_order_id=topup_order.provider_order_id,
        payment_id=payment_id or topup_order.provider_payment_id,
        reason=message,
        status=topup_order.status,
    )


def validate_wallet_topup_payment_details(topup_order, payment_details):
    if payment_details.get("order_id") != topup_order.provider_order_id:
        return "This payment does not match the requested top-up."

    if int(payment_details.get("amount") or 0) != topup_order.amount_subunits:
        return "Payment amount does not match the top-up request."

    if (payment_details.get("currency") or "").upper() != topup_order.currency:
        return "Payment currency does not match the top-up request."

    return None


def ensure_wallet_topup_payment_captured(topup_order, payment_details):
    payment_captured = bool(payment_details.get("captured")) or payment_details.get("status") == "captured"
    if payment_captured:
        return payment_details, True

    if payment_details.get("status") == "authorized":
        payment_details = capture_razorpay_payment(
            payment_id=payment_details.get("id") or "",
            amount_subunits=topup_order.amount_subunits,
            currency=topup_order.currency,
        )
        payment_captured = bool(payment_details.get("captured")) or payment_details.get("status") == "captured"

    return payment_details, payment_captured


def credit_wallet_topup_order(topup_order_id, payment_id, signature=""):
    credited_now = False

    with transaction.atomic():
        locked_topup = WalletTopupOrder.objects.select_for_update().select_related("user").get(id=topup_order_id)
        wallet, _ = Wallet.objects.select_for_update().get_or_create(user=locked_topup.user)

        if locked_topup.status != "paid" or not locked_topup.credited_at:
            wallet.balance += locked_topup.amount
            wallet.save()

            Transaction.objects.create(
                user=locked_topup.user,
                group=None,
                amount=locked_topup.amount,
                type="credit",
                status="success",
                payment_method="wallet_topup",
            )

            locked_topup.status = "paid"
            locked_topup.provider_payment_id = payment_id
            locked_topup.provider_signature = signature or locked_topup.provider_signature
            locked_topup.credited_at = timezone.now()
            locked_topup.last_error = ""
            locked_topup.save(
                update_fields=[
                    "status",
                    "provider_payment_id",
                    "provider_signature",
                    "credited_at",
                    "last_error",
                    "updated_at",
                ]
            )
            credited_now = True

    final_topup = WalletTopupOrder.objects.select_related("user").get(id=topup_order_id)
    final_wallet, _ = Wallet.objects.get_or_create(user=final_topup.user)
    log_operation_event(
        "wallet_topup_credited",
        topup_order_id=final_topup.id,
        user_id=final_topup.user_id,
        username=final_topup.user.username,
        amount=final_topup.amount,
        currency=final_topup.currency,
        provider_order_id=final_topup.provider_order_id,
        payment_id=payment_id,
        credited_now=credited_now,
        wallet_balance=final_wallet.balance,
    )
    return credited_now, final_topup, final_wallet


def can_rate_group(group):
    return group.status in {"active", "closed"}


def build_user_rating_summary(user):
    aggregate = Review.objects.filter(reviewed_user=user).aggregate(
        average=Avg("rating"),
        count=Count("id"),
    )
    average = aggregate["average"]
    return {
        "average_rating": round(float(average), 1) if average is not None else None,
        "review_count": aggregate["count"] or 0,
    }


def build_review_summary_for_user(reviewed_user, reviewer=None, group=None):
    summary = build_user_rating_summary(reviewed_user)
    existing_review = None

    if reviewer and group:
        existing_review = Review.objects.filter(
            reviewer=reviewer,
            reviewed_user=reviewed_user,
            group=group,
        ).first()

    return {
        **summary,
        "can_review": bool(reviewer and group and can_rate_group(group)),
        "my_review": ReviewSerializer(existing_review).data if existing_review else None,
    }


def can_review_user_for_group(group, reviewer, reviewed_user):
    if reviewer.id == reviewed_user.id:
        return False, "You cannot rate yourself."

    if not can_rate_group(group):
        return False, "Ratings unlock after a group becomes active."

    if group.owner_id == reviewer.id:
        is_member = GroupMember.objects.filter(group=group, user=reviewed_user).exists()
        if not is_member:
            return False, "You can only rate members from this group."
        return True, None

    is_member = GroupMember.objects.filter(group=group, user=reviewer).exists()
    if not is_member:
        return False, "You are not part of this group."

    if reviewed_user.id != group.owner_id:
        return False, "Members can only rate the group creator."

    return True, None


def build_member_sharing_credentials(group):
    if group.mode != "sharing":
        return None

    return {
        "available": False,
        "requires_one_time_reveal": False,
        "message": "Access is coordinated privately by the group owner.",
    }


def build_owner_sharing_credentials(group):
    if group.mode != "sharing":
        return None

    credentials_ready = group.credentials_available()
    return {
        "available": credentials_ready,
        "requires_one_time_reveal": credentials_ready,
        "message": (
            "Generate a one-time reveal token to view current credentials."
            if credentials_ready
            else "Add credentials so members can access the shared subscription."
        ),
    }


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


def deliver_otp_code(channel, destination, otp_code, purpose):
    if channel != "email" or not destination:
        return False

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

    window_end = oldest_in_window.created_at + timedelta(minutes=SIGNUP_OTP_REQUEST_WINDOW_MINUTES)
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


def create_credential_reveal_token(user, group):
    CredentialRevealToken.objects.filter(user=user, group=group).delete()

    raw_token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timedelta(minutes=CREDENTIAL_REVEAL_TTL_MINUTES)

    CredentialRevealToken.objects.create(
        user=user,
        group=group,
        token_hash=CredentialRevealToken.build_token_hash(raw_token),
        expires_at=expires_at,
    )

    return raw_token, expires_at


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
        try:
            delivered = deliver_otp_code(channel, email, otp_code, "Signup verification")
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
                "message": "Username is available." if available else "This username is already in use.",
            }
        )


class SignupView(APIView):
    def post(self, request):
        serializer = SignupConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        username = serializer.validated_data["username"]
        email = serializer.validated_data["email"]
        phone = serializer.validated_data.get("phone", "")
        signup_session_id = serializer.validated_data["signup_session_id"]
        otp = serializer.validated_data["otp"]

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
                return Response({"error": "Invalid verification session."}, status=400)

            if otp_session.is_used:
                return Response({"error": "This verification session has already been used."}, status=400)

            if otp_session.expires_at <= timezone.now():
                return Response({"error": "OTP expired. Request a new code."}, status=400)

            if otp_session.attempts_remaining <= 0:
                return Response({"error": "OTP attempts exceeded. Request a new code."}, status=400)

            if otp_session.username.strip().lower() != username.lower():
                return Response({"error": "Verification session does not match this username."}, status=400)

            if otp_session.email.strip().lower() != email.lower():
                return Response({"error": "Verification session does not match this email."}, status=400)

            if (otp_session.phone or "").strip() != (phone or "").strip():
                return Response({"error": "Verification session does not match this phone number."}, status=400)

            if not otp_session.verify_otp(otp):
                otp_session.attempts_remaining = max(otp_session.attempts_remaining - 1, 0)
                otp_session.save(update_fields=["attempts_remaining"])
                return Response(
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
                }
            )
            if not user_serializer.is_valid():
                return Response(user_serializer.errors, status=400)

            user = user_serializer.save(is_verified=True)

            otp_session.is_used = True
            otp_session.save(update_fields=["is_used"])

            get_signup_otp_request_queryset(username, email, phone).exclude(id=otp_session.id).update(
                is_used=True
            )

        Notification.objects.create(
            user=user,
            message="Your account was created and verified successfully.",
        )
        return Response({"message": "User created and verified."}, status=201)


class LoginView(APIView):
    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password")

        login_identity = build_rate_limit_identity(request, username)
        current_lockout = get_rate_limit_status("login_failed", login_identity)
        if current_lockout["count"] >= LOGIN_FAILED_ATTEMPT_LIMIT:
            return Response(
                {
                    "error": "Too many failed login attempts.",
                    "retry_after_seconds": current_lockout["retry_after_seconds"],
                },
                status=429,
            )

        user = authenticate(username=username, password=password)

        if user is None:
            rate_result = check_and_increment_rate_limit(
                scope="login_failed",
                identity=login_identity,
                limit=LOGIN_FAILED_ATTEMPT_LIMIT,
                window_seconds=LOGIN_FAILED_ATTEMPT_WINDOW_SECONDS,
            )
            if not rate_result["allowed"]:
                return Response(
                    {
                        "error": "Too many failed login attempts.",
                        "retry_after_seconds": rate_result["retry_after_seconds"],
                    },
                    status=429,
                )
            return Response({"error": "Invalid credentials"}, status=401)

        reset_rate_limit("login_failed", login_identity)
        refresh = RefreshToken.for_user(user)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        })


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
        destination = user.email if channel == "email" else ""
        try:
            delivered = deliver_otp_code(channel, destination, otp_code, "Password reset")
        except Exception:
            delivered = False

        Notification.objects.create(
            user=user,
            message=f"Password reset OTP generated for {channel}.",
        )

        response = {
            "message": "OTP sent for password reset.",
            "reset_session_id": str(otp_session.id),
            "expires_in_seconds": PASSWORD_RESET_OTP_TTL_MINUTES * 60,
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

        username = serializer.validated_data["username"]
        reset_session_id = serializer.validated_data["reset_session_id"]
        otp = serializer.validated_data["otp"]
        new_password = serializer.validated_data["new_password"]

        confirm_identity = build_rate_limit_identity(request, username)
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
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
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
                return Response({"error": "This OTP session has already been used."}, status=400)

            if otp_session.expires_at <= timezone.now():
                return Response({"error": "OTP expired. Request a new code."}, status=400)

            if otp_session.attempts_remaining <= 0:
                return Response({"error": "OTP attempts exceeded. Request a new code."}, status=400)

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
                return Response({
                    "error": "Invalid OTP.",
                    "attempts_remaining": otp_session.attempts_remaining,
                }, status=400)

            user.set_password(new_password)
            user.save()

            otp_session.is_used = True
            otp_session.save(update_fields=["is_used"])

            PasswordResetOTP.objects.filter(
                user=user,
                is_used=False,
            ).exclude(id=otp_session.id).update(is_used=True)

        return Response({"message": "Password reset successful"})


class CreateGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateGroupSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated_data = serializer.validated_data
        subscription_name = validated_data["subscription_name"]
        mode = validated_data["mode"]
        access_identifier = validated_data.get("access_identifier", "")
        access_password = validated_data.get("access_password", "")
        access_notes = validated_data.get("access_notes", "")

        subscription, _ = Subscription.objects.get_or_create(
            name=subscription_name,
            defaults={
                "max_slots": 5,
                "category": validated_data.get("category", "general"),
                "price": validated_data.get("subscription_price", 100),
            },
        )

        group = Group(
            owner=request.user,
            subscription=subscription,
            total_slots=validated_data["total_slots"],
            price_per_slot=validated_data["price_per_slot"],
            start_date=validated_data["start_date"],
            end_date=validated_data["end_date"],
            mode=mode,
        )

        if mode == "sharing" and (access_identifier or access_password or access_notes):
            group.set_access_credentials(access_identifier, access_password, access_notes)
        else:
            group.clear_access_credentials()

        group.save()

        return Response({
            "message": "Group created successfully",
            "group_id": group.id,
        })


class JoinGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        group_id = request.data.get("group_id")

        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if group.status == "closed":
            return Response({"error": "This group has been closed by the owner"}, status=400)

        if group.owner == request.user:
            return Response({"error": "You cannot join your own group"}, status=400)

        if GroupMember.objects.filter(group=group, user=request.user).exists():
            return Response({"error": "Already joined"}, status=400)

        if GroupMember.objects.filter(group=group).count() >= group.total_slots:
            return Response({"error": "Group is full"}, status=400)

        pricing = get_group_join_pricing(group)
        if pricing["is_expired"]:
            return Response({"error": "This group's billing cycle has already ended"}, status=400)

        with transaction.atomic():
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=request.user)
            price = pricing["join_price"]
            contribution_amount = pricing["join_subtotal"]
            platform_fee_amount = pricing["platform_fee_amount"]

            if wallet.balance < price:
                return Response({"error": "Insufficient balance"}, status=400)

            wallet.balance -= price
            wallet.save()

            member = GroupMember.objects.create(
                group=group,
                user=request.user,
                has_paid=True,
                charged_amount=price,
                platform_fee_amount=platform_fee_amount,
                escrow_status="held",
            )

            Transaction.objects.create(
                user=request.user,
                group=group,
                amount=price,
                type="debit",
                status="success",
                payment_method="wallet",
            )

            if group.mode == "sharing":
                EscrowLedger.objects.create(
                    user=request.user,
                    group=group,
                    member=member,
                    amount=contribution_amount,
                    entry_type="hold",
                    status="success",
                )

                if group.status == "forming":
                    group.status = "collecting"
                    group.save(update_fields=["status"])
                Notification.objects.create(
                    user=group.owner,
                    message=(
                        f"{request.user.username} joined your {group.subscription.name} sharing group "
                        f"and paid Rs {price} (including Rs {platform_fee_amount} platform fee). "
                        "Payout will be released after the member confirms access."
                    ),
                )
                Notification.objects.create(
                    user=request.user,
                    message=(
                        f"You joined {group.subscription.name}. Confirm access after the host gives you access "
                        "so the host payout can be released."
                    ),
                )
            elif group.mode == "group_buy":
                EscrowLedger.objects.create(
                    user=request.user,
                    group=group,
                    member=member,
                    amount=contribution_amount,
                    entry_type="hold",
                    status="success",
                )

                if group.status == "forming":
                    group.status = "collecting"
                    group.save(update_fields=["status"])
                    Notification.objects.create(
                        user=group.owner,
                        message=(
                            f"{request.user.username} joined your {group.subscription.name} buy-together group. "
                            "The group is now collecting member contributions."
                        ),
                    )
                else:
                    Notification.objects.create(
                        user=group.owner,
                        message=(
                            f"{request.user.username} joined your {group.subscription.name} buy-together group."
                        ),
                    )

                paid_members = GroupMember.objects.filter(group=group, has_paid=True).count()

                if paid_members >= group.total_slots:
                    deadline = timezone.now() + timedelta(hours=BUY_TOGETHER_PURCHASE_DEADLINE_HOURS)
                    group.status = "awaiting_purchase"
                    group.purchase_deadline_at = deadline
                    group.auto_refund_at = deadline
                    group.save(update_fields=["status", "purchase_deadline_at", "auto_refund_at"])
                    Notification.objects.create(
                        user=group.owner,
                        message=(
                            f"Your {group.subscription.name} buy-together group is full. "
                            "Buy the subscription and upload proof before the deadline."
                        ),
                    )
                    for joined_member in GroupMember.objects.filter(group=group).select_related("user"):
                        Notification.objects.create(
                            user=joined_member.user,
                            message=(
                                f"{group.subscription.name} is now full. "
                                "The creator will buy the subscription and upload proof next."
                            ),
                        )

        log_operation_event(
            "group_join_funds_held",
            group_id=group.id,
            group_mode=group.mode,
            group_status=group.status,
            member_id=member.id,
            user_id=request.user.id,
            username=request.user.username,
            charged_amount=price,
            contribution_amount=contribution_amount,
            platform_fee_amount=platform_fee_amount,
            wallet_balance=wallet.balance,
        )

        return Response({
            "message": "Joined group successfully",
            "charged_amount": str(price),
            "join_subtotal": str(contribution_amount),
            "platform_fee_amount": str(platform_fee_amount),
            "price_per_slot": str(group.price_per_slot),
            "is_prorated": pricing["is_prorated"],
            "remaining_cycle_days": pricing["remaining_cycle_days"],
            "total_cycle_days": pricing["total_cycle_days"],
            "pricing_note": pricing["pricing_note"],
            "remaining_balance": str(wallet.balance),
            "group_mode": group.mode,
            "group_status": group.status,
            "credentials": build_member_sharing_credentials(group) if group.mode == "sharing" else None,
        })


class LeaveGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        group_id = request.data.get("group_id")

        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        try:
            member = GroupMember.objects.get(group=group, user=request.user)
        except GroupMember.DoesNotExist:
            return Response({"error": "You are not a member of this group"}, status=400)

        if group.owner == request.user:
            return Response({"error": "Owner cannot leave the group"}, status=400)

        member.delete()

        return Response({"message": "Left group successfully"}, status=200)


class GroupListView(ListAPIView):
    serializer_class = GroupListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["subscription__name"]
    filterset_fields = ["price_per_slot", "subscription"]
    ordering_fields = ["price_per_slot", "start_date"]

    def get_queryset(self):
        process_expired_buy_together_refunds()
        return Group.objects.annotate(
            filled_slots=Count("groupmember")
        ).filter(
            end_date__gte=timezone.localdate(),
            filled_slots__lt=F("total_slots")
        ).exclude(
            owner=self.request.user
        ).exclude(
            status__in=["closed", "refunding", "refunded", "failed"]
        )

    def get_serializer_context(self):
        return {"request": self.request}


class AddMoneyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletTopupOrderCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        payment_config = build_wallet_payment_config()
        if not payment_config["topup_enabled"]:
            return Response(
                {
                    "error": "Wallet top-ups are not configured on this server yet.",
                    "payment": payment_config,
                },
                status=503,
            )

        amount = serializer.validated_data["amount"].quantize(Decimal("0.01"))
        amount_subunits = convert_decimal_amount_to_subunits(amount)
        currency = settings.RAZORPAY_CURRENCY
        receipt = f"topup_{secrets.token_hex(12)}"

        try:
            gateway_order = create_razorpay_order(
                amount_subunits=amount_subunits,
                currency=currency,
                receipt=receipt,
                notes={
                    "user_id": str(request.user.id),
                    "username": request.user.username,
                    "purpose": "wallet_topup",
                },
            )
        except PaymentGatewayError as exc:
            log_operation_event(
                "wallet_topup_order_create_failed",
                user_id=request.user.id,
                username=request.user.username,
                amount=amount,
                currency=currency,
                reason=str(exc),
            )
            return Response({"error": str(exc)}, status=503)

        topup_order = WalletTopupOrder.objects.create(
            user=request.user,
            amount=amount,
            amount_subunits=amount_subunits,
            currency=currency,
            receipt=receipt,
            provider="razorpay",
            provider_order_id=gateway_order["id"],
        )

        log_operation_event(
            "wallet_topup_order_created",
            topup_order_id=topup_order.id,
            user_id=request.user.id,
            username=request.user.username,
            amount=amount,
            currency=currency,
            amount_subunits=amount_subunits,
            provider_order_id=gateway_order["id"],
            receipt=receipt,
        )

        full_name = (
            f"{request.user.first_name} {request.user.last_name}".strip()
            or request.user.username
        )

        return Response(
            {
                "message": "Checkout order created successfully.",
                "checkout": {
                    "key": settings.RAZORPAY_KEY_ID,
                    "name": settings.RAZORPAY_COMPANY_NAME,
                    "description": "Wallet top-up",
                    "amount": amount_subunits,
                    "currency": currency,
                    "order_id": gateway_order["id"],
                    "prefill": {
                        "name": full_name,
                        "email": request.user.email or "",
                        "contact": request.user.phone or "",
                    },
                },
                "topup": build_wallet_topup_response_payload(topup_order),
                "payment": payment_config,
            },
            status=201,
        )


class VerifyWalletTopupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletTopupVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        order_id = serializer.validated_data["razorpay_order_id"]
        payment_id = serializer.validated_data["razorpay_payment_id"]
        signature = serializer.validated_data["razorpay_signature"]

        try:
            topup_order = WalletTopupOrder.objects.get(
                provider="razorpay",
                provider_order_id=order_id,
                user=request.user,
            )
        except WalletTopupOrder.DoesNotExist:
            log_operation_event(
                "wallet_topup_verify_missing_order",
                user_id=request.user.id,
                username=request.user.username,
                provider_order_id=order_id,
                payment_id=payment_id,
            )
            return Response({"error": "Top-up order not found."}, status=404)

        if topup_order.status == "paid" and topup_order.credited_at:
            wallet, _ = Wallet.objects.get_or_create(user=request.user)
            return Response(
                {
                    "message": "Wallet top-up was already verified.",
                    "balance": str(wallet.balance),
                    "topup": build_wallet_topup_response_payload(topup_order),
                }
            )

        try:
            signature_valid = verify_razorpay_signature(order_id, payment_id, signature)
        except PaymentGatewayError as exc:
            log_operation_event(
                "wallet_topup_verify_gateway_error",
                topup_order_id=topup_order.id,
                user_id=request.user.id,
                username=request.user.username,
                provider_order_id=order_id,
                payment_id=payment_id,
                reason=str(exc),
            )
            return Response({"error": str(exc)}, status=503)

        if not signature_valid:
            mark_wallet_topup_failed(topup_order, "Signature verification failed.", payment_id, signature)
            return Response({"error": "Payment signature verification failed."}, status=400)

        try:
            payment_details = fetch_razorpay_payment(payment_id)
        except PaymentGatewayError as exc:
            log_operation_event(
                "wallet_topup_fetch_payment_failed",
                topup_order_id=topup_order.id,
                user_id=request.user.id,
                username=request.user.username,
                provider_order_id=order_id,
                payment_id=payment_id,
                reason=str(exc),
            )
            return Response({"error": str(exc)}, status=503)

        validation_error = validate_wallet_topup_payment_details(topup_order, payment_details)
        if validation_error:
            mark_wallet_topup_failed(topup_order, validation_error, payment_id, signature)
            return Response({"error": validation_error}, status=400)

        try:
            payment_details, payment_captured = ensure_wallet_topup_payment_captured(
                topup_order,
                payment_details,
            )
        except PaymentGatewayError as exc:
            log_operation_event(
                "wallet_topup_capture_failed",
                topup_order_id=topup_order.id,
                user_id=request.user.id,
                username=request.user.username,
                provider_order_id=order_id,
                payment_id=payment_id,
                reason=str(exc),
            )
            return Response({"error": str(exc)}, status=503)

        if not payment_captured:
            mark_wallet_topup_failed(
                topup_order,
                "Payment is not captured yet.",
                payment_id,
                signature,
            )
            return Response({"error": "Payment is not captured yet. Please try again shortly."}, status=400)

        credited_now, final_topup, final_wallet = credit_wallet_topup_order(
            topup_order.id,
            payment_id,
            signature=signature,
        )
        return Response(
            {
                "message": "Wallet top-up credited successfully."
                if credited_now
                else "Wallet top-up was already verified.",
                "balance": str(final_wallet.balance),
                "topup": build_wallet_topup_response_payload(final_topup),
            }
        )


class RazorpayWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw_body = request.body or b""
        signature = (request.META.get("HTTP_X_RAZORPAY_SIGNATURE") or "").strip()
        header_event_id = (request.META.get("HTTP_X_RAZORPAY_EVENT_ID") or "").strip()

        if not signature:
            return Response({"error": "Missing webhook signature."}, status=400)

        try:
            signature_valid = verify_razorpay_webhook_signature(raw_body, signature)
        except PaymentGatewayError as exc:
            return Response({"error": str(exc)}, status=503)

        if not signature_valid:
            return Response({"error": "Invalid webhook signature."}, status=400)

        try:
            event_payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            return Response({"error": "Invalid webhook payload."}, status=400)

        event_type = (event_payload.get("event") or "").strip()
        payment_entity = ((event_payload.get("payload") or {}).get("payment") or {}).get("entity") or {}
        order_entity = ((event_payload.get("payload") or {}).get("order") or {}).get("entity") or {}
        payment_id = (payment_entity.get("id") or "").strip()
        provider_order_id = (payment_entity.get("order_id") or order_entity.get("id") or "").strip()
        event_id = build_razorpay_webhook_event_id(
            raw_body,
            event_type=event_type,
            payment_id=payment_id,
            provider_order_id=provider_order_id,
            provided_id=header_event_id,
        )

        if RazorpayWebhookEvent.objects.filter(event_id=event_id).exists():
            log_operation_event(
                "wallet_topup_webhook_duplicate",
                event_id=event_id,
                event_type=event_type,
                provider_order_id=provider_order_id,
                payment_id=payment_id,
            )
            return Response({"message": "Webhook already processed."}, status=200)

        if event_type not in {"payment.authorized", "payment.captured", "order.paid"}:
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type or "unknown",
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="ignored",
                notes="Webhook event is not handled by wallet top-up processing.",
            )
            log_operation_event(
                "wallet_topup_webhook_ignored",
                event_id=event_id,
                event_type=event_type or "unknown",
                provider_order_id=provider_order_id,
                payment_id=payment_id,
            )
            return Response({"message": "Webhook ignored."}, status=200)

        if not provider_order_id or not payment_id:
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="failed",
                notes="Webhook payload did not include the required payment/order identifiers.",
            )
            log_operation_event(
                "wallet_topup_webhook_invalid_payload",
                event_id=event_id,
                event_type=event_type,
                provider_order_id=provider_order_id,
                payment_id=payment_id,
            )
            return Response({"message": "Webhook received without a matching top-up payload."}, status=200)

        topup_order = WalletTopupOrder.objects.filter(
            provider="razorpay",
            provider_order_id=provider_order_id,
        ).first()
        if not topup_order:
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="ignored",
                notes="No matching wallet top-up order was found.",
            )
            log_operation_event(
                "wallet_topup_webhook_missing_order",
                event_id=event_id,
                event_type=event_type,
                provider_order_id=provider_order_id,
                payment_id=payment_id,
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        payment_details = dict(payment_entity)
        payment_details.setdefault("order_id", provider_order_id)
        validation_error = validate_wallet_topup_payment_details(topup_order, payment_details)
        if validation_error:
            mark_wallet_topup_failed(topup_order, validation_error, payment_id)
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="failed",
                notes=validation_error,
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        try:
            payment_details, payment_captured = ensure_wallet_topup_payment_captured(
                topup_order,
                payment_details,
            )
        except PaymentGatewayError as exc:
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="failed",
                notes=str(exc),
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        if not payment_captured:
            message = "Payment is not captured yet."
            mark_wallet_topup_failed(topup_order, message, payment_id)
            RazorpayWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payment_id=payment_id,
                provider_order_id=provider_order_id,
                status="failed",
                notes=message,
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        credited_now, _, _ = credit_wallet_topup_order(topup_order.id, payment_id)
        RazorpayWebhookEvent.objects.create(
            event_id=event_id,
            event_type=event_type,
            payment_id=payment_id,
            provider_order_id=provider_order_id,
            status="processed",
            notes="Wallet top-up credited via webhook." if credited_now else "Webhook received after wallet was already credited.",
        )
        log_operation_event(
            "wallet_topup_webhook_processed",
            event_id=event_id,
            event_type=event_type,
            topup_order_id=topup_order.id,
            user_id=topup_order.user_id,
            username=topup_order.user.username,
            provider_order_id=provider_order_id,
            payment_id=payment_id,
            credited_now=credited_now,
        )
        return Response({"message": "Webhook processed successfully."}, status=200)


class PayoutAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payout_account = PayoutAccount.objects.filter(user=request.user).first()
        return Response({
            "payout_config": build_wallet_payout_config(),
            "payout_account": PayoutAccountSerializer(payout_account).data if payout_account else None,
        })

    def put(self, request):
        serializer = PayoutAccountUpsertSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        payout_config = build_wallet_payout_config()
        if not payout_config["payout_enabled"]:
            existing_account = PayoutAccount.objects.filter(user=request.user).first()
            payout_account = save_manual_payout_account(
                request.user,
                serializer.validated_data,
                existing_account=existing_account,
            )
            return Response(
                {
                    "message": "Withdrawal destination saved for manual review requests.",
                    "payout_account": PayoutAccountSerializer(payout_account).data,
                    "payout_config": payout_config,
                },
                status=200,
            )

        existing_account = PayoutAccount.objects.filter(user=request.user).first()

        try:
            payout_account = sync_payout_account_with_provider(
                request.user,
                serializer.validated_data,
                existing_account=existing_account,
            )
        except PaymentGatewayError as exc:
            if existing_account:
                existing_account.last_error = str(exc)
                existing_account.save(update_fields=["last_error", "updated_at"])
            log_operation_event(
                "payout_account_sync_failed",
                user_id=request.user.id,
                username=request.user.username,
                payout_account_id=existing_account.id if existing_account else None,
                account_type=serializer.validated_data.get("account_type"),
                reason=str(exc),
            )
            return Response({"error": str(exc)}, status=503)

        log_operation_event(
            "payout_account_saved",
            user_id=request.user.id,
            username=request.user.username,
            payout_account_id=payout_account.id,
            account_type=payout_account.account_type,
            destination_label=build_payout_destination_label(payout_account),
            provider="razorpayx",
        )

        return Response(
            {
                "message": "Payout account saved successfully.",
                "payout_account": PayoutAccountSerializer(payout_account).data,
                "payout_config": payout_config,
            },
            status=200,
        )


class WithdrawMoneyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletPayoutCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        payout_account = PayoutAccount.objects.filter(user=request.user, is_active=True).first()
        if not payout_account:
            return Response(
                {"error": "Add a payout method before requesting a withdrawal."},
                status=400,
            )

        amount = serializer.validated_data["amount"].quantize(Decimal("0.01"))
        payout_mode = serializer.validated_data["payout_mode"]
        payout_config = build_wallet_payout_config()
        if not payout_config["payout_enabled"]:
            try:
                wallet_payout = create_manual_wallet_payout_request(
                    user=request.user,
                    amount=amount,
                    payout_account=payout_account,
                    mode=payout_mode,
                )
            except ValidationError as exc:
                return Response({"error": exc.message}, status=400)

            wallet, _ = Wallet.objects.get_or_create(user=request.user)
            return Response(
                {
                    "message": "Withdrawal request submitted for manual review.",
                    "balance": str(wallet.balance),
                    "payout": WalletPayoutSerializer(wallet_payout).data,
                    "payout_config": payout_config,
                },
                status=201,
            )

        if not payout_account.provider_fund_account_id:
            return Response(
                {"error": "Add a payout method before requesting a withdrawal."},
                status=400,
            )

        if payout_account.account_type == "vpa":
            payout_mode = "UPI"
        elif payout_mode == "UPI":
            return Response({"error": "UPI mode is only available for a saved UPI payout method."}, status=400)

        amount_subunits = convert_decimal_amount_to_subunits(amount)
        destination_label = build_payout_destination_label(payout_account)
        source_account_number = (getattr(settings, "RAZORPAYX_SOURCE_ACCOUNT_NUMBER", "") or "").strip()
        reference_id = f"wd_{secrets.token_hex(12)}"[:40]
        idempotency_key = secrets.token_hex(24)
        narration = sanitize_payout_narration(f"ShareVerse {request.user.username}")

        with transaction.atomic():
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=request.user)
            if wallet.balance < amount:
                return Response({"error": "Insufficient wallet balance"}, status=400)

            wallet.balance -= amount
            wallet.save()

            payout_transaction = Transaction.objects.create(
                user=request.user,
                group=None,
                amount=amount,
                type="debit",
                status="pending",
                payment_method="wallet_payout",
            )

            wallet_payout = WalletPayout.objects.create(
                user=request.user,
                payout_account=payout_account,
                transaction=payout_transaction,
                amount=amount,
                amount_subunits=amount_subunits,
                currency=settings.RAZORPAY_CURRENCY,
                provider="razorpayx",
                provider_contact_id=payout_account.provider_contact_id,
                provider_fund_account_id=payout_account.provider_fund_account_id,
                provider_reference_id=reference_id,
                idempotency_key=idempotency_key,
                source_account_number=source_account_number,
                mode=payout_mode,
                purpose="payout",
                narration=narration,
                destination_label=destination_label,
                status="created",
                provider_status_source="api",
            )

        try:
            payout_response = create_razorpayx_payout(
                source_account_number=source_account_number,
                fund_account_id=payout_account.provider_fund_account_id,
                amount_subunits=amount_subunits,
                currency=settings.RAZORPAY_CURRENCY,
                mode=payout_mode,
                purpose="payout",
                narration=narration,
                reference_id=reference_id,
                notes={
                    "user_id": str(request.user.id),
                    "username": request.user.username,
                    "destination": destination_label,
                },
                idempotency_key=idempotency_key,
            )
        except PaymentGatewayError as exc:
            failed_payload = {
                "status": "failed",
                "failure_reason": str(exc),
                "status_details": {"description": str(exc)},
            }
            wallet_payout = apply_wallet_payout_state(wallet_payout.id, failed_payload, status_source="api_error")
            log_operation_event(
                "wallet_payout_create_failed",
                payout_id=wallet_payout.id,
                user_id=request.user.id,
                username=request.user.username,
                amount=amount,
                mode=payout_mode,
                provider="razorpayx",
                destination_label=destination_label,
                reason=str(exc),
            )
            wallet, _ = Wallet.objects.get_or_create(user=request.user)
            return Response(
                {
                    "error": str(exc),
                    "balance": str(wallet.balance),
                    "payout": WalletPayoutSerializer(wallet_payout).data,
                },
                status=503,
            )

        wallet_payout = apply_wallet_payout_state(wallet_payout.id, payout_response, status_source="api")
        log_operation_event(
            "wallet_payout_created",
            payout_id=wallet_payout.id,
            user_id=request.user.id,
            username=request.user.username,
            amount=amount,
            mode=payout_mode,
            provider="razorpayx",
            destination_label=destination_label,
            provider_reference_id=reference_id,
            provider_payout_id=wallet_payout.provider_payout_id,
            status=wallet_payout.status,
        )
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        return Response(
            {
                "message": "Withdrawal request created successfully.",
                "balance": str(wallet.balance),
                "payout": WalletPayoutSerializer(wallet_payout).data,
            },
            status=201,
        )


class WalletPayoutSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, payout_id):
        try:
            wallet_payout = WalletPayout.objects.get(id=payout_id, user=request.user)
        except WalletPayout.DoesNotExist:
            return Response({"error": "Payout request not found."}, status=404)

        if not wallet_payout.provider_payout_id:
            return Response(
                {
                    "message": "This payout was never accepted by the provider.",
                    "payout": WalletPayoutSerializer(wallet_payout).data,
                }
            )

        try:
            payout_response = fetch_razorpayx_payout(wallet_payout.provider_payout_id)
        except PaymentGatewayError as exc:
            return Response({"error": str(exc)}, status=503)

        wallet_payout = apply_wallet_payout_state(wallet_payout.id, payout_response, status_source="sync")
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        return Response(
            {
                "message": "Payout status refreshed.",
                "balance": str(wallet.balance),
                "payout": WalletPayoutSerializer(wallet_payout).data,
            }
        )


class RazorpayXPayoutWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw_body = request.body or b""
        signature = (request.META.get("HTTP_X_RAZORPAY_SIGNATURE") or "").strip()
        header_event_id = (request.META.get("HTTP_X_RAZORPAY_EVENT_ID") or "").strip()

        if not signature:
            return Response({"error": "Missing webhook signature."}, status=400)

        try:
            signature_valid = verify_razorpayx_webhook_signature(raw_body, signature)
        except PaymentGatewayError as exc:
            return Response({"error": str(exc)}, status=503)

        if not signature_valid:
            return Response({"error": "Invalid webhook signature."}, status=400)

        try:
            event_payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            return Response({"error": "Invalid webhook payload."}, status=400)

        event_type = (event_payload.get("event") or "").strip()
        payout_entity = ((event_payload.get("payload") or {}).get("payout") or {}).get("entity") or {}
        payout_id = (payout_entity.get("id") or "").strip()
        reference_id = (payout_entity.get("reference_id") or "").strip()
        event_id = build_razorpayx_webhook_event_id(
            raw_body,
            event_type=event_type,
            payout_id=payout_id,
            provided_id=header_event_id,
        )

        if RazorpayXPayoutWebhookEvent.objects.filter(event_id=event_id).exists():
            return Response({"message": "Webhook already processed."}, status=200)

        if not event_type.startswith("payout."):
            RazorpayXPayoutWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type or "unknown",
                payout_id=payout_id,
                status="ignored",
                notes="Webhook event is not handled by payout processing.",
            )
            return Response({"message": "Webhook ignored."}, status=200)

        if not payout_id:
            RazorpayXPayoutWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type or "unknown",
                payout_id="",
                status="failed",
                notes="Webhook payload did not include a payout id.",
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        wallet_payout = WalletPayout.objects.filter(provider_payout_id=payout_id).first()
        if not wallet_payout and reference_id:
            wallet_payout = WalletPayout.objects.filter(provider_reference_id=reference_id).first()

        if not wallet_payout:
            RazorpayXPayoutWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event_type,
                payout_id=payout_id,
                status="ignored",
                notes="No matching wallet payout was found.",
            )
            return Response({"message": "Webhook acknowledged."}, status=200)

        wallet_payout = apply_wallet_payout_state(wallet_payout.id, payout_entity, status_source="webhook")
        RazorpayXPayoutWebhookEvent.objects.create(
            event_id=event_id,
            event_type=event_type,
            payout_id=payout_id,
            status="processed",
            notes=f"Wallet payout updated to {wallet_payout.status}.",
        )
        return Response({"message": "Webhook processed successfully."}, status=200)


class TransactionHistoryView(ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).order_by("-created_at")


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        process_expired_buy_together_refunds()
        user = request.user
        wallet, _ = Wallet.objects.get_or_create(user=user)
        transactions = Transaction.objects.filter(user=user)
        payout_account = PayoutAccount.objects.filter(user=user).first()
        recent_payouts = WalletPayout.objects.filter(user=user).select_related("payout_account")[:5]
        owned_groups = Group.objects.filter(owner=user)

        total_credit = transactions.filter(type="credit").aggregate(total=Sum("amount"))["total"] or Decimal("0")
        total_debit = transactions.filter(type="debit").aggregate(total=Sum("amount"))["total"] or Decimal("0")
        sharing_groups = owned_groups.filter(mode="sharing")
        buy_together_groups = owned_groups.filter(mode="group_buy")
        owner_revenue = (
            Transaction.objects.filter(
                user=user,
                payment_method="group_share_payout",
                status="success",
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        )
        buy_together_released = (
            Transaction.objects.filter(
                user=user,
                payment_method="group_buy_escrow_release",
                status="success",
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        )
        waiting_buy_together_groups = buy_together_groups.exclude(
            status__in=["active", "closed", "refunding", "refunded", "failed"]
        ).count()
        held_buy_together_funds = sum(get_group_buy_held_amount(group) for group in buy_together_groups)

        memberships = (
            GroupMember.objects.filter(user=user)
            .select_related("group__subscription", "group__owner")
            .order_by("-joined_at", "-id")
        )
        groups = []
        for membership in memberships:
            charged_amount = get_member_charged_amount(membership)
            contribution_amount = get_member_contribution_amount(membership)
            platform_fee_amount = get_member_platform_fee_amount(membership)
            join_pricing = get_group_join_pricing(
                membership.group,
                reference_date=membership.joined_at,
            )
            owner_review_summary = build_review_summary_for_user(
                membership.group.owner,
                reviewer=user,
                group=membership.group,
            )
            groups.append(
                {
                    "id": membership.group.id,
                    "subscription_name": membership.group.subscription.name,
                    "owner_id": membership.group.owner_id,
                    "owner_name": membership.group.owner.username,
                    "mode": membership.group.mode,
                    "mode_label": get_mode_copy(membership.group.mode)["label"],
                    "status": membership.group.status,
                    "status_label": get_status_copy(membership.group),
                    "price_per_slot": str(membership.group.price_per_slot),
                    "charged_amount": str(charged_amount),
                    "contribution_amount": str(contribution_amount),
                    "platform_fee_amount": str(platform_fee_amount),
                    "is_prorated": (
                        membership.group.mode == "sharing"
                        and charged_amount < membership.group.price_per_slot
                    ),
                    "remaining_cycle_days": join_pricing["remaining_cycle_days"],
                    "total_cycle_days": join_pricing["total_cycle_days"],
                    "pricing_note": join_pricing["pricing_note"],
                    "credentials": build_member_sharing_credentials(membership.group),
                    "access_confirmation_required": (
                        (
                            membership.group.mode == "group_buy"
                            and membership.group.status in {"proof_submitted", "disputed"}
                        )
                        or membership.group.mode == "sharing"
                    )
                    and membership.escrow_status == "held"
                    and not membership.access_confirmed,
                    "can_report_access_issue": (
                        membership.group.mode == "group_buy"
                        and membership.group.status in {"proof_submitted", "disputed"}
                        and membership.escrow_status == "held"
                        and not membership.access_confirmed
                        and not membership.access_issue_reported
                    ),
                    "has_confirmed_access": membership.access_confirmed,
                    "has_reported_access_issue": membership.access_issue_reported,
                    "unread_chat_count": get_group_chat_unread_count(user, membership.group),
                    "confirmed_members": GroupMember.objects.filter(
                        group=membership.group,
                        has_paid=True,
                        access_confirmed=True,
                    ).count()
                    if membership.group.mode == "group_buy"
                    else 0,
                    "remaining_confirmations": max(
                        GroupMember.objects.filter(
                            group=membership.group,
                            has_paid=True,
                        ).count()
                        - GroupMember.objects.filter(
                            group=membership.group,
                            has_paid=True,
                            access_confirmed=True,
                        ).count(),
                        0,
                    )
                    if membership.group.mode == "group_buy"
                    and membership.group.status in {"proof_submitted", "disputed"}
                    else 0,
                    "reported_issues": GroupMember.objects.filter(
                        group=membership.group,
                        has_paid=True,
                        access_issue_reported=True,
                    ).count()
                    if membership.group.mode == "group_buy"
                    else 0,
                    "owner_rating": owner_review_summary,
                }
            )

        notifications = list(
            Notification.objects.filter(user=user)
            .order_by("-created_at")[:10]
            .values("id", "message", "is_read", "created_at")
        )

        groups_joined = memberships.count()
        active_groups = memberships.filter(group__status="active").count()

        return Response({
            "current_user": {
                "id": user.id,
                "username": user.username,
            },
            "balance": str(wallet.balance),
            "wallet_balance": str(wallet.balance),
            "wallet_payments": build_wallet_payment_config(),
            "wallet_payouts_config": build_wallet_payout_config(),
            "wallet_payout_account": PayoutAccountSerializer(payout_account).data if payout_account else None,
            "wallet_payouts": WalletPayoutSerializer(recent_payouts, many=True).data,
            "total_credit": str(total_credit),
            "total_debit": str(total_debit),
            "total_spent": str(total_debit),
            "groups_joined": groups_joined,
            "total_groups": groups_joined,
            "active_groups": active_groups,
            "owner_summary": {
                "total_groups_created": owned_groups.count(),
                "sharing_groups_created": sharing_groups.count(),
                "buy_together_groups_created": buy_together_groups.count(),
                "sharing_revenue": str(owner_revenue),
                "buy_together_waiting": waiting_buy_together_groups,
                "held_buy_together_funds": str(held_buy_together_funds),
                "buy_together_released": str(buy_together_released),
            },
            "groups": groups,
            "notifications": notifications,
        })


class NotificationView(ListAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user).order_by("-created_at")
        data = [build_notification_payload(notification) for notification in notifications]
        return Response(data)


class MarkNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(id=notification_id, user=request.user)
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found"}, status=404)

        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])

        return Response({"message": "Notification marked as read", "notification": build_notification_payload(notification)})


class MarkAllNotificationsReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated_count = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"message": "All notifications marked as read", "updated_count": updated_count})


class GroupChatView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_group_for_user(self, request, group_id):
        try:
            group = Group.objects.select_related("subscription", "owner").get(id=group_id)
        except Group.DoesNotExist:
            return None, Response({"error": "Group not found"}, status=404)

        if not can_user_join_group_chat(request.user, group):
            return None, Response({"error": "You are not allowed to access this group chat."}, status=403)

        return group, None

    def get(self, request, group_id):
        group, error_response = self._get_group_for_user(request, group_id)
        if error_response:
            return error_response

        messages = GroupChatMessage.objects.filter(group=group).select_related("sender")
        serialized_messages = GroupChatMessageSerializer(
            messages,
            many=True,
            context={"request": request},
        ).data

        mark_group_chat_read(request.user, group)
        touch_group_chat_presence(request.user, group)
        presence_map = {
            presence.user_id: presence
            for presence in GroupChatPresence.objects.filter(group=group).select_related("user")
        }
        activity_snapshot = build_group_chat_activity_snapshot(
            group,
            current_user=request.user,
            presence_map=presence_map,
        )

        return Response({
            "group": {
                "id": group.id,
                "subscription_name": group.subscription.name,
                "mode": group.mode,
                "mode_label": get_mode_copy(group.mode)["label"],
                "status": group.status,
                "status_label": get_status_copy(group),
                "owner_name": group.owner.username,
            },
            "participants": activity_snapshot["participants"],
            "messages": serialized_messages,
            "unread_chat_count": 0,
            "online_participant_count": activity_snapshot["online_participant_count"],
            "active_typing_users": activity_snapshot["active_typing_users"],
            "has_someone_typing": activity_snapshot["has_someone_typing"],
        })

    def post(self, request, group_id):
        group, error_response = self._get_group_for_user(request, group_id)
        if error_response:
            return error_response

        serializer = SendGroupChatMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        message = GroupChatMessage.objects.create(
            group=group,
            sender=request.user,
            message=serializer.validated_data["message"],
        )

        mark_group_chat_read(request.user, group)
        touch_group_chat_presence(request.user, group, is_typing=False)

        for participant_id in get_group_chat_participants(group):
            if participant_id == request.user.id:
                continue
            Notification.objects.create(
                user_id=participant_id,
                message=(
                    f"New group chat message in {group.subscription.name} from {request.user.username}."
                ),
            )

        serialized_message = GroupChatMessageSerializer(
            message,
            context={"request": request},
        ).data

        return Response({
            "message": "Chat message sent successfully.",
            "chat_message": serialized_message,
        }, status=201)

    def patch(self, request, group_id):
        group, error_response = self._get_group_for_user(request, group_id)
        if error_response:
            return error_response

        serializer = GroupChatPresenceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        presence = touch_group_chat_presence(
            request.user,
            group,
            is_typing=serializer.validated_data["is_typing"],
        )

        return Response(
            {
                "presence": get_group_chat_presence_state(presence),
                "username": request.user.username,
            }
        )


class GroupChatInboxView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        groups = (
            Group.objects.filter(Q(owner=user) | Q(groupmember__user=user))
            .select_related("subscription", "owner")
            .distinct()
        )
        group_ids = [group.id for group in groups]
        presence_rows = GroupChatPresence.objects.filter(group_id__in=group_ids).select_related("user")
        presence_by_group = {}
        for presence in presence_rows:
            presence_by_group.setdefault(presence.group_id, {})[presence.user_id] = presence

        chat_items = []
        total_unread_count = 0

        for group in groups:
            last_message = (
                GroupChatMessage.objects.filter(group=group)
                .select_related("sender")
                .order_by("-created_at", "-id")
                .first()
            )
            unread_count = get_group_chat_unread_count(user, group)
            total_unread_count += unread_count
            activity_snapshot = build_group_chat_activity_snapshot(
                group,
                current_user=user,
                presence_map=presence_by_group.get(group.id, {}),
            )

            chat_items.append(
                {
                    "group": {
                        "id": group.id,
                        "subscription_name": group.subscription.name,
                        "mode": group.mode,
                        "mode_label": get_mode_copy(group.mode)["label"],
                        "status": group.status,
                        "status_label": get_status_copy(group),
                        "owner_name": group.owner.username,
                        "created_at": group.created_at,
                    },
                    "is_owner": group.owner_id == user.id,
                    "unread_chat_count": unread_count,
                    "participant_count": activity_snapshot["participant_count"],
                    "participant_preview": activity_snapshot["participants"][:4],
                    "online_participant_count": activity_snapshot["online_participant_count"],
                    "active_typing_users": activity_snapshot["active_typing_users"],
                    "has_someone_typing": activity_snapshot["has_someone_typing"],
                    "message_count": GroupChatMessage.objects.filter(group=group).count(),
                    "last_message": (
                        {
                            "id": last_message.id,
                            "sender_username": last_message.sender.username,
                            "message": last_message.message,
                            "created_at": last_message.created_at,
                            "is_own": last_message.sender_id == user.id,
                        }
                        if last_message
                        else None
                    ),
                    "last_activity_at": last_message.created_at if last_message else group.created_at,
                }
            )

        chat_items.sort(
            key=lambda item: (item["last_activity_at"], item["group"]["id"]),
            reverse=True,
        )

        return Response(
            {
                "total_unread_count": total_unread_count,
                "total_chats": len(chat_items),
                "chats": chat_items,
            }
        )


def build_profile_response(user, request=None):
    wallet, _ = Wallet.objects.get_or_create(user=user)
    joined_groups = GroupMember.objects.filter(user=user)
    created_groups = Group.objects.filter(owner=user)
    transactions = Transaction.objects.filter(user=user)
    rating_summary = build_user_rating_summary(user)
    recent_reviews = Review.objects.filter(reviewed_user=user).select_related(
        "reviewer",
        "group__subscription",
    )[:5]

    total_spent = transactions.filter(type="debit").aggregate(total=Sum("amount"))["total"] or Decimal("0")
    total_earned = transactions.filter(
        type="credit",
        payment_method__in=["group_share_payout", "group_buy_escrow_release"],
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0")

    completed_fields = sum(
        bool(value)
        for value in [
            user.get_full_name(),
            user.email,
            user.phone,
            user.profile_picture,
        ]
    )
    completion_percent = int((completed_fields / 4) * 100)

    profile_picture_url = ""
    if user.profile_picture:
        try:
            relative_url = user.profile_picture.url
            profile_picture_url = request.build_absolute_uri(relative_url) if request else relative_url
        except ValueError:
            profile_picture_url = ""

    return {
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.get_full_name(),
        "email": user.email,
        "phone": user.phone,
        "profile_picture_url": profile_picture_url,
        "has_profile_picture": bool(profile_picture_url),
        "date_joined": user.date_joined,
        "trust_score": user.trust_score,
        "is_verified": user.is_verified,
        "is_staff": user.is_staff,
        "wallet_balance": str(wallet.balance),
        "groups_joined": joined_groups.count(),
        "groups_created": created_groups.count(),
        "active_memberships": joined_groups.filter(group__status="active").count(),
        "active_hosting": created_groups.filter(status="active").count(),
        "sharing_groups_created": created_groups.filter(mode="sharing").count(),
        "buy_together_groups_created": created_groups.filter(mode="group_buy").count(),
        "total_spent": str(total_spent),
        "total_earned": str(total_earned),
        "profile_completion": completion_percent,
        "average_rating": rating_summary["average_rating"],
        "review_count": rating_summary["review_count"],
        "recent_reviews": [
            {
                "id": review.id,
                "rating": review.rating,
                "comment": review.comment,
                "created_at": review.created_at,
                "reviewer_username": review.reviewer.username,
                "group_name": review.group.subscription.name,
            }
            for review in recent_reviews
        ],
    }


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(build_profile_response(request.user, request))

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        if serializer.is_valid():
            serializer.save()
            return Response(build_profile_response(request.user, request))
        return Response(serializer.errors, status=400)


class SubscriptionListView(APIView):
    def get(self, request):
        subs = Subscription.objects.all()
        data = [
            {
                "id": subscription.id,
                "name": subscription.name,
                "price": subscription.price,
            }
            for subscription in subs
        ]
        return Response(data)


class MyGroupsView(ListAPIView):
    serializer_class = GroupListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        process_expired_buy_together_refunds()
        return Group.objects.filter(owner=self.request.user).order_by("-created_at", "-id")

    def get_serializer_context(self):
        return {"request": self.request}


class MyGroupDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        process_expired_buy_together_refunds([group_id])
        try:
            group = Group.objects.select_related("subscription", "owner").get(
                id=group_id,
                owner=request.user,
            )
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        members = GroupMember.objects.filter(group=group).select_related("user", "group")
        member_data = []
        for member in members:
            review_summary = build_review_summary_for_user(
                member.user,
                reviewer=request.user,
                group=group,
            )
            member_data.append(
                {
                    "id": member.id,
                    "user_id": member.user_id,
                    "username": member.user.username,
                    "has_paid": member.has_paid,
                    "charged_amount": str(get_member_charged_amount(member)),
                    "contribution_amount": str(get_member_contribution_amount(member)),
                    "platform_fee_amount": str(get_member_platform_fee_amount(member)),
                    "escrow_status": member.escrow_status,
                    "access_confirmed": member.access_confirmed,
                    "access_confirmed_at": member.access_confirmed_at,
                    "access_issue_reported": member.access_issue_reported,
                    "access_issue_reported_at": member.access_issue_reported_at,
                    "access_issue_notes": member.access_issue_notes,
                    "refund_amount": str(member.refund_amount),
                    "joined_at": member.joined_at,
                    "status": member.status,
                    "rating": review_summary,
                }
            )

        paid_members = sum(1 for member in member_data if member["has_paid"])
        confirmed_members = sum(
            1
            for member in member_data
            if member["has_paid"] and member["access_confirmed"]
        )
        held_members = sum(
            1
            for member in member_data
            if member["has_paid"] and member["escrow_status"] == "held"
        )
        reported_issues = sum(
            1
            for member in member_data
            if member["has_paid"] and member["access_issue_reported"]
        )
        held_amount = get_group_buy_held_amount(group) if group.mode == "group_buy" else Decimal("0")
        released_amount = (
            Transaction.objects.filter(
                user=request.user,
                group=group,
                payment_method="group_buy_escrow_release",
                status="success",
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        )
        can_activate = (
            group.mode == "group_buy"
            and group.status == "proof_submitted"
            and held_members >= group.total_slots
            and confirmed_members >= held_members
        )
        can_refund = (
            group.mode == "group_buy"
            and group.status in {"collecting", "awaiting_purchase", "proof_submitted", "disputed", "failed"}
            and held_amount > 0
        )
        can_submit_proof = (
            group.mode == "group_buy"
            and group.status in {"awaiting_purchase", "proof_submitted"}
            and paid_members >= group.total_slots
        )

        return Response({
            "id": group.id,
            "subscription_name": group.subscription.name,
            "mode": group.mode,
            "mode_label": get_mode_copy(group.mode)["label"],
            "status": group.status,
            "status_label": get_status_copy(group),
            "price_per_slot": str(group.price_per_slot),
            "start_date": group.start_date,
            "end_date": group.end_date,
            "total_slots": group.total_slots,
            "filled_slots": len(member_data),
            "paid_members": paid_members,
            "confirmed_members": confirmed_members,
            "remaining_confirmations": max(paid_members - confirmed_members, 0)
            if group.status in {"proof_submitted", "disputed"}
            else 0,
            "reported_issues": reported_issues,
            "held_amount": str(held_amount),
            "released_amount": str(released_amount),
            "refundable_amount": str(held_amount),
            "purchase_deadline_at": group.purchase_deadline_at,
            "auto_refund_at": group.auto_refund_at,
            "proof_submitted_at": group.proof_submitted_at,
            "owner_revenue": str(
                Transaction.objects.filter(
                    user=request.user,
                    group=group,
                    payment_method__in=["group_share_payout", "group_buy_escrow_release"],
                    status="success",
                ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
            ),
            "purchase_proof": build_group_buy_purchase_proof(group, request),
            "can_submit_proof": can_submit_proof,
            "can_activate": can_activate,
            "can_refund": can_refund,
            "credentials": build_owner_sharing_credentials(group),
            "can_rate_members": can_rate_group(group),
            "members": member_data,
        })

    def patch(self, request, group_id):
        process_expired_buy_together_refunds([group_id])
        try:
            group = Group.objects.select_related("subscription", "owner").get(
                id=group_id,
                owner=request.user,
            )
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if group.status == "closed":
            return Response({"error": "Closed groups can no longer be edited"}, status=400)

        serializer = GroupUpdateSerializer(
            group,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Group updated successfully"})

        return Response(serializer.errors, status=400)

    def delete(self, request, group_id):
        process_expired_buy_together_refunds([group_id])
        try:
            group = Group.objects.get(id=group_id, owner=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if GroupMember.objects.filter(group=group).exists():
            return Response({"error": "Only empty groups can be deleted"}, status=400)

        group.delete()
        return Response(status=204)


class CloseGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        process_expired_buy_together_refunds([group_id])
        try:
            group = Group.objects.select_related("subscription").get(
                id=group_id,
                owner=request.user,
            )
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        can_close, error_message = can_close_group(group)
        if not can_close:
            return Response({"error": error_message}, status=400)

        members = GroupMember.objects.filter(group=group).select_related("user")

        with transaction.atomic():
            group.status = "closed"
            group.save(update_fields=["status"])

            for member in members:
                Notification.objects.create(
                    user=member.user,
                    message=f"{group.subscription.name} has been closed by the group owner.",
                )

        return Response({
            "message": "Group closed successfully",
            "status": group.status,
        })


class SubmitPurchaseProofView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        process_expired_buy_together_refunds([group_id])

        serializer = SubmitPurchaseProofSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            group = (
                Group.objects.select_related("subscription", "owner")
                .get(id=group_id, owner=request.user)
            )
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if group.mode != "group_buy":
            return Response({"error": "Only buy-together groups can upload purchase proof"}, status=400)

        if group.status not in {"awaiting_purchase", "proof_submitted"}:
            return Response({"error": "This group is not waiting for purchase proof"}, status=400)

        held_members = list(get_group_buy_held_members(group))
        if len(held_members) < group.total_slots:
            return Response({"error": "All member contributions must be held before proof can be submitted"}, status=400)

        with transaction.atomic():
            locked_group = (
                Group.objects.select_for_update()
                .select_related("subscription", "owner")
                .get(id=group.id)
            )

            if locked_group.purchase_proof:
                locked_group.purchase_proof.delete(save=False)

            locked_group.purchase_proof = serializer.validated_data["purchase_proof"]
            locked_group.purchase_reference = serializer.validated_data.get("purchase_reference", "")
            locked_group.purchase_notes = serializer.validated_data.get("purchase_notes", "")
            locked_group.proof_submitted_at = timezone.now()
            locked_group.status = "proof_submitted"
            locked_group.purchase_deadline_at = timezone.now() + timedelta(
                hours=BUY_TOGETHER_MEMBER_CONFIRMATION_WINDOW_HOURS
            )
            locked_group.proof_review_status = "approved"
            locked_group.proof_review_notes = ""
            locked_group.proof_reviewed_at = None
            locked_group.proof_reviewed_by = None
            locked_group.auto_refund_at = locked_group.purchase_deadline_at
            locked_group.save()

            GroupMember.objects.filter(group=locked_group, escrow_status="held").update(
                access_confirmed=False,
                access_confirmed_at=None,
                access_issue_reported=False,
                access_issue_reported_at=None,
                access_issue_notes="",
            )

            for member in GroupMember.objects.filter(group=locked_group).select_related("user"):
                Notification.objects.create(
                    user=member.user,
                    message=(
                        f"{locked_group.subscription.name} purchase proof was uploaded. "
                        "Confirm that you received access so escrow can be released."
                    ),
                )

        return Response({
            "message": "Purchase proof uploaded successfully",
            "status": locked_group.status,
            "purchase_proof": build_group_buy_purchase_proof(locked_group, request),
        })


class ConfirmGroupAccessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        process_expired_buy_together_refunds([group_id])

        try:
            group = (
                Group.objects.select_related("subscription", "owner")
                .get(id=group_id)
            )
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if group.owner_id == request.user.id:
            return Response({"error": "The host cannot confirm access as a member"}, status=400)

        dispute_cleared = False
        with transaction.atomic():
            locked_group = (
                Group.objects.select_for_update()
                .select_related("subscription", "owner")
                .get(id=group.id)
            )

            try:
                member = GroupMember.objects.select_for_update().get(
                    group=locked_group,
                    user=request.user,
                )
            except GroupMember.DoesNotExist:
                return Response({"error": "You are not a member of this group"}, status=404)

            if not member.has_paid or member.escrow_status != "held":
                return Response({"error": "Only members with held contributions can confirm access"}, status=400)

            if member.access_confirmed:
                return Response({"error": "You already confirmed receiving access"}, status=400)

            if locked_group.mode == "group_buy" and locked_group.status not in {"proof_submitted", "disputed"}:
                return Response({"error": "This group is not waiting for member confirmations"}, status=400)

            member.access_confirmed = True
            member.access_confirmed_at = timezone.now()
            member.access_issue_reported = False
            member.access_issue_reported_at = None
            member.access_issue_notes = ""
            member.save(
                update_fields=[
                    "access_confirmed",
                    "access_confirmed_at",
                    "access_issue_reported",
                    "access_issue_reported_at",
                    "access_issue_notes",
                ]
            )

            if (
                locked_group.mode == "group_buy"
                and locked_group.status == "disputed"
                and not get_group_buy_access_issue_count(locked_group)
            ):
                next_deadline = timezone.now() + timedelta(
                    hours=BUY_TOGETHER_MEMBER_CONFIRMATION_WINDOW_HOURS
                )
                locked_group.status = "proof_submitted"
                locked_group.purchase_deadline_at = next_deadline
                locked_group.auto_refund_at = next_deadline
                locked_group.save(
                    update_fields=["status", "purchase_deadline_at", "auto_refund_at"]
                )
                dispute_cleared = True

            if locked_group.mode == "group_buy":
                Notification.objects.create(
                    user=locked_group.owner,
                    message=(
                        f"{request.user.username} confirmed receiving access for {locked_group.subscription.name}. "
                        "The reported issue is cleared and payout can continue."
                        if dispute_cleared
                        else f"{request.user.username} confirmed receiving access for {locked_group.subscription.name}."
                    ),
                )

            log_operation_event(
                "group_access_confirmed",
                group_id=locked_group.id,
                group_mode=locked_group.mode,
                member_id=member.id,
                user_id=request.user.id,
                username=request.user.username,
                group_status=locked_group.status,
                dispute_cleared=dispute_cleared,
            )

        if group.mode == "sharing":
            release_amount, released = release_sharing_member_funds(member.id)
            group.refresh_from_db()
            if not released:
                return Response({"error": "Funds could not be released for this split"}, status=400)

            return Response(
                {
                    "message": "Access confirmed. The host payout has been released.",
                    "status": group.status,
                    "released_amount": str(release_amount),
                    "confirmed_members": 1,
                    "remaining_confirmations": 0,
                    "reported_issues": 0,
                }
            )

        total_confirmed = get_group_buy_confirmed_member_count(group)
        total_held = get_group_buy_held_members(group).count()
        remaining = max(total_held - total_confirmed, 0)
        reported_issues = get_group_buy_access_issue_count(group)

        release_amount = Decimal("0.00")
        group.refresh_from_db()
        if remaining == 0 and total_held >= group.total_slots:
            release_amount, _ = release_group_buy_held_funds(group.id)
            group.refresh_from_db()

        return Response({
            "message": (
                "Access confirmed. All member approvals are in and escrow was released."
                if group.status == "active"
                else "Access confirmed. The dispute is cleared and the group is back in the confirmation window."
                if dispute_cleared
                else "Access confirmed. Waiting for the rest of the group to confirm."
            ),
            "status": group.status,
            "confirmed_members": total_confirmed,
            "remaining_confirmations": remaining if group.status != "active" else 0,
            "reported_issues": reported_issues if group.status != "active" else 0,
            "released_amount": str(release_amount),
        })


class ReportGroupAccessIssueView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        process_expired_buy_together_refunds([group_id])

        details = (request.data.get("details") or "").strip()
        if not details:
            return Response({"error": "Add a short note about the access issue you faced"}, status=400)

        try:
            group = (
                Group.objects.select_related("subscription", "owner")
                .get(id=group_id)
            )
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if group.mode != "group_buy":
            return Response({"error": "Only buy-together groups support access issue reporting"}, status=400)

        if group.owner_id == request.user.id:
            return Response({"error": "The purchaser cannot report an access issue as a member"}, status=400)

        if group.status not in {"proof_submitted", "disputed"}:
            return Response({"error": "This group is not waiting for access confirmations"}, status=400)

        with transaction.atomic():
            locked_group = (
                Group.objects.select_for_update()
                .select_related("subscription", "owner")
                .get(id=group.id)
            )

            try:
                member = GroupMember.objects.select_for_update().get(
                    group=locked_group,
                    user=request.user,
                )
            except GroupMember.DoesNotExist:
                return Response({"error": "You are not a member of this buy-together group"}, status=404)

            if not member.has_paid or member.escrow_status != "held":
                return Response({"error": "Only members with held contributions can report an access issue"}, status=400)

            if member.access_confirmed:
                return Response({"error": "You already confirmed receiving access"}, status=400)

            if member.access_issue_reported:
                return Response({"error": "You already reported an access issue"}, status=400)

            member.access_issue_reported = True
            member.access_issue_reported_at = timezone.now()
            member.access_issue_notes = details
            member.save(
                update_fields=[
                    "access_issue_reported",
                    "access_issue_reported_at",
                    "access_issue_notes",
                ]
            )

            locked_group.status = "disputed"
            locked_group.purchase_deadline_at = None
            locked_group.auto_refund_at = None
            locked_group.save(update_fields=["status", "purchase_deadline_at", "auto_refund_at"])

            Notification.objects.create(
                user=locked_group.owner,
                message=(
                    f"{request.user.username} reported an access issue for {locked_group.subscription.name}. "
                    "Payout is paused until this is resolved or refunded."
                ),
            )
            Notification.objects.create(
                user=request.user,
                message=(
                    f"Your access issue for {locked_group.subscription.name} was recorded. "
                    "Payout is paused while the owner resolves it."
                ),
            )

        return Response({
            "message": "Access issue reported. Payout is now paused until this is resolved or refunded.",
            "status": "disputed",
            "reported_issues": get_group_buy_access_issue_count(group),
        })


class ActivateGroupPurchaseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        process_expired_buy_together_refunds([group_id])
        try:
            group = Group.objects.get(id=group_id, owner=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if group.mode != "group_buy":
            return Response({"error": "Only buy-together groups can be activated manually"}, status=400)

        held_members = list(get_group_buy_held_members(group))
        if group.status not in {"proof_submitted", "purchasing"}:
            return Response({"error": "This group is not ready to release held funds yet"}, status=400)

        if len(held_members) < group.total_slots:
            return Response({"error": "All member contributions must be held before activation"}, status=400)

        if not group.purchase_proof or not group.proof_submitted_at:
            return Response({"error": "Upload proof of purchase before releasing held funds"}, status=400)

        if get_group_buy_confirmed_member_count(group) < len(held_members):
            return Response(
                {"error": "All group members must confirm receiving access before funds can be released"},
                status=400,
            )

        release_amount, released = release_group_buy_held_funds(group.id)
        group.refresh_from_db()
        if not released:
            return Response({"error": "Funds could not be released for this group"}, status=400)

        return Response({
            "message": "Held funds released and group activated successfully",
            "status": group.status,
            "released_amount": str(release_amount),
        })


class RefundGroupFundsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        process_expired_buy_together_refunds([group_id])
        try:
            group = Group.objects.get(id=group_id, owner=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if group.mode != "group_buy":
            return Response({"error": "Only buy-together groups can refund held member funds"}, status=400)

        if not get_group_buy_held_members(group).exists():
            return Response({"error": "There are no held member funds to refund"}, status=400)

        refunded_amount = refund_group_buy_held_funds(group.id)
        group.refresh_from_db()

        return Response({
            "message": "Held member funds refunded successfully",
            "status": group.status,
            "refunded_amount": str(refunded_amount),
        })


class GroupReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        process_expired_buy_together_refunds([group_id])

        serializer = SubmitReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            group = Group.objects.select_related("subscription", "owner").get(id=group_id)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        try:
            reviewed_user = User.objects.get(id=serializer.validated_data["reviewed_user_id"])
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        allowed, error_message = can_review_user_for_group(group, request.user, reviewed_user)
        if not allowed:
            return Response({"error": error_message}, status=400)

        review, created = Review.objects.update_or_create(
            reviewer=request.user,
            reviewed_user=reviewed_user,
            group=group,
            defaults={
                "rating": serializer.validated_data["rating"],
                "comment": serializer.validated_data.get("comment", ""),
            },
        )

        if reviewed_user.id != request.user.id:
            Notification.objects.create(
                user=reviewed_user,
                message=(
                    f"{request.user.username} left a {review.rating}-star rating for your "
                    f"{group.subscription.name} group experience."
                ),
            )

        return Response(
            {
                "message": "Rating submitted successfully" if created else "Rating updated successfully",
                "review": ReviewSerializer(review).data,
                "reviewed_user": {
                    "id": reviewed_user.id,
                    "username": reviewed_user.username,
                    **build_user_rating_summary(reviewed_user),
                },
            },
            status=201 if created else 200,
        )


class RequestCredentialRevealView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        group_id = request.data.get("group_id")

        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        if not can_user_access_group_credentials(request.user, group):
            return Response({"error": "You are not allowed to access these credentials."}, status=403)

        if not group.credentials_available():
            return Response({"error": "Credentials are not available yet."}, status=400)

        reveal_token, expires_at = create_credential_reveal_token(request.user, group)
        return Response({
            "message": "One-time reveal token created.",
            "reveal_token": reveal_token,
            "expires_at": expires_at,
        })


class RevealCredentialView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        reveal_token = (request.data.get("reveal_token") or "").strip()

        if not reveal_token:
            return Response({"error": "Reveal token is required."}, status=400)

        token_hash = CredentialRevealToken.build_token_hash(reveal_token)

        try:
            token_record = CredentialRevealToken.objects.select_related("group").get(
                token_hash=token_hash,
                user=request.user,
            )
        except CredentialRevealToken.DoesNotExist:
            return Response({"error": "Invalid reveal token."}, status=400)

        if not token_record.is_usable():
            return Response({"error": "Reveal token expired or already used."}, status=400)

        group = token_record.group

        if not can_user_access_group_credentials(request.user, group):
            return Response({"error": "You are not allowed to access these credentials."}, status=403)

        identifier = group.get_access_identifier()
        password = group.get_access_password()
        notes = group.access_notes or ""

        if not identifier or not password:
            return Response({"error": "Credentials are not available yet."}, status=400)

        token_record.used_at = timezone.now()
        token_record.save(update_fields=["used_at"])

        return Response({
            "credentials": {
                "login_identifier": identifier,
                "password": password,
                "notes": notes,
            }
        })
