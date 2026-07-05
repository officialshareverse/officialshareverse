from .common import *

class SubscriptionListView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

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
        return Group.objects.filter(owner=self.request.user).order_by("-created_at", "-id")

    def get_serializer_context(self):
        return {"request": self.request}


class MyGroupDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
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
            "remaining_slots": max(group.total_slots - len(member_data), 0),
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
            "invite_links": GroupInviteLinkSerializer(
                group.invite_links.filter(is_active=True),
                many=True,
                context={"request": request},
            ).data,
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
                create_notification(
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
                create_notification(
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
                create_notification(
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

            create_notification(
                user=locked_group.owner,
                message=(
                    f"{request.user.username} reported an access issue for {locked_group.subscription.name}. "
                    "Payout is paused until this is resolved or refunded."
                ),
            )
            create_notification(
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
            create_notification(
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
