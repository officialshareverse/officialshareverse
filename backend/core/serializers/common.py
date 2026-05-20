import re
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db.models import Sum
from rest_framework import serializers

from ..auth_identity import find_user_by_login_identifier, normalize_login_identifier
from ..models import (
    AccountDeletionRequest,
    ContentReport,
    EscrowLedger,
    Group,
    GroupChatMessage,
    GroupChatPresence,
    GroupChatReadState,
    GroupInviteLink,
    GroupMember,
    MobilePushDevice,
    PayoutAccount,
    Referral,
    ReferralCode,
    Review,
    Subscription,
    Transaction,
    User,
    UserBlock,
    WalletPayout,
)
from ..pricing import (
    get_group_join_pricing,
    get_member_charged_amount,
    sum_member_charged_amounts,
    sum_member_contribution_amounts,
)


def get_mode_copy(mode):
    if mode == "group_buy":
        return {
            "label": "Buy together",
            "description": "Members pool funds first and the subscription is activated after the group fills.",
            "join_cta": "Join buy-together group",
        }

    return {
        "label": "Share existing plan",
        "description": "Members are coordinating shared-cost access for this digital plan. Participation must follow the provider's terms and the host's confirmation flow.",
        "join_cta": "Join sharing group",
    }


def get_group_buy_confirmation_counts(group):
    held_members = GroupMember.objects.filter(group=group, escrow_status="held")
    total = held_members.count()
    confirmed = held_members.filter(access_confirmed=True).count()
    return confirmed, total


def public_user_display_name(user):
    first_name = (getattr(user, "first_name", "") or "").strip()
    last_name = (getattr(user, "last_name", "") or "").strip()
    username = (getattr(user, "username", "") or "").strip()

    if first_name and last_name:
        return f"{first_name} {last_name[0].upper()}."
    if first_name:
        return first_name
    if last_name:
        return last_name
    if not username or "@" in username:
        return "ShareVerse host"

    parts = [part for part in re.split(r"[\s._-]+", username) if part]
    if not parts:
        return "ShareVerse host"

    first = parts[0][:1].upper() + parts[0][1:]
    if len(parts) > 1:
        return f"{first} {parts[1][0].upper()}."
    return first


def get_status_copy(group):
    if group.mode == "group_buy":
        if group.status == "disputed":
            return "A member reported an access issue and payout is paused"

        if group.status == "proof_submitted":
            confirmed, total = get_group_buy_confirmation_counts(group)
            remaining = max(total - confirmed, 0)
            if total == 0:
                return "Waiting for members to receive access"
            if remaining == 0:
                return "All members confirmed receiving access"
            return f"Waiting for {remaining} member confirmation(s)"

        mapping = {
            "forming": "Waiting for members to join",
            "collecting": "Collecting payments from members",
            "awaiting_purchase": "Group filled and waiting for creator purchase",
            "proof_submitted": "Waiting for members to confirm access",
            "disputed": "Access issue reported by a member",
            "purchasing": "Subscription purchase in progress",
            "active": "Subscription purchased and active",
            "refunding": "Refunds are being processed",
            "refunded": "Members refunded",
            "closed": "Closed by owner",
            "failed": "Purchase failed",
        }
    else:
        pending_confirmations = GroupMember.objects.filter(group=group, escrow_status="held").count()
        if group.status != "closed" and pending_confirmations:
            if pending_confirmations == 1:
                return "Waiting for 1 access confirmation"
            return f"Waiting for {pending_confirmations} access confirmations"

        mapping = {
            "forming": "Owner is opening slots",
            "collecting": "Members are joining and paying",
            "full": "All share slots are filled",
            "purchasing": "Owner is confirming the plan",
            "active": "Shared subscription is active",
            "closed": "Closed by owner",
            "failed": "This sharing group has an issue",
        }

    return mapping.get(group.status, group.status.replace("_", " ").title())


