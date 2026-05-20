import secrets
import os
import json
import hashlib
import re
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import DatabaseError, connections, transaction
from django.db.models import Avg, Count, ExpressionWrapper, F, IntegerField, Max, OuterRef, Prefetch, Q, Subquery, Sum, Value
from django.utils import timezone
from rest_framework import status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    AccountDeletionRequest,
    ContentReport,
    CredentialRevealToken,
    EscrowLedger,
    Group,
    GroupChatMessage,
    GroupChatPresence,
    GroupChatReadState,
    GroupInviteLink,
    GroupMember,
    MobilePushDevice,
    Notification,
    PayoutAccount,
    RazorpayWebhookEvent,
    RazorpayXPayoutWebhookEvent,
    Referral,
    ReferralCode,
    Review,
    Subscription,
    Transaction,
    User,
    UserBlock,
    Wallet,
    WalletPayout,
    WalletTopupOrder,
    ensure_referral_code_for_user,
)
from ..payments import (
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
from ..manual_payouts import create_manual_wallet_payout_request, save_manual_payout_account
from ..operation_logging import log_operation_event
from ..pricing import (
    get_group_earning_platform_fee_amount,
    get_group_earning_payout_amount,
    get_group_join_pricing,
    get_member_charged_amount,
    get_member_contribution_amount,
    get_member_platform_fee_amount,
    sum_member_contribution_amounts,
)
from ..rate_limit import check_and_increment_rate_limit
from ..consumers import (
    create_notification,
    push_badge_update_to_user,
    push_group_chat_message_to_group,
    push_group_chat_typing_to_group,
    push_notification_read_to_user,
    push_notifications_cleared_to_user,
)
from ..referral_config import (
    REFERRAL_REWARD_INVITEE,
    REFERRAL_REWARD_INVITER,
    REFERRAL_REWARD_MINIMUM_JOIN_SUBTOTAL,
    REFERRAL_REWARD_TRIGGER,
)
from ..serializers import (
    AcceptGroupInviteSerializer,
    AccountDeletionRequestCreateSerializer,
    AccountDeletionRequestSerializer,
    ContentReportCreateSerializer,
    ContentReportSerializer,
    CreateGroupSerializer,
    GenerateGroupInviteLinkSerializer,
    GroupChatPresenceSerializer,
    GroupInviteLinkSerializer,
    GroupListSerializer,
    GroupChatMessageSerializer,
    GroupUpdateSerializer,
    MobilePushRegistrationSerializer,
    MobilePushUnregisterSerializer,
    PayoutAccountSerializer,
    PayoutAccountUpsertSerializer,
    ProfileUpdateSerializer,
    ReferralCodeSerializer,
    ReviewSerializer,
    SendGroupChatMessageSerializer,
    SubmitReviewSerializer,
    SubmitPurchaseProofSerializer,
    TransactionSerializer,
    UserBlockCreateSerializer,
    UserBlockSerializer,
    ValidateReferralCodeSerializer,
    WalletPayoutCreateSerializer,
    WalletPayoutSerializer,
    WalletTopupOrderCreateSerializer,
    WalletTopupVerifySerializer,
    get_mode_copy,
    get_status_copy,
    public_user_display_name,
)


class ShareVersePageNumberPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100


CREDENTIAL_REVEAL_TTL_MINUTES = 5
GROUP_CHAT_ONLINE_WINDOW_MINUTES = 6
GROUP_CHAT_RECENT_WINDOW_MINUTES = 30
GROUP_CHAT_TYPING_WINDOW_SECONDS = 12
BUY_TOGETHER_PURCHASE_DEADLINE_HOURS = 6
BUY_TOGETHER_MEMBER_CONFIRMATION_WINDOW_HOURS = 12
FINANCIAL_RATE_LIMITS = {
    "wallet_topup_create": {"limit": 10, "window_seconds": 300},
    "wallet_withdraw_create": {"limit": 5, "window_seconds": 600},
    "group_join": {"limit": 12, "window_seconds": 300},
}


def can_close_group(group):
    member_count = GroupMember.objects.filter(group=group).count()

    if group.status == "closed":
        return False, "This group is already closed."

    if member_count == 0:
        return False, "Empty groups can be deleted instead of closed."

    if group.mode == "group_buy" and group.status != "active":
        return False, "Buy-together groups with members cannot be closed before activation."

    return True, None


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
        create_notification(user=group.owner, message=owner_message)
        for member in GroupMember.objects.filter(group=group).select_related("user"):
            create_notification(
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

        create_notification(
            user=member.group.owner,
            message=(
                f"{member.user.username} confirmed receiving access for {member.group.subscription.name}. "
                f"Your payout was released to your wallet after a 5% platform fee of Rs {creator_platform_fee_amount}."
            ),
        )
        create_notification(
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

            create_notification(
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
        create_notification(
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


def build_financial_rate_limit_identity(request):
    user_id = getattr(getattr(request, "user", None), "id", None)
    if user_id:
        return f"user:{user_id}"

    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return f"ip:{x_forwarded_for.split(',')[0].strip()}"
    return f"ip:{request.META.get('REMOTE_ADDR', '')}"


def get_financial_rate_limit_response(request, scope):
    config = FINANCIAL_RATE_LIMITS[scope]
    result = check_and_increment_rate_limit(
        scope,
        build_financial_rate_limit_identity(request),
        limit=config["limit"],
        window_seconds=config["window_seconds"],
    )
    if result["allowed"]:
        return None

    retry_after = int(result.get("retry_after_seconds") or config["window_seconds"])
    response = Response(
        {
            "error": "Too many requests. Please wait before trying again.",
            "retry_after_seconds": retry_after,
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )
    response["Retry-After"] = str(retry_after)
    return response


def can_user_join_group_chat(user, group):
    if group.owner_id == user.id:
        return True

    return GroupMember.objects.filter(group=group, user=user).exists()


def get_blocked_user_ids(user):
    if not getattr(user, "is_authenticated", False):
        return set()

    return set(UserBlock.objects.filter(blocker=user).values_list("blocked_id", flat=True))


def has_blocked_user(blocker, blocked):
    if not getattr(blocker, "is_authenticated", False) or not blocked:
        return False

    blocked_id = getattr(blocked, "id", blocked)
    return UserBlock.objects.filter(blocker=blocker, blocked_id=blocked_id).exists()


def visible_group_chat_messages_for_user(user, group=None, group_ids=None):
    queryset = GroupChatMessage.objects.filter(moderation_status="visible")
    if group is not None:
        queryset = queryset.filter(group=group)
    if group_ids is not None:
        queryset = queryset.filter(group_id__in=group_ids)

    blocked_user_ids = get_blocked_user_ids(user)
    if blocked_user_ids:
        queryset = queryset.exclude(sender_id__in=blocked_user_ids)

    return queryset


def get_group_chat_participants(group):
    participants = [group.owner_id]
    participants.extend(
        GroupMember.objects.filter(group=group)
        .values_list("user_id", flat=True)
    )
    return set(participants)


def get_group_chat_unread_count(user, group):
    try:
        read_state = (
            GroupChatReadState.objects.filter(group=group, user=user)
            .order_by("-last_read_at", "-id")
            .first()
        )
        unread_messages = visible_group_chat_messages_for_user(user, group=group).exclude(sender=user)
        if read_state:
            unread_messages = unread_messages.filter(created_at__gt=read_state.last_read_at)
        return unread_messages.count()
    except DatabaseError:
        read_state = None
    return 0


def mark_group_chat_read(user, group):
    now = timezone.now()
    try:
        existing_states = list(
            GroupChatReadState.objects.filter(group=group, user=user).order_by("-last_read_at", "-id")
        )
        if existing_states:
            primary_state = existing_states[0]
            duplicate_ids = [state.id for state in existing_states[1:]]
            if duplicate_ids:
                GroupChatReadState.objects.filter(id__in=duplicate_ids).delete()

            GroupChatReadState.objects.filter(id=primary_state.id).update(last_read_at=now)
            primary_state.last_read_at = now
            return primary_state

        return GroupChatReadState.objects.create(
            group=group,
            user=user,
            last_read_at=now,
        )
    except DatabaseError:
        return None


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
    try:
        existing_rows = list(
            GroupChatPresence.objects.filter(group=group, user=user).order_by("-updated_at", "-id")
        )
        if existing_rows:
            primary_presence = existing_rows[0]
            duplicate_ids = [presence.id for presence in existing_rows[1:]]
            if duplicate_ids:
                GroupChatPresence.objects.filter(id__in=duplicate_ids).delete()

            update_kwargs = {"last_seen_at": now}
            primary_presence.last_seen_at = now
            if is_typing is not None:
                update_kwargs["is_typing"] = bool(is_typing)
                update_kwargs["typing_updated_at"] = now
                primary_presence.is_typing = bool(is_typing)
                primary_presence.typing_updated_at = now

            GroupChatPresence.objects.filter(id=primary_presence.id).update(**update_kwargs)
            return primary_presence

        create_kwargs = {
            "group": group,
            "user": user,
            "last_seen_at": now,
        }
        if is_typing is not None:
            create_kwargs["is_typing"] = bool(is_typing)
            create_kwargs["typing_updated_at"] = now
        return GroupChatPresence.objects.create(**create_kwargs)
    except DatabaseError:
        return None


def serialize_group_chat_participant(user, role, presence, now=None, current_user=None):
    presence_state = get_group_chat_presence_state(presence, now=now)
    return {
        "user_id": user.id,
        "username": user.username,
        "display_name": public_user_display_name(user),
        "role": role,
        "initials": build_name_initials(user.username),
        "is_self": bool(current_user and user.id == current_user.id),
        "presence": presence_state,
    }


def build_group_chat_activity_snapshot(group, current_user=None, presence_map=None, now=None, members=None):
    reference_time = now or timezone.now()
    participant_users = [group.owner]
    if members is None:
        members = GroupMember.objects.filter(group=group).select_related("user")
    participant_users.extend(member.user for member in members)

    seen_user_ids = set()
    blocked_user_ids = get_blocked_user_ids(current_user) if current_user else set()
    serialized_participants = []
    active_typing_users = []
    online_participant_count = 0

    for participant in participant_users:
        if participant.id in seen_user_ids:
            continue
        if current_user and participant.id != current_user.id and participant.id in blocked_user_ids:
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


def build_group_chat_fallback_snapshot(group, current_user=None, members=None):
    participant_users = [group.owner]
    if members is not None:
        participant_users.extend(member.user for member in members)
    elif current_user and current_user.id != group.owner_id:
        participant_users.append(current_user)

    serialized_participants = []
    seen_user_ids = set()
    blocked_user_ids = get_blocked_user_ids(current_user) if current_user else set()
    for participant in participant_users:
        if participant.id in seen_user_ids:
            continue
        if current_user and participant.id != current_user.id and participant.id in blocked_user_ids:
            continue
        seen_user_ids.add(participant.id)
        serialized_participants.append(
            serialize_group_chat_participant(
                participant,
                "owner" if participant.id == group.owner_id else "member",
                None,
                current_user=current_user,
            )
        )

    return {
        "participants": serialized_participants,
        "participant_count": len(serialized_participants),
        "online_participant_count": 0,
        "active_typing_users": [],
        "has_someone_typing": False,
    }


def build_safe_group_chat_group_payload(group):
    mode = (getattr(group, "mode", "") or "sharing").strip() or "sharing"
    status = (getattr(group, "status", "") or "forming").strip() or "forming"

    try:
        mode_copy = get_mode_copy(mode)
    except Exception:
        mode_copy = {
            "label": "Share existing plan" if mode != "group_buy" else "Buy together",
        }

    try:
        status_label = get_status_copy(group)
    except Exception:
        status_label = status.replace("_", " ").title()

    subscription_name = "Unknown split"
    try:
        subscription_name = getattr(getattr(group, "subscription", None), "name", None) or subscription_name
    except Exception:
        pass

    owner_name = "Unknown owner"
    try:
        owner_name = public_user_display_name(getattr(group, "owner", None)) or owner_name
    except Exception:
        pass
    owner_username = ""
    try:
        owner_username = getattr(getattr(group, "owner", None), "username", "") or ""
    except Exception:
        pass

    return {
        "id": getattr(group, "id", None),
        "subscription_name": subscription_name,
        "mode": mode,
        "mode_label": mode_copy.get("label", "Share existing plan"),
        "status": status,
        "status_label": status_label,
        "owner_id": getattr(group, "owner_id", None),
        "owner_name": owner_name,
        "owner_username": owner_username,
        "created_at": getattr(group, "created_at", None),
    }


def build_emergency_group_chat_group_payload(group):
    return {
        "id": getattr(group, "id", None),
        "subscription_name": "Unknown split",
        "mode": (getattr(group, "mode", "") or "sharing").strip() or "sharing",
        "mode_label": "Buy together" if getattr(group, "mode", "") == "group_buy" else "Share existing plan",
        "status": (getattr(group, "status", "") or "forming").strip() or "forming",
        "status_label": "Unavailable right now",
        "owner_id": getattr(group, "owner_id", None),
        "owner_name": "Unknown owner",
        "owner_username": "",
        "created_at": getattr(group, "created_at", None),
    }


def build_empty_group_chat_response(group=None, group_id=None, current_user=None):
    fallback_group = (
        build_emergency_group_chat_group_payload(group)
        if group is not None
        else {
            "id": group_id,
            "subscription_name": "Unknown split",
            "mode": "sharing",
            "mode_label": "Share existing plan",
            "status": "forming",
            "status_label": "Unavailable right now",
            "owner_name": "Unknown owner",
            "created_at": None,
        }
    )
    fallback_snapshot = (
        build_group_chat_fallback_snapshot(group, current_user=current_user)
        if group is not None
        else {
            "participants": [],
            "participant_count": 0,
            "online_participant_count": 0,
            "active_typing_users": [],
            "has_someone_typing": False,
        }
    )
    return {
        "group": fallback_group,
        "participants": fallback_snapshot["participants"],
        "messages": [],
        "unread_chat_count": 0,
        "online_participant_count": fallback_snapshot["online_participant_count"],
        "active_typing_users": fallback_snapshot["active_typing_users"],
        "has_someone_typing": fallback_snapshot["has_someone_typing"],
    }


def log_group_chat_failure(request, endpoint, stage, exc, group_id=None):
    log_operation_event(
        f"{endpoint}_{stage}_failed",
        level="error",
        endpoint=endpoint,
        stage=stage,
        user_id=getattr(getattr(request, "user", None), "id", None),
        group_id=group_id,
        exception_type=type(exc).__name__,
        exception_message=str(exc),
    )


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
        label = "Payouts processed within 24 hours"
        helper_text = (
            "Users can save a payout destination and request a withdrawal. "
            "Admins complete the transfer manually, usually within 24 hours."
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


def get_group_slots_remaining(group):
    return max(group.total_slots - GroupMember.objects.filter(group=group).count(), 0)


def validate_group_join_request(group, user):
    if group.status == "closed":
        return {"error": "This group has been closed by the owner"}, 400, None

    if group.status in {"refunding", "refunded", "failed"}:
        return {"error": "This group is not available for new joins right now"}, 400, None

    if group.owner_id == user.id:
        return {"error": "You cannot join your own group"}, 400, None

    if GroupMember.objects.filter(group=group, user=user).exists():
        return {"error": "Already joined"}, 400, None

    if GroupMember.objects.filter(group=group).count() >= group.total_slots:
        return {"error": "Group is full"}, 400, None

    pricing = get_group_join_pricing(group)
    if pricing["is_expired"]:
        return {"error": "This group's billing cycle has already ended"}, 400, None

    return None, None, pricing


def award_referral_reward_for_group_join(joined_user, group, join_subtotal, invitee_wallet=None):
    if REFERRAL_REWARD_TRIGGER != "joined_group":
        return None

    if Decimal(join_subtotal or "0") < REFERRAL_REWARD_MINIMUM_JOIN_SUBTOTAL:
        return None

    referral = (
        Referral.objects.select_for_update()
        .select_related("referrer", "referral_code")
        .filter(referred_user=joined_user, reward_given=False)
        .order_by("created_at", "id")
        .first()
    )

    if not referral or referral.status != "signed_up":
        return None

    referral.status = "joined_group"
    referral.save(update_fields=["status", "updated_at"])

    referrer_wallet, _ = Wallet.objects.select_for_update().get_or_create(user=referral.referrer)
    active_invitee_wallet = invitee_wallet or Wallet.objects.select_for_update().get_or_create(user=joined_user)[0]
    referral_code = ReferralCode.objects.select_for_update().get(id=referral.referral_code_id)

    referrer_wallet.bonus_balance += REFERRAL_REWARD_INVITER
    referrer_wallet.save(update_fields=["bonus_balance"])

    active_invitee_wallet.bonus_balance += REFERRAL_REWARD_INVITEE
    active_invitee_wallet.save(update_fields=["bonus_balance"])

    Transaction.objects.create(
        user=referral.referrer,
        group=group,
        amount=REFERRAL_REWARD_INVITER,
        type="credit",
        status="success",
        payment_method="referral_reward",
    )
    Transaction.objects.create(
        user=joined_user,
        group=group,
        amount=REFERRAL_REWARD_INVITEE,
        type="credit",
        status="success",
        payment_method="referral_reward",
    )

    referral_code.successful_referrals += 1
    referral_code.save(update_fields=["successful_referrals"])

    referral.status = "rewarded"
    referral.reward_given = True
    referral.reward_amount = REFERRAL_REWARD_INVITER
    referral.save(update_fields=["status", "reward_given", "reward_amount", "updated_at"])

    create_notification(
        user=referral.referrer,
        message=(
            f"You earned Rs {REFERRAL_REWARD_INVITER} in bonus credit because {joined_user.username} joined "
            f"their first eligible ShareVerse group on {group.subscription.name}. Bonus credit can be used "
            "to join groups and cannot be withdrawn."
        ),
    )
    create_notification(
        user=joined_user,
        message=(
            f"You earned Rs {REFERRAL_REWARD_INVITEE} in bonus credit for joining your first eligible "
            "ShareVerse group with a referral. Bonus credit can be used to join groups and cannot be withdrawn."
        ),
    )

    return {
        "inviter_reward": str(REFERRAL_REWARD_INVITER),
        "invitee_reward": str(REFERRAL_REWARD_INVITEE),
        "referrer_username": referral.referrer.username,
    }


def perform_group_join(joined_user, group):
    error_payload, error_status, pricing = validate_group_join_request(group, joined_user)
    if error_payload:
        return None, error_payload, error_status

    with transaction.atomic():
        try:
            locked_group = (
                Group.objects.select_for_update()
                .select_related("subscription", "owner")
                .get(id=group.id)
            )
        except Group.DoesNotExist:
            return None, {"error": "Group not found"}, 404

        error_payload, error_status, pricing = validate_group_join_request(locked_group, joined_user)
        if error_payload:
            return None, error_payload, error_status

        wallet, _ = Wallet.objects.select_for_update().get_or_create(user=joined_user)
        price = pricing["join_price"]
        contribution_amount = pricing["join_subtotal"]
        platform_fee_amount = pricing["platform_fee_amount"]

        if wallet.get_spendable_balance() < price:
            return None, {"error": "Insufficient balance"}, 400

        cash_used, bonus_used = wallet.consume_for_group_join(price)
        wallet.save(update_fields=["balance", "bonus_balance"])

        member = GroupMember.objects.create(
            group=locked_group,
            user=joined_user,
            has_paid=True,
            charged_amount=price,
            platform_fee_amount=platform_fee_amount,
            escrow_status="held",
        )

        if cash_used > 0:
            Transaction.objects.create(
                user=joined_user,
                group=locked_group,
                amount=cash_used,
                type="debit",
                status="success",
                payment_method="wallet",
            )

        if bonus_used > 0:
            Transaction.objects.create(
                user=joined_user,
                group=locked_group,
                amount=bonus_used,
                type="debit",
                status="success",
                payment_method="wallet_bonus",
            )

        EscrowLedger.objects.create(
            user=joined_user,
            group=locked_group,
            member=member,
            amount=contribution_amount,
            entry_type="hold",
            status="success",
        )

        if locked_group.mode == "sharing":
            if locked_group.status == "forming":
                locked_group.status = "collecting"
                locked_group.save(update_fields=["status"])
            create_notification(
                user=locked_group.owner,
                message=(
                    f"{joined_user.username} joined your {locked_group.subscription.name} sharing group "
                    f"and paid Rs {price} (including Rs {platform_fee_amount} platform fee). "
                    "Payout will be released after the member confirms access."
                ),
            )
            create_notification(
                user=joined_user,
                message=(
                    f"You joined {locked_group.subscription.name}. Confirm access after the host gives you access "
                    "so the host payout can be released."
                ),
            )
        elif locked_group.mode == "group_buy":
            if locked_group.status == "forming":
                locked_group.status = "collecting"
                locked_group.save(update_fields=["status"])
                create_notification(
                    user=locked_group.owner,
                    message=(
                        f"{joined_user.username} joined your {locked_group.subscription.name} buy-together group. "
                        "The group is now collecting member contributions."
                    ),
                )
            else:
                create_notification(
                    user=locked_group.owner,
                    message=(
                        f"{joined_user.username} joined your {locked_group.subscription.name} buy-together group."
                    ),
                )

            paid_members = GroupMember.objects.filter(group=locked_group, has_paid=True).count()

            if paid_members >= locked_group.total_slots:
                deadline = timezone.now() + timedelta(hours=BUY_TOGETHER_PURCHASE_DEADLINE_HOURS)
                locked_group.status = "awaiting_purchase"
                locked_group.purchase_deadline_at = deadline
                locked_group.auto_refund_at = deadline
                locked_group.save(update_fields=["status", "purchase_deadline_at", "auto_refund_at"])
                create_notification(
                    user=locked_group.owner,
                    message=(
                        f"Your {locked_group.subscription.name} buy-together group is full. "
                        "Buy the subscription and upload proof before the deadline."
                    ),
                )
                for joined_member in GroupMember.objects.filter(group=locked_group).select_related("user"):
                    create_notification(
                        user=joined_member.user,
                        message=(
                            f"{locked_group.subscription.name} is now full. "
                            "The creator will buy the subscription and upload proof next."
                        ),
                    )

        referral_reward = award_referral_reward_for_group_join(
            joined_user=joined_user,
            group=locked_group,
            join_subtotal=contribution_amount,
            invitee_wallet=wallet,
        )

        log_operation_event(
            "group_join_funds_held",
            group_id=locked_group.id,
            group_mode=locked_group.mode,
            group_status=locked_group.status,
            member_id=member.id,
            user_id=joined_user.id,
            username=joined_user.username,
            charged_amount=price,
            contribution_amount=contribution_amount,
            platform_fee_amount=platform_fee_amount,
            wallet_cash_balance=wallet.balance,
            wallet_bonus_balance=wallet.bonus_balance,
            wallet_spendable_balance=wallet.get_spendable_balance(),
        )

        return {
            "message": "Joined group successfully",
            "group_id": locked_group.id,
            "charged_amount": str(price),
            "join_subtotal": str(contribution_amount),
            "platform_fee_amount": str(platform_fee_amount),
            "price_per_slot": str(locked_group.price_per_slot),
            "is_prorated": pricing["is_prorated"],
            "remaining_cycle_days": pricing["remaining_cycle_days"],
            "total_cycle_days": pricing["total_cycle_days"],
            "pricing_note": pricing["pricing_note"],
            "remaining_balance": str(wallet.get_spendable_balance()),
            "remaining_cash_balance": str(wallet.get_withdrawable_balance()),
            "remaining_bonus_balance": str(wallet.get_bonus_balance()),
            "group_mode": locked_group.mode,
            "group_status": locked_group.status,
            "credentials": build_member_sharing_credentials(locked_group) if locked_group.mode == "sharing" else None,
            "referral_reward": referral_reward,
        }, None, None


