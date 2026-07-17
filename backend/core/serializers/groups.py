from .common import *

class GroupUpdateSerializer(serializers.ModelSerializer):
    subscription_name = serializers.CharField(required=False, allow_blank=False, write_only=True)
    access_identifier = serializers.CharField(required=False, allow_blank=True)
    access_password = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    access_notes = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Group
        fields = [
            "subscription_name",
            "total_slots",
            "price_per_slot",
            "start_date",
            "end_date",
            "access_identifier",
            "access_password",
            "access_notes",
        ]

    def validate_total_slots(self, value):
        if value <= 0:
            raise serializers.ValidationError("Total slots must be greater than zero.")

        members_count = GroupMember.objects.filter(group=self.instance).count()
        if value < members_count:
            raise serializers.ValidationError("Total slots cannot be less than the number of joined members.")

        return value

    def validate_price_per_slot(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price per slot must be greater than zero.")

        members_count = GroupMember.objects.filter(group=self.instance).count()
        if members_count > 0 and value != self.instance.price_per_slot:
            raise serializers.ValidationError("You cannot change the price after members have joined.")

        return value

    def validate_subscription_name(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Subscription name cannot be empty.")

        members_count = GroupMember.objects.filter(group=self.instance).count()
        if members_count > 0 and normalized != self.instance.subscription.name:
            raise serializers.ValidationError("You cannot change the subscription after members have joined.")

        return normalized

    def validate(self, attrs):
        start_date = attrs.get("start_date", self.instance.start_date)
        end_date = attrs.get("end_date", self.instance.end_date)
        current_identifier = self.instance.get_access_identifier()
        current_password = self.instance.get_access_password()
        access_identifier = (attrs.get("access_identifier", current_identifier) or "").strip()
        access_password = (attrs.get("access_password", current_password) or "").strip()
        access_notes = (attrs.get("access_notes", self.instance.access_notes) or "").strip()

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({
                "end_date": "End date cannot be earlier than start date."
            })

        if self.instance.mode != "sharing":
            provided_credentials = any(
                bool((attrs.get(field_name) or "").strip()) if field_name != "access_password" else bool(attrs.get(field_name))
                for field_name in ["access_identifier", "access_password", "access_notes"]
            )
            if provided_credentials:
                raise serializers.ValidationError({
                    "access_identifier": "Only sharing groups can store shared login credentials."
                })
            return attrs

        if bool(access_identifier) != bool(access_password):
            raise serializers.ValidationError({
                "access_password": "Login email or username and password must be provided together."
            })

        attrs["access_identifier"] = access_identifier
        attrs["access_password"] = access_password
        attrs["access_notes"] = access_notes
        return attrs

    def update(self, instance, validated_data):
        subscription_name = validated_data.pop("subscription_name", None)
        access_identifier_provided = "access_identifier" in validated_data
        access_password_provided = "access_password" in validated_data
        access_notes_provided = "access_notes" in validated_data

        access_identifier = validated_data.pop("access_identifier", None)
        access_password = validated_data.pop("access_password", None)
        access_notes = validated_data.pop("access_notes", None)

        if subscription_name and subscription_name != instance.subscription.name:
            subscription, _ = Subscription.objects.get_or_create(
                name=subscription_name,
                defaults={
                    "max_slots": 5,
                    "category": "general",
                    "price": 100,
                },
            )
            instance.subscription = subscription

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if access_identifier_provided or access_password_provided or access_notes_provided:
            next_identifier = (
                access_identifier
                if access_identifier is not None
                else instance.get_access_identifier()
            )
            next_password = (
                access_password
                if access_password is not None
                else instance.get_access_password()
            )
            next_notes = access_notes if access_notes is not None else instance.access_notes

            if next_identifier or next_password:
                instance.set_access_credentials(next_identifier, next_password, next_notes)
            else:
                instance.clear_access_credentials()

        instance.save()
        return instance


class GroupSerializer(serializers.ModelSerializer):
    subscription_name = serializers.CharField(source="subscription.name", read_only=True)
    filled_slots = serializers.SerializerMethodField()
    is_joined = serializers.SerializerMethodField()
    mode_label = serializers.SerializerMethodField()
    mode_description = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    join_cta = serializers.SerializerMethodField()
    paid_members = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()
    owner_revenue = serializers.SerializerMethodField()
    owner_rating = serializers.SerializerMethodField()
    next_action = serializers.SerializerMethodField()

    class Meta:
        model = Group
        exclude = ["access_identifier", "access_password", "access_notes"]

    def get_filled_slots(self, obj):
        return obj.groupmember_set.count()

    def get_is_joined(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return GroupMember.objects.filter(group=obj, user=request.user).exists()
        return False

    def get_mode_label(self, obj):
        return get_mode_copy(obj.mode)["label"]

    def get_mode_description(self, obj):
        return get_mode_copy(obj.mode)["description"]

    def get_status_label(self, obj):
        return get_status_copy(obj)

    def get_join_cta(self, obj):
        return get_mode_copy(obj.mode)["join_cta"]

    def get_paid_members(self, obj):
        return GroupMember.objects.filter(group=obj, has_paid=True).count()

    def get_progress_percent(self, obj):
        if not obj.total_slots:
            return 0
        return int((self.get_filled_slots(obj) / obj.total_slots) * 100)

    def get_owner_rating(self, obj):
        from core.models import Review
        from django.db.models import Avg
        avg = Review.objects.filter(reviewed_user=obj.owner).aggregate(Avg('rating'))['rating__avg']
        if avg is not None:
            return round(avg, 1)
        return 5.0

    def get_owner_revenue(self, obj):
        if obj.mode != "sharing":
            return "0.00"
        revenue = (
            Transaction.objects.filter(
                user=obj.owner,
                group=obj,
                payment_method="group_share_payout",
                status="success",
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        return str(revenue)

    def get_next_action(self, obj):
        if obj.status == "closed":
            return "This group has been closed by the owner."

        if obj.mode == "group_buy":
            remaining = max(obj.total_slots - self.get_paid_members(obj), 0)
            if obj.status == "active":
                return "Group purchase complete."
            if obj.status == "awaiting_purchase":
                return "Upload proof of purchase before the deadline, then wait for members to confirm access."
            if obj.status == "proof_submitted":
                confirmation_remaining = self.get_remaining_confirmations(obj)
                if confirmation_remaining == 0:
                    return "All members confirmed receiving access. Funds are being released."
                return f"Waiting for {confirmation_remaining} member confirmation(s) before payout."
            if obj.status == "disputed":
                return "A member reported an access issue. Resolve it or refund the group."
            if obj.status == "refunding":
                return "Member contributions are being refunded."
            if obj.status == "refunded":
                return "This buy-together group was refunded."
            return f"Waiting for {remaining} more paid member(s)."

        remaining = max(obj.total_slots - self.get_filled_slots(obj), 0)
        pending_confirmations = GroupMember.objects.filter(group=obj, escrow_status="held").count()
        if pending_confirmations:
            return f"Waiting for {pending_confirmations} member access confirmation(s) before payout."
        if obj.status == "active":
            return "Shared subscription is live."
        return f"Fill {remaining} more slot(s) to maximize owner revenue."


class GroupListSerializer(serializers.ModelSerializer):
    subscription_name = serializers.CharField(source="subscription.name", read_only=True)
    owner_name = serializers.SerializerMethodField()
    owner_rating = serializers.SerializerMethodField()
    filled_slots = serializers.SerializerMethodField()
    remaining_slots = serializers.SerializerMethodField()
    is_joined = serializers.SerializerMethodField()
    mode_label = serializers.SerializerMethodField()
    mode_description = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    join_cta = serializers.SerializerMethodField()
    paid_members = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()
    owner_revenue = serializers.SerializerMethodField()
    next_action = serializers.SerializerMethodField()
    held_amount = serializers.SerializerMethodField()
    released_amount = serializers.SerializerMethodField()
    refundable_amount = serializers.SerializerMethodField()
    has_purchase_proof = serializers.SerializerMethodField()
    proof_review_status = serializers.CharField(read_only=True)
    proof_review_notes = serializers.CharField(read_only=True)
    proof_reviewed_at = serializers.DateTimeField(read_only=True)
    confirmed_members = serializers.SerializerMethodField()
    remaining_confirmations = serializers.SerializerMethodField()
    reported_issues = serializers.SerializerMethodField()
    unread_chat_count = serializers.SerializerMethodField()
    join_price = serializers.SerializerMethodField()
    join_subtotal = serializers.SerializerMethodField()
    platform_fee_amount = serializers.SerializerMethodField()
    is_prorated = serializers.SerializerMethodField()
    remaining_cycle_days = serializers.SerializerMethodField()
    total_cycle_days = serializers.SerializerMethodField()
    pricing_note = serializers.SerializerMethodField()
    can_submit_proof = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            "id",
            "subscription_name",
            "owner_name",
            "owner_rating",
            "total_slots",
            "price_per_slot",
            "join_price",
            "join_subtotal",
            "platform_fee_amount",
            "is_prorated",
            "remaining_cycle_days",
            "total_cycle_days",
            "pricing_note",
            "start_date",
            "end_date",
            "mode",
            "mode_label",
            "mode_description",
            "status",
            "status_label",
            "created_at",
            "filled_slots",
            "paid_members",
            "remaining_slots",
            "progress_percent",
            "owner_revenue",
            "held_amount",
            "released_amount",
            "refundable_amount",
            "has_purchase_proof",
            "proof_submitted_at",
            "proof_review_status",
            "proof_review_notes",
            "proof_reviewed_at",
            "confirmed_members",
            "remaining_confirmations",
            "reported_issues",
            "unread_chat_count",
            "can_submit_proof",
            "purchase_deadline_at",
            "auto_refund_at",
            "next_action",
            "is_joined",
            "join_cta",
        ]

    def get_filled_slots(self, obj):
        return GroupMember.objects.filter(group=obj).count()

    def get_owner_name(self, obj):
        return public_user_display_name(obj.owner)

    def get_owner_rating(self, obj):
        from core.models import Review
        from django.db.models import Avg
        avg = Review.objects.filter(reviewed_user=obj.owner).aggregate(Avg('rating'))['rating__avg']
        if avg is not None:
            return round(avg, 1)
        return 5.0

    def get_remaining_slots(self, obj):
        filled = GroupMember.objects.filter(group=obj).count()
        return obj.total_slots - filled

    def get_is_joined(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return GroupMember.objects.filter(group=obj, user=request.user).exists()
        return False

    def get_mode_label(self, obj):
        return get_mode_copy(obj.mode)["label"]

    def get_mode_description(self, obj):
        return get_mode_copy(obj.mode)["description"]

    def get_status_label(self, obj):
        return get_status_copy(obj)

    def get_join_cta(self, obj):
        return get_mode_copy(obj.mode)["join_cta"]

    def get_paid_members(self, obj):
        return GroupMember.objects.filter(group=obj, has_paid=True).count()

    def get_progress_percent(self, obj):
        if not obj.total_slots:
            return 0
        return int((self.get_filled_slots(obj) / obj.total_slots) * 100)

    def get_owner_revenue(self, obj):
        if obj.mode != "sharing":
            return "0.00"
        revenue = (
            Transaction.objects.filter(
                user=obj.owner,
                group=obj,
                payment_method="group_share_payout",
                status="success",
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        return str(revenue)

    def get_held_amount(self, obj):
        if obj.mode != "group_buy":
            return "0.00"
        total = sum_member_contribution_amounts(
            GroupMember.objects.filter(group=obj, escrow_status="held").select_related("group")
        )
        return str(total)

    def get_released_amount(self, obj):
        if obj.mode != "group_buy":
            return "0.00"
        total = (
            EscrowLedger.objects.filter(group=obj, entry_type="release", status="success")
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        return str(total)

    def get_refundable_amount(self, obj):
        if obj.mode != "group_buy":
            return "0.00"
        total = sum_member_charged_amounts(
            GroupMember.objects.filter(group=obj, escrow_status="held").select_related("group")
        )
        return str(total)

    def get_has_purchase_proof(self, obj):
        return bool(obj.purchase_proof)

    def get_confirmed_members(self, obj):
        if obj.mode != "group_buy":
            return 0
        confirmed, _ = get_group_buy_confirmation_counts(obj)
        return confirmed

    def get_remaining_confirmations(self, obj):
        if obj.mode != "group_buy":
            return 0
        confirmed, total = get_group_buy_confirmation_counts(obj)
        return max(total - confirmed, 0)

    def get_reported_issues(self, obj):
        if obj.mode != "group_buy":
            return 0
        return GroupMember.objects.filter(
            group=obj,
            has_paid=True,
            access_issue_reported=True,
        ).count()

    def get_next_action(self, obj):
        if obj.status == "closed":
            return "This group has been closed by the owner."

        if obj.mode == "group_buy":
            remaining = max(obj.total_slots - self.get_paid_members(obj), 0)
            if obj.status == "active":
                return "Group purchase complete."
            if obj.status == "awaiting_purchase":
                return "Group is full. Buy the subscription, share access off-platform, and upload proof."
            if obj.status == "proof_submitted":
                confirmation_remaining = self.get_remaining_confirmations(obj)
                if confirmation_remaining == 0:
                    return "All members confirmed receiving access. Funds are being released."
                return f"Waiting for {confirmation_remaining} member confirmation(s) before payout."
            if obj.status == "disputed":
                return "A member reported an access issue. Payout is paused until the issue is resolved or refunded."
            if obj.status == "refunding":
                return "Member contributions are being refunded."
            if obj.status == "refunded":
                return "This buy-together group was refunded."
            return f"Waiting for {remaining} more paid member(s)."

        remaining = max(obj.total_slots - self.get_filled_slots(obj), 0)
        pending_confirmations = GroupMember.objects.filter(group=obj, escrow_status="held").count()
        if pending_confirmations:
            return f"Waiting for {pending_confirmations} member access confirmation(s) before payout."
        if obj.status == "active":
            return "Shared subscription is live."
        return f"Fill {remaining} more slot(s) to maximize owner revenue."

    def get_unread_chat_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0

        read_state = GroupChatReadState.objects.filter(
            group=obj,
            user=request.user,
        ).first()

        blocked_user_ids = UserBlock.objects.filter(blocker=request.user).values_list("blocked_id", flat=True)
        unread_messages = (
            GroupChatMessage.objects.filter(group=obj, moderation_status="visible")
            .exclude(sender=request.user)
            .exclude(sender_id__in=blocked_user_ids)
        )
        if read_state:
            unread_messages = unread_messages.filter(created_at__gt=read_state.last_read_at)

        return unread_messages.count()

    def get_join_price(self, obj):
        return str(get_group_join_pricing(obj)["join_price"])

    def get_join_subtotal(self, obj):
        return str(get_group_join_pricing(obj)["join_subtotal"])

    def get_platform_fee_amount(self, obj):
        return str(get_group_join_pricing(obj)["platform_fee_amount"])

    def get_is_prorated(self, obj):
        return get_group_join_pricing(obj)["is_prorated"]

    def get_remaining_cycle_days(self, obj):
        return get_group_join_pricing(obj)["remaining_cycle_days"]

    def get_total_cycle_days(self, obj):
        return get_group_join_pricing(obj)["total_cycle_days"]

    def get_pricing_note(self, obj):
        return get_group_join_pricing(obj)["pricing_note"]

    def get_can_submit_proof(self, obj):
        if obj.mode != "group_buy":
            return False
        return obj.status in {"awaiting_purchase", "proof_submitted"} and self.get_paid_members(obj) >= obj.total_slots


