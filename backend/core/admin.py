from django.contrib import admin

from .models import (
    CredentialRevealToken,
    EscrowLedger,
    Group,
    GroupMember,
    JoinRequest,
    Notification,
    PasswordResetOTP,
    Review,
    Subscription,
    Transaction,
    User,
    Wallet,
)


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
