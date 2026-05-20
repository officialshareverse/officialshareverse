from .common import *

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

        response_payload, error_payload, error_status = perform_group_join(request.user, group)
        if error_payload:
            return Response(error_payload, status=error_status)

        return Response(response_payload, status=status.HTTP_200_OK)


class LeaveGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        group_id = request.data.get("group_id")

        try:
            group = Group.objects.select_related("subscription", "owner").get(id=group_id)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

        try:
            member = GroupMember.objects.get(group=group, user=request.user)
        except GroupMember.DoesNotExist:
            return Response({"error": "You are not a member of this group"}, status=400)

        if group.owner == request.user:
            return Response({"error": "Owner cannot leave the group"}, status=400)

        if group.mode == "group_buy" and group.status in {"awaiting_purchase", "proof_submitted", "purchasing"}:
            return Response(
                {"error": "You cannot leave this group while the purchase is in progress."},
                status=400,
            )

        refunded_amount = Decimal("0.00")

        with transaction.atomic():
            locked_member = (
                GroupMember.objects.select_for_update()
                .select_related("user", "group", "group__subscription")
                .get(id=member.id)
            )
            locked_group = Group.objects.select_for_update().select_related("subscription", "owner").get(id=group.id)

            if locked_member.has_paid and locked_member.escrow_status == "held":
                refund_amount = get_member_charged_amount(locked_member)
                contribution_amount = get_member_contribution_amount(locked_member)

                wallet, _ = Wallet.objects.select_for_update().get_or_create(user=request.user)
                wallet.balance += refund_amount
                wallet.save(update_fields=["balance"])

                Transaction.objects.create(
                    user=request.user,
                    group=locked_group,
                    amount=refund_amount,
                    type="credit",
                    status="success",
                    payment_method="refund",
                )

                locked_member.escrow_status = "refunded"
                locked_member.refund_amount = refund_amount
                locked_member.refund_processed_at = timezone.now()
                locked_member.save(update_fields=["escrow_status", "refund_amount", "refund_processed_at"])

                EscrowLedger.objects.create(
                    user=request.user,
                    group=locked_group,
                    member=locked_member,
                    amount=contribution_amount,
                    entry_type="refund",
                    status="success",
                )

                refunded_amount = refund_amount

            locked_member.delete()

        create_notification(
            user=group.owner,
            message=f"{request.user.username} left your {group.subscription.name} group.",
        )

        if refunded_amount > Decimal("0.00"):
            create_notification(
                user=request.user,
                message=(
                    f"You left {group.subscription.name} and your held contribution "
                    f"of Rs {refunded_amount} was refunded to your wallet."
                ),
            )
            log_operation_event(
                "group_leave_refund",
                group_id=group.id,
                group_mode=group.mode,
                user_id=request.user.id,
                username=request.user.username,
                refunded_amount=refunded_amount,
                subscription_name=group.subscription.name,
            )

        return Response(
            {
                "message": "Left group successfully",
                "refunded_amount": str(refunded_amount),
            },
            status=200,
        )


class GenerateGroupInviteLinkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = GenerateGroupInviteLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            group = Group.objects.select_related("subscription", "owner").get(
                id=serializer.validated_data["group_id"]
            )
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)

        if group.owner_id != request.user.id:
            return Response(
                {"error": "Only the group owner can create invite links."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if group.status in {"closed", "refunding", "refunded", "failed"}:
            return Response(
                {"error": "Invite links are not available for this group right now."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if get_group_slots_remaining(group) <= 0:
            return Response(
                {"error": "This group has no open slots left."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_link_count = sum(
            1 for invite_link in GroupInviteLink.objects.filter(group=group, is_active=True)
            if invite_link.is_usable()
        )
        if active_link_count >= 10:
            return Response(
                {"error": "You can only keep 10 active invite links per group."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expires_in_hours = serializer.validated_data.get("expires_in_hours")
        invite_link = GroupInviteLink.objects.create(
            group=group,
            created_by=request.user,
            max_uses=serializer.validated_data.get("max_uses"),
            expires_at=timezone.now() + timedelta(hours=expires_in_hours) if expires_in_hours else None,
        )

        return Response(
            GroupInviteLinkSerializer(invite_link, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AcceptGroupInviteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AcceptGroupInviteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                invite_link = (
                    GroupInviteLink.objects.select_for_update()
                    .select_related("group__subscription", "group__owner")
                    .get(token=serializer.validated_data["token"])
                )
            except GroupInviteLink.DoesNotExist:
                return Response({"error": "Invite link not found."}, status=status.HTTP_404_NOT_FOUND)

            if not invite_link.is_usable():
                return Response(
                    {"error": "This invite link is no longer available."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            response_payload, error_payload, error_status = perform_group_join(request.user, invite_link.group)
            if error_payload:
                return Response(error_payload, status=error_status)

            invite_link.use_count += 1
            update_fields = ["use_count"]
            if invite_link.max_uses is not None and invite_link.use_count >= invite_link.max_uses:
                invite_link.is_active = False
                update_fields.append("is_active")
            invite_link.save(update_fields=update_fields)

        response_payload["invite_link_id"] = invite_link.id
        return Response(response_payload, status=status.HTTP_200_OK)


class GroupInviteInfoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        serializer = AcceptGroupInviteSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            invite_link = GroupInviteLink.objects.select_related("group__subscription", "group__owner").get(
                token=serializer.validated_data["token"]
            )
        except GroupInviteLink.DoesNotExist:
            return Response({"error": "Invite link not found."}, status=status.HTTP_404_NOT_FOUND)

        if not invite_link.is_usable():
            return Response(
                {"error": "This invite link is no longer available."},
                status=status.HTTP_404_NOT_FOUND,
            )

        group = invite_link.group
        slots_remaining = get_group_slots_remaining(group)
        pricing = get_group_join_pricing(group)
        join_disabled_reason = ""
        if group.status == "closed":
            join_disabled_reason = "This group has been closed by the owner."
        elif group.status in {"refunding", "refunded", "failed"}:
            join_disabled_reason = "This group is not available for new joins right now."
        elif slots_remaining <= 0:
            join_disabled_reason = "This group is already full."
        elif pricing["is_expired"]:
            join_disabled_reason = "This group's billing cycle has already ended."

        return Response(
            {
                "group_id": group.id,
                "subscription_name": group.subscription.name,
                "owner_username": public_user_display_name(group.owner),
                "slots_remaining": slots_remaining,
                "mode": group.mode,
                "mode_label": get_mode_copy(group.mode)["label"],
                "status": group.status,
                "status_label": get_status_copy(group),
                "join_price": str(pricing["join_price"]),
                "join_subtotal": str(pricing["join_subtotal"]),
                "platform_fee_amount": str(pricing["platform_fee_amount"]),
                "pricing_note": pricing["pricing_note"],
                "is_prorated": pricing["is_prorated"],
                "is_joinable": not bool(join_disabled_reason),
                "join_disabled_reason": join_disabled_reason,
            },
            status=status.HTTP_200_OK,
        )


class DeactivateGroupInviteLinkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, link_id):
        try:
            invite_link = GroupInviteLink.objects.select_related("group").get(id=link_id)
        except GroupInviteLink.DoesNotExist:
            return Response({"error": "Invite link not found."}, status=status.HTTP_404_NOT_FOUND)

        if invite_link.group.owner_id != request.user.id:
            return Response(
                {"error": "Only the group owner can deactivate this invite link."},
                status=status.HTTP_403_FORBIDDEN,
            )

        invite_link.is_active = False
        invite_link.save(update_fields=["is_active"])

        return Response(
            {
                "message": "Invite link deactivated successfully.",
                "link": GroupInviteLinkSerializer(invite_link, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class MyReferralCodeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        referral_code = ensure_referral_code_for_user(request.user)
        return Response(
            ReferralCodeSerializer(referral_code, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class ValidateReferralCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ValidateReferralCodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        referral_code = ReferralCode.objects.select_related("user").filter(
            code__iexact=serializer.validated_data["code"]
        ).first()

        return Response(
            {
                "valid": bool(referral_code),
                "referrer_username": referral_code.user.username if referral_code else "",
            },
            status=status.HTTP_200_OK,
        )


class GroupListView(ListAPIView):
    serializer_class = GroupListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ShareVersePageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["subscription__name"]
    filterset_fields = ["price_per_slot", "subscription"]
    ordering_fields = ["price_per_slot", "start_date", "created_at"]
    ordering = ["-created_at", "-id"]

    def get_queryset(self):
        return (
            Group.objects.select_related("subscription", "owner")
            .annotate(filled_slots=Count("groupmember"))
            .filter(
                end_date__gte=timezone.localdate(),
                filled_slots__lt=F("total_slots"),
            )
            .exclude(owner=self.request.user)
            .exclude(status__in=["closed", "refunding", "refunded", "failed"])
        )

    def get_serializer_context(self):
        return {"request": self.request}