def get_transaction_copy(transaction):
    if transaction.payment_method == "wallet_topup":
        return {
            "title": "Wallet top-up",
            "description": "Money added to your withdrawable wallet balance.",
        }

    if transaction.payment_method == "wallet_withdrawal":
        return {
            "title": "Wallet withdrawal",
            "description": "Money withdrawn from your cash wallet balance.",
        }

    if transaction.payment_method == "wallet_payout":
        if hasattr(transaction, "wallet_payout") and transaction.wallet_payout:
            payout = transaction.wallet_payout
            destination = payout.destination_label or "your payout account"
            if transaction.status == "failed":
                return {
                    "title": "Wallet payout failed",
                    "description": f"Your withdrawal to {destination} did not complete.",
                }
            if transaction.status == "pending":
                return {
                    "title": "Wallet payout in progress",
                    "description": f"Your withdrawal to {destination} is being processed.",
                }
            return {
                "title": "Wallet payout sent",
                "description": f"Money was sent to {destination}.",
            }

        return {
            "title": "Wallet payout",
            "description": "Money moved from your cash wallet balance to your payout account.",
        }

    if transaction.payment_method == "wallet_payout_reversal":
        return {
            "title": "Payout returned",
            "description": "A failed or reversed payout was returned to your cash wallet balance.",
        }

    if transaction.payment_method == "group_share_payout":
        return {
            "title": "Sharing payout received",
            "description": f"You received payment for sharing {transaction.group.subscription.name}.",
        }

    if transaction.payment_method == "group_buy_escrow_release":
        return {
            "title": "Buy-together payout released",
            "description": f"Held member contributions were released for {transaction.group.subscription.name}.",
        }

    if transaction.payment_method == "wallet":
        if transaction.group and transaction.group.mode == "group_buy":
            return {
                "title": "Buy-together contribution",
                "description": f"You used cash wallet balance to contribute toward {transaction.group.subscription.name}.",
            }

        if transaction.group:
            return {
                "title": "Shared subscription payment",
                "description": f"You used cash wallet balance to join {transaction.group.subscription.name}.",
            }

    if transaction.payment_method == "wallet_bonus":
        if transaction.group and transaction.group.mode == "group_buy":
            return {
                "title": "Bonus credit used",
                "description": f"Referral bonus credit was used toward {transaction.group.subscription.name}.",
            }

        if transaction.group:
            return {
                "title": "Bonus credit used",
                "description": f"Referral bonus credit was used to join {transaction.group.subscription.name}.",
            }

        return {
            "title": "Bonus credit used",
            "description": "Referral bonus credit was used inside your wallet.",
        }

    if transaction.payment_method == "refund":
        return {
            "title": "Refund received",
            "description": "Funds were returned to your cash wallet balance.",
        }

    if transaction.payment_method == "referral_reward":
        return {
            "title": "Referral reward",
            "description": "Non-withdrawable bonus credit earned from a referral. Use it to join groups.",
        }

    return {
        "title": transaction.type.title(),
        "description": "Wallet transaction recorded.",
    }


def normalize_referral_code_value(value):
    return (value or "").strip().upper()


def normalize_indian_phone_value(value):
    digits = re.sub(r"\D+", "", (value or "").strip())
    if not digits:
        return ""

    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]

    if len(digits) != 10 or digits[0] not in "6789":
        raise serializers.ValidationError("Enter a valid 10-digit Indian mobile number.")

    return digits


def validate_referral_code_value(value):
    normalized = normalize_referral_code_value(value)
    if not normalized:
        return ""

    if not ReferralCode.objects.filter(code__iexact=normalized).exists():
        raise serializers.ValidationError("Enter a valid referral code.")

    return normalized


def get_frontend_base_url():
    configured_base_url = (getattr(settings, "FRONTEND_BASE_URL", "") or "").strip()
    if configured_base_url:
        return configured_base_url.rstrip("/")

    cors_origins = [origin.strip() for origin in getattr(settings, "CORS_ALLOWED_ORIGINS", []) if origin.strip()]
    if cors_origins:
        return cors_origins[0].rstrip("/")

    return "http://localhost:3000"


