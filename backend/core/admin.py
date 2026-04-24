import json

from django import forms
from django.contrib import admin, messages
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .models import (
    CredentialRevealToken,
    EscrowLedger,
    Group,
    GroupInviteLink,
    GroupMember,
    JoinRequest,
    Notification,
    PasswordResetOTP,
    PayoutAccount,
    Referral,
    ReferralCode,
    Review,
    Subscription,
    Transaction,
    User,
    Wallet,
    WalletPayout,
)
from .manual_payouts import build_manual_payout_destination_label, create_manual_wallet_payout


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "subscription",
        "owner",
        "mode",
        "status",
        "proof_review_status",
        "purchase_deadline_at",
        "auto_refund_at",
        "created_at",
    )
    list_filter = ("mode", "status", "proof_review_status")
    search_fields = ("subscription__name", "owner__username", "purchase_reference")
    readonly_fields = ("proof_submitted_at", "proof_reviewed_at", "funds_released_at", "created_at")


class ManualWalletPayoutAdminForm(forms.ModelForm):
    external_reference = forms.CharField(
        required=False,
        max_length=120,
        help_text="Optional UTR, UPI reference, or internal transfer reference.",
    )
    admin_notes = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 4}),
        help_text="Optional internal notes about this manual payout.",
    )
    process_now = forms.BooleanField(
        required=False,
        help_text="Tick this after you have sent the money manually to deduct the wallet and mark the request completed.",
    )

    class Meta:
        model = WalletPayout
        fields = ["user", "payout_account", "amount", "mode", "destination_label"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "amount" in self.fields:
            self.fields["amount"].help_text = "Create this only after you have sent the money manually."
        if "destination_label" in self.fields:
            self.fields["destination_label"].help_text = (
                "Optional if you pick a saved payout account. Example: UPI chetak@upi or Bank ending 9012."
            )

        if self.instance and self.instance.pk:
            self.fields["external_reference"].initial = self.instance.utr
            self.fields["admin_notes"].initial = (self.instance.status_details or {}).get("admin_notes", "")
            if "amount" in self.fields:
                self.fields["amount"].help_text = "The wallet will be deducted only when you process this request."

    def clean(self):
        cleaned_data = super().clean()
        user = cleaned_data.get("user") or getattr(self.instance, "user", None)
        payout_account = (
            cleaned_data.get("payout_account")
            if "payout_account" in self.fields
            else getattr(self.instance, "payout_account", None)
        )
        amount = (
            cleaned_data.get("amount")
            if "amount" in self.fields
            else getattr(self.instance, "amount", None)
        )
        destination_label = (
            (cleaned_data.get("destination_label") or "").strip()
            if "destination_label" in self.fields
            else (getattr(self.instance, "destination_label", "") or "").strip()
        )

        if payout_account and user and payout_account.user_id != user.id:
            self.add_error("payout_account", "Choose a payout account that belongs to the selected user.")

        if payout_account and not destination_label and "destination_label" in self.fields:
            cleaned_data["destination_label"] = build_manual_payout_destination_label(payout_account)

        if not payout_account and not destination_label and "destination_label" in self.fields:
            self.add_error(
                "destination_label",
                "Add a destination label when you are not using a saved payout account.",
            )

        should_check_balance = not self.instance.pk or (
            self.cleaned_data.get("process_now")
            and self.instance.provider == "manual"
            and self.instance.transaction_id is None
        )
        if should_check_balance and user and amount is not None:
            wallet = getattr(user, "wallet", None)
            available_balance = wallet.balance if wallet else 0
            if available_balance < amount:
                self.add_error(
                    "amount",
                    f"This user only has Rs. {available_balance} available in the wallet.",
                )

        return cleaned_data


@admin.register(WalletPayout)
class WalletPayoutAdmin(admin.ModelAdmin):
    form = ManualWalletPayoutAdminForm
    list_display = (
        "id",
        "user",
        "amount",
        "status",
        "provider",
        "mode",
        "destination_label",
        "provider_status_source",
        "processed_by",
        "processed_at",
        "requested_at",
    )
    list_filter = ("status", "provider", "mode", "provider_status_source")
    search_fields = (
        "user__username",
        "user__email",
        "processed_by__username",
        "processed_by__email",
        "destination_label",
        "provider_reference_id",
        "provider_payout_id",
        "utr",
    )

    def is_pending_manual_request(self, obj):
        return bool(
            obj
            and obj.pk
            and obj.provider == "manual"
            and obj.transaction_id is None
            and obj.status in {"created", "pending", "queued", "processing"}
        )

    def get_fields(self, request, obj=None):
        if self.is_pending_manual_request(obj):
            return (
                "user",
                "payout_account",
                "manual_destination_details",
                "amount",
                "mode",
                "destination_label",
                "status",
                "requested_at",
                "external_reference",
                "admin_notes",
                "process_now",
                "status_details_pretty",
                "failure_reason",
            )

        if obj:
            return (
                "user",
                "payout_account",
                "manual_destination_details",
                "amount",
                "currency",
                "status",
                "mode",
                "destination_label",
                "provider",
                "provider_reference_id",
                "provider_payout_id",
                "utr",
                "processed_by",
                "wallet_balance_before",
                "wallet_balance_after",
                "provider_status_source",
                "transaction",
                "refund_transaction",
                "processed_at",
                "wallet_restored_at",
                "requested_at",
                "updated_at",
                "status_details_pretty",
                "failure_reason",
            )

        return (
            "user",
            "payout_account",
            "manual_destination_details",
            "amount",
            "mode",
            "destination_label",
            "external_reference",
            "admin_notes",
        )

    def get_readonly_fields(self, request, obj=None):
        if self.is_pending_manual_request(obj):
            return (
                "user",
                "payout_account",
                "manual_destination_details",
                "amount",
                "mode",
                "destination_label",
                "status",
                "requested_at",
                "status_details_pretty",
                "failure_reason",
            )

        if obj:
            return (
                "user",
                "payout_account",
                "manual_destination_details",
                "amount",
                "currency",
                "status",
                "mode",
                "destination_label",
                "provider",
                "provider_reference_id",
                "provider_payout_id",
                "utr",
                "processed_by",
                "wallet_balance_before",
                "wallet_balance_after",
                "provider_status_source",
                "transaction",
                "refund_transaction",
                "processed_at",
                "wallet_restored_at",
                "requested_at",
                "updated_at",
                "status_details_pretty",
                "failure_reason",
            )

        return ()

    def manual_destination_details(self, obj):
        payout_account = getattr(obj, "payout_account", None)
        if not payout_account:
            return "No saved payout account attached."

        if payout_account.account_type == "vpa":
            vpa_address = payout_account.get_vpa_address() or "—"
            return format_html(
                "<div><strong>Account type:</strong> UPI VPA<br>"
                "<strong>Name:</strong> {}<br>"
                "<strong>UPI ID:</strong> {}<br>"
                "<strong>Phone:</strong> {}</div>",
                payout_account.contact_name or "—",
                vpa_address,
                payout_account.contact_phone or "—",
            )

        return format_html(
            "<div><strong>Account type:</strong> Bank account<br>"
            "<strong>Account holder:</strong> {}<br>"
            "<strong>Account number:</strong> {}<br>"
            "<strong>IFSC:</strong> {}<br>"
            "<strong>Phone:</strong> {}</div>",
            payout_account.bank_account_holder_name or payout_account.contact_name or "—",
            payout_account.get_bank_account_number() or "—",
            payout_account.bank_account_ifsc or "—",
            payout_account.contact_phone or "—",
        )

    manual_destination_details.short_description = "Destination details"

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if change:
            if self.is_pending_manual_request(obj) and form.cleaned_data.get("process_now"):
                create_manual_wallet_payout(
                    user=obj.user,
                    amount=obj.amount,
                    payout_account=obj.payout_account,
                    destination_label=obj.destination_label,
                    mode=obj.mode,
                    created_by=request.user,
                    external_reference=form.cleaned_data.get("external_reference", ""),
                    admin_notes=form.cleaned_data.get("admin_notes", ""),
                    wallet_payout=obj,
                )
                self.message_user(
                    request,
                    f"Manual withdrawal request for {obj.user.username} was marked as completed.",
                    level=messages.SUCCESS,
                )
                return

            self.message_user(
                request,
                "Tick 'Process now' after the money has been sent manually to complete this request.",
                level=messages.INFO,
            )
            return

        create_manual_wallet_payout(
            user=form.cleaned_data["user"],
            amount=form.cleaned_data["amount"],
            payout_account=form.cleaned_data.get("payout_account"),
            destination_label=form.cleaned_data.get("destination_label", ""),
            mode=form.cleaned_data.get("mode"),
            created_by=request.user,
            external_reference=form.cleaned_data.get("external_reference", ""),
            admin_notes=form.cleaned_data.get("admin_notes", ""),
            wallet_payout=obj,
        )

        self.message_user(
            request,
            f"Manual payout of Rs. {obj.amount} recorded for {obj.user.username}.",
            level=messages.SUCCESS,
        )

    def status_details_pretty(self, obj):
        if not obj.status_details:
            return "—"
        pretty_json = json.dumps(obj.status_details, indent=2, sort_keys=True)
        return mark_safe(f"<pre>{pretty_json}</pre>")

    status_details_pretty.short_description = "Status details"


@admin.register(PayoutAccount)
class PayoutAccountAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "account_type",
        "destination_summary",
        "is_active",
        "last_synced_at",
        "updated_at",
    )
    list_filter = ("account_type", "is_active")
    search_fields = (
        "user__username",
        "user__email",
        "contact_name",
        "contact_email",
        "contact_phone",
        "bank_account_holder_name",
        "bank_account_ifsc",
        "bank_account_last4",
        "vpa_handle",
    )
    readonly_fields = (
        "full_destination_details",
        "provider_contact_id",
        "provider_fund_account_id",
        "last_error",
        "last_synced_at",
        "created_at",
        "updated_at",
    )
    fields = (
        "user",
        "account_type",
        "contact_name",
        "contact_email",
        "contact_phone",
        "bank_account_holder_name",
        "bank_account_ifsc",
        "bank_account_last4",
        "vpa_handle",
        "full_destination_details",
        "is_active",
        "provider_contact_id",
        "provider_fund_account_id",
        "last_error",
        "last_synced_at",
        "created_at",
        "updated_at",
    )

    def destination_summary(self, obj):
        return obj.get_masked_destination() or "—"

    destination_summary.short_description = "Destination"

    def full_destination_details(self, obj):
        if not obj:
            return "Save the payout account first to view its destination details."

        if obj.account_type == "vpa":
            return format_html(
                "<div><strong>UPI ID:</strong> {}<br>"
                "<strong>Name:</strong> {}<br>"
                "<strong>Phone:</strong> {}</div>",
                obj.get_vpa_address() or "—",
                obj.contact_name or "—",
                obj.contact_phone or "—",
            )

        return format_html(
            "<div><strong>Account holder:</strong> {}<br>"
            "<strong>Account number:</strong> {}<br>"
            "<strong>IFSC:</strong> {}<br>"
            "<strong>Phone:</strong> {}</div>",
            obj.bank_account_holder_name or obj.contact_name or "—",
            obj.get_bank_account_number() or "—",
            obj.bank_account_ifsc or "—",
            obj.contact_phone or "—",
        )

    full_destination_details.short_description = "Full destination details"


admin.site.register(User)
admin.site.register(Subscription)
admin.site.register(GroupMember)
admin.site.register(Wallet)
admin.site.register(Transaction)
admin.site.register(Review)
admin.site.register(Notification)
admin.site.register(JoinRequest)
admin.site.register(EscrowLedger)
admin.site.register(CredentialRevealToken)
admin.site.register(PasswordResetOTP)
admin.site.register(GroupInviteLink)
admin.site.register(ReferralCode)
admin.site.register(Referral)
