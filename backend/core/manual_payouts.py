import re
import secrets
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Notification, Transaction, Wallet, WalletPayout


def build_manual_payout_destination_label(payout_account):
    if not payout_account:
        return ""

    if payout_account.account_type == "vpa":
        masked = payout_account.get_masked_destination()
        return f"UPI {masked}" if masked else "UPI payout"

    masked = payout_account.get_masked_destination()
    return f"Bank {masked}" if masked else "Bank payout"


def sanitize_manual_payout_narration(value):
    normalized = re.sub(r"[^A-Za-z0-9 ]+", " ", (value or "").strip())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized[:30] or "ShareVerse Payout"


def normalize_manual_payout_mode(payout_account, requested_mode):
    normalized_mode = (requested_mode or "").strip().upper() or "IMPS"
    allowed_modes = {choice[0] for choice in WalletPayout.MODE_CHOICES}

    if payout_account and payout_account.account_type == "vpa":
        return "UPI"

    if normalized_mode not in allowed_modes:
        raise ValidationError("Choose a valid payout mode.")

    if normalized_mode == "UPI":
        raise ValidationError("UPI mode is only available for saved UPI payout methods.")

    return normalized_mode


def create_manual_wallet_payout(
    *,
    user,
    amount,
    payout_account=None,
    destination_label="",
    mode="IMPS",
    created_by=None,
    external_reference="",
    admin_notes="",
    wallet_payout=None,
):
    amount = Decimal(amount).quantize(Decimal("0.01"))
    if amount <= 0:
        raise ValidationError("Amount must be greater than zero.")

    if payout_account:
        if payout_account.user_id != user.id:
            raise ValidationError("Selected payout account does not belong to this user.")
        if not payout_account.is_active:
            raise ValidationError("Selected payout account is inactive.")

    normalized_mode = normalize_manual_payout_mode(payout_account, mode)
    normalized_destination = (destination_label or "").strip() or build_manual_payout_destination_label(
        payout_account
    )
    if not normalized_destination:
        raise ValidationError("Add a destination label or choose a saved payout account.")

    normalized_reference = (external_reference or "").strip()
    normalized_notes = (admin_notes or "").strip()
    currency = (getattr(settings, "RAZORPAY_CURRENCY", "INR") or "INR").strip().upper()
    amount_subunits = int((amount * 100).quantize(Decimal("1")))
    now = timezone.now()

    with transaction.atomic():
        wallet, _ = Wallet.objects.select_for_update().get_or_create(user=user)
        if wallet.balance < amount:
            raise ValidationError("Insufficient wallet balance for this manual payout.")

        wallet.balance -= amount
        wallet.save(update_fields=["balance"])

        payout_transaction = Transaction.objects.create(
            user=user,
            group=None,
            amount=amount,
            type="debit",
            status="success",
            payment_method="wallet_payout",
        )

        payout = wallet_payout or WalletPayout()
        payout.user = user
        payout.payout_account = payout_account
        payout.transaction = payout_transaction
        payout.amount = amount
        payout.amount_subunits = amount_subunits
        payout.currency = currency
        payout.provider = "manual"
        payout.provider_payout_id = None
        payout.provider_contact_id = payout_account.provider_contact_id if payout_account else ""
        payout.provider_fund_account_id = payout_account.provider_fund_account_id if payout_account else ""
        payout.provider_reference_id = payout.provider_reference_id or f"manual_{secrets.token_hex(12)}"[:40]
        payout.idempotency_key = payout.idempotency_key or secrets.token_hex(24)
        payout.source_account_number = "manual"
        payout.mode = normalized_mode
        payout.purpose = "payout"
        payout.narration = sanitize_manual_payout_narration(f"Manual {user.username}")
        payout.destination_label = normalized_destination
        payout.status = "processed"
        payout.status_details = {
            "manual": True,
            "external_reference": normalized_reference,
            "admin_notes": normalized_notes,
            "created_by_user_id": created_by.id if created_by else None,
            "created_by_username": created_by.username if created_by else "",
            "recorded_at": now.isoformat(),
        }
        payout.failure_reason = ""
        payout.provider_status_source = "admin_manual"
        payout.utr = normalized_reference
        payout.fees = 0
        payout.tax = 0
        payout.processed_at = now
        payout.wallet_restored_at = None
        payout.refund_transaction = None
        payout.save()

        Notification.objects.create(
            user=user,
            message=(
                f"Support marked a manual withdrawal of Rs. {amount} to {normalized_destination} as completed."
            ),
        )

    return payout
