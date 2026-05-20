from .common import *

class TransactionHistoryView(ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ShareVersePageNumberPagination

    def get_queryset(self):
        return (
            Transaction.objects.filter(user=self.request.user)
            .select_related("group", "group__subscription")
            .order_by("-created_at", "-id")
        )


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
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
                    "owner_name": public_user_display_name(membership.group.owner),
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
            "bonus_balance": str(wallet.bonus_balance),
            "withdrawable_balance": str(wallet.get_withdrawable_balance()),
            "spendable_balance": str(wallet.get_spendable_balance()),
            "wallet_balance": str(wallet.get_spendable_balance()),
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


