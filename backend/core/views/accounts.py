from .common import *

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
    account_deletion_request = (
        AccountDeletionRequest.objects.filter(user=user, status__in=["pending", "in_review"])
        .order_by("-created_at", "-id")
        .first()
    )

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
        "wallet_balance": str(wallet.get_spendable_balance()),
        "wallet_cash_balance": str(wallet.get_withdrawable_balance()),
        "wallet_bonus_balance": str(wallet.get_bonus_balance()),
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
        "account_deletion_request": (
            AccountDeletionRequestSerializer(account_deletion_request).data
            if account_deletion_request
            else None
        ),
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


class AccountDeletionRequestView(APIView):
    permission_classes = [IsAuthenticated]

    retention_notice = (
        "ShareVerse will delete or anonymize account data that is no longer needed. "
        "Payment, wallet, payout, dispute, fraud-prevention, tax, and legal records may be retained where required."
    )

    def get(self, request):
        account_deletion_request = (
            AccountDeletionRequest.objects.filter(user=request.user, status__in=["pending", "in_review"])
            .order_by("-created_at", "-id")
            .first()
        )
        return Response(
            {
                "account_deletion_request": (
                    AccountDeletionRequestSerializer(account_deletion_request).data
                    if account_deletion_request
                    else None
                ),
                "retention_notice": self.retention_notice,
            }
        )

    def post(self, request):
        serializer = AccountDeletionRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        existing_request = (
            AccountDeletionRequest.objects.filter(user=request.user, status__in=["pending", "in_review"])
            .order_by("-created_at", "-id")
            .first()
        )
        if existing_request:
            return Response(
                {
                    "message": "Your account deletion request is already pending review.",
                    "account_deletion_request": AccountDeletionRequestSerializer(existing_request).data,
                    "retention_notice": self.retention_notice,
                },
                status=status.HTTP_200_OK,
            )

        account_deletion_request = AccountDeletionRequest.objects.create(
            user=request.user,
            contact_email=request.user.email or f"{request.user.username}@example.invalid",
            reason=serializer.validated_data.get("reason", ""),
            details=serializer.validated_data.get("details", ""),
            request_source="mobile",
        )
        create_notification(
            user=request.user,
            message=(
                "Your ShareVerse account deletion request has been received. "
                "Support will review it and follow up by email."
            ),
        )

        return Response(
            {
                "message": "Account deletion request submitted. Support will review it and follow up by email.",
                "account_deletion_request": AccountDeletionRequestSerializer(account_deletion_request).data,
                "retention_notice": self.retention_notice,
            },
            status=status.HTTP_201_CREATED,
        )


