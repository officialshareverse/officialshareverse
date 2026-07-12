import json

from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils import timezone
from django.utils.html import format_html

from .models import (
    AccountDeletionRequest,
    ContentReport,
    CredentialRevealToken,
    EscrowLedger,
    Group,
    GroupChatMessage,
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
    UserBlock,
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


@admin.register(AccountDeletionRequest)
class AccountDeletionRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "contact_email",
        "status",
        "request_source",
        "created_at",
        "processed_at",
        "processed_by",
    )
    list_filter = ("status", "request_source", "created_at")
    search_fields = ("user__username", "user__email", "contact_email", "reason", "details")
    readonly_fields = ("created_at", "updated_at")


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ("id", "blocker", "blocked", "created_at")
    list_filter = ("created_at",)
    search_fields = ("blocker__username", "blocker__email", "blocked__username", "blocked__email", "reason")
    readonly_fields = ("created_at", "updated_at")


@admin.register(GroupChatMessage)
class GroupChatMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "sender", "moderation_status", "created_at", "hidden_at", "hidden_by")
    list_filter = ("moderation_status", "created_at", "hidden_at")
    search_fields = ("message", "sender__username", "sender__email", "group__subscription__name")
    readonly_fields = ("created_at", "hidden_at")
    actions = ("hide_messages", "restore_messages")

    @admin.action(description="Hide selected chat messages")
    def hide_messages(self, request, queryset):
        updated_count = 0
        for message in queryset:
            message.hide(moderator=request.user, reason="Hidden from Django admin moderation.")
            message.save(update_fields=["moderation_status", "hidden_reason", "hidden_at", "hidden_by"])
            updated_count += 1
        self.message_user(request, f"{updated_count} chat message(s) hidden.", level=messages.SUCCESS)

    @admin.action(description="Restore selected chat messages")
    def restore_messages(self, request, queryset):
        updated_count = 0
        for message in queryset:
            message.unhide()
            message.save(update_fields=["moderation_status", "hidden_reason", "hidden_at", "hidden_by"])
            updated_count += 1
        self.message_user(request, f"{updated_count} chat message(s) restored.", level=messages.SUCCESS)


@admin.register(ContentReport)
class ContentReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "target_type",
        "reason",
        "status",
        "reporter",
        "reported_user",
        "group",
        "created_at",
        "reviewed_at",
    )
    list_filter = ("target_type", "reason", "status", "created_at")
    search_fields = (
        "reporter__username",
        "reporter__email",
        "reported_user__username",
        "reported_user__email",
        "details",
        "admin_notes",
        "chat_message__message",
        "group__subscription__name",
    )
    readonly_fields = ("created_at", "updated_at", "reviewed_at", "reviewed_by")
    actions = ("mark_in_review", "hide_reported_chat_messages", "mark_action_taken", "dismiss_reports")

    @admin.action(description="Mark selected reports in review")
    def mark_in_review(self, request, queryset):
        updated_count = queryset.update(status="in_review")
        self.message_user(request, f"{updated_count} report(s) marked in review.", level=messages.SUCCESS)

    @admin.action(description="Hide reported chat messages")
    def hide_reported_chat_messages(self, request, queryset):
        updated_count = 0
        for report in queryset.select_related("chat_message"):
            if not report.chat_message:
                continue
            report.chat_message.hide(
                moderator=request.user,
                reason=f"Hidden after report #{report.id}: {report.get_reason_display()}",
            )
            report.chat_message.save(update_fields=["moderation_status", "hidden_reason", "hidden_at", "hidden_by"])
            report.status = "action_taken"
            report.reviewed_by = request.user
            report.reviewed_at = timezone.now()
            report.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
            updated_count += 1
        self.message_user(request, f"{updated_count} reported message(s) hidden.", level=messages.SUCCESS)

    @admin.action(description="Mark selected reports action taken")
    def mark_action_taken(self, request, queryset):
        updated_count = queryset.update(status="action_taken", reviewed_by_id=request.user.id, reviewed_at=timezone.now())
        self.message_user(request, f"{updated_count} report(s) marked action taken.", level=messages.SUCCESS)

    @admin.action(description="Dismiss selected reports")
    def dismiss_reports(self, request, queryset):
        updated_count = queryset.update(status="dismissed", reviewed_by_id=request.user.id, reviewed_at=timezone.now())
        self.message_user(request, f"{updated_count} report(s) dismissed.", level=messages.SUCCESS)


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
            # Idempotency guard: if the payout is already processed, do nothing.
            if obj.status in ("processed", "queued"):
                self.message_user(
                    request,
                    f"This payout is already '{obj.status}'. No changes were made.",
                    level=messages.WARNING,
                )
                return

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
        # format_html escapes the JSON body; never use mark_safe with unsanitized input.
        return format_html("<pre>{}</pre>", pretty_json)

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


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    # Use Django's hardened UserAdmin: hashed password rendering, separate permissions form,
    # proper handling of is_superuser / is_staff.
    list_display = ("username", "email", "phone", "is_active", "is_staff", "is_superuser", "is_verified", "date_joined")
    list_filter = ("is_active", "is_staff", "is_superuser", "is_verified")
    search_fields = ("username", "email", "phone")
    readonly_fields = ("date_joined", "last_login")

admin.site.register(Subscription)
admin.site.register(GroupMember)
admin.site.register(Wallet)
admin.site.register(Transaction)
admin.site.register(Review)
admin.site.register(Notification)
admin.site.register(JoinRequest)
admin.site.register(EscrowLedger)

@admin.register(CredentialRevealToken)
class CredentialRevealTokenAdmin(admin.ModelAdmin):
    readonly_fields = ("token_hash", "user", "expires_at", "used_at")

@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    readonly_fields = ("otp_hash", "user", "expires_at", "attempts_remaining", "is_used")
admin.site.register(GroupInviteLink)
admin.site.register(ReferralCode)
admin.site.register(Referral)
