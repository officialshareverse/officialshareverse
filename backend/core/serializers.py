from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.db.models import Sum
from rest_framework import serializers

from .models import (
    EscrowLedger,
    Group,
    GroupChatMessage,
    GroupChatReadState,
    GroupMember,
    PayoutAccount,
    Review,
    Subscription,
    Transaction,
    User,
    WalletPayout,
)
from .pricing import (
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
            "description": "Money added to your wallet balance.",
        }

    if transaction.payment_method == "wallet_withdrawal":
        return {
            "title": "Wallet withdrawal",
            "description": "Money withdrawn from your wallet balance.",
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
            "description": "Money moved from your wallet to your payout account.",
        }

    if transaction.payment_method == "wallet_payout_reversal":
        return {
            "title": "Payout returned",
            "description": "A failed or reversed payout was returned to your wallet.",
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
                "description": f"You contributed to buy {transaction.group.subscription.name} with the group.",
            }

        if transaction.group:
            return {
                "title": "Shared subscription payment",
                "description": f"You paid to join {transaction.group.subscription.name}.",
            }

    if transaction.payment_method == "refund":
        return {
            "title": "Refund received",
            "description": "Funds were returned to your wallet.",
        }

    return {
        "title": transaction.type.title(),
        "description": "Wallet transaction recorded.",
    }


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    last_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ["username", "first_name", "last_name", "email", "phone", "password"]

    def create(self, validated_data):
        validated_data["password"] = make_password(validated_data["password"])
        return super().create(validated_data)


class ForgotPasswordRequestSerializer(serializers.Serializer):
    username = serializers.CharField()
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        username = (attrs.get("username") or "").strip()
        phone = (attrs.get("phone") or "").strip()
        email = (attrs.get("email") or "").strip().lower()

        if not username:
            raise serializers.ValidationError({"username": "Username is required."})

        if not phone and not email:
            raise serializers.ValidationError({"phone": "Provide phone or email to verify your account."})

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise serializers.ValidationError({"username": "Account verification failed."})

        if phone and (user.phone or "").strip() != phone:
            raise serializers.ValidationError({"phone": "Account verification failed."})

        if email and (user.email or "").strip().lower() != email:
            raise serializers.ValidationError({"email": "Account verification failed."})

        attrs["user"] = user
        attrs["channel"] = "phone" if phone else "email"
        return attrs


class ForgotPasswordConfirmSerializer(serializers.Serializer):
    username = serializers.CharField()
    reset_session_id = serializers.UUIDField()
    otp = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate(self, attrs):
        attrs["username"] = (attrs.get("username") or "").strip()
        attrs["otp"] = (attrs.get("otp") or "").strip()

        if not attrs["username"]:
            raise serializers.ValidationError({"username": "Username is required."})

        if not attrs["otp"].isdigit():
            raise serializers.ValidationError({"otp": "OTP must be a 6-digit code."})

        return attrs


class WalletTopupOrderCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("1.00"))


class PayoutAccountUpsertSerializer(serializers.Serializer):
    account_type = serializers.ChoiceField(choices=PayoutAccount.ACCOUNT_TYPE_CHOICES)
    contact_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    contact_email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    contact_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    bank_account_holder_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    bank_account_number = serializers.CharField(required=False, allow_blank=True, max_length=40)
    confirm_bank_account_number = serializers.CharField(required=False, allow_blank=True, max_length=40)
    bank_account_ifsc = serializers.CharField(required=False, allow_blank=True, max_length=20)
    vpa_address = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        account_type = attrs["account_type"]
        contact_name = (attrs.get("contact_name") or "").strip()
        contact_email = (attrs.get("contact_email") or "").strip().lower()
        contact_phone = (attrs.get("contact_phone") or "").strip()

        attrs["contact_name"] = contact_name
        attrs["contact_email"] = contact_email
        attrs["contact_phone"] = contact_phone

        if account_type == "bank_account":
            holder_name = (attrs.get("bank_account_holder_name") or "").strip()
            account_number = (attrs.get("bank_account_number") or "").strip()
            confirm_account_number = (attrs.get("confirm_bank_account_number") or "").strip()
            ifsc = (attrs.get("bank_account_ifsc") or "").strip().upper()

            if not holder_name:
                raise serializers.ValidationError({"bank_account_holder_name": "Account holder name is required."})
            if not account_number:
                raise serializers.ValidationError({"bank_account_number": "Bank account number is required."})
            if account_number != confirm_account_number:
                raise serializers.ValidationError({"confirm_bank_account_number": "Account numbers do not match."})
            if len(account_number) < 6 or not account_number.isdigit():
                raise serializers.ValidationError({"bank_account_number": "Enter a valid bank account number."})
            if len(ifsc) != 11 or not ifsc[:4].isalpha() or not ifsc[4] == "0":
                raise serializers.ValidationError({"bank_account_ifsc": "Enter a valid IFSC code."})

            attrs["bank_account_holder_name"] = holder_name
            attrs["bank_account_number"] = account_number
            attrs["bank_account_ifsc"] = ifsc
            attrs["vpa_address"] = ""
        else:
            vpa_address = (attrs.get("vpa_address") or "").strip().lower()
            if not vpa_address or "@" not in vpa_address:
                raise serializers.ValidationError({"vpa_address": "Enter a valid UPI ID."})

            attrs["vpa_address"] = vpa_address
            attrs["bank_account_holder_name"] = ""
            attrs["bank_account_number"] = ""
            attrs["bank_account_ifsc"] = ""

        return attrs


class PayoutAccountSerializer(serializers.ModelSerializer):
    masked_destination = serializers.SerializerMethodField()

    class Meta:
        model = PayoutAccount
        fields = [
            "account_type",
            "contact_name",
            "contact_email",
            "contact_phone",
            "bank_account_holder_name",
            "bank_account_ifsc",
            "bank_account_last4",
            "masked_destination",
            "is_active",
            "last_error",
            "last_synced_at",
            "created_at",
            "updated_at",
        ]

    def get_masked_destination(self, obj):
        return obj.get_masked_destination()


class WalletPayoutCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("1.00"))
    payout_mode = serializers.ChoiceField(choices=WalletPayout.MODE_CHOICES, required=False)

    def validate(self, attrs):
        payout_mode = (attrs.get("payout_mode") or "").strip().upper()
        attrs["payout_mode"] = payout_mode or "IMPS"
        return attrs


class WalletPayoutSerializer(serializers.ModelSerializer):
    payout_account_type = serializers.CharField(source="payout_account.account_type", read_only=True)

    class Meta:
        model = WalletPayout
        fields = [
            "id",
            "amount",
            "currency",
            "status",
            "mode",
            "destination_label",
            "failure_reason",
            "provider_payout_id",
            "provider_reference_id",
            "utr",
            "fees",
            "tax",
            "requested_at",
            "processed_at",
            "wallet_restored_at",
            "payout_account_type",
        ]


class CreateGroupSerializer(serializers.Serializer):
    subscription_name = serializers.CharField(max_length=100)
    mode = serializers.ChoiceField(choices=Group.MODE_CHOICES, default="sharing")
    total_slots = serializers.IntegerField(min_value=1)
    price_per_slot = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    access_identifier = serializers.CharField(required=False, allow_blank=True)
    access_password = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    access_notes = serializers.CharField(required=False, allow_blank=True)
    category = serializers.CharField(required=False, allow_blank=True, default="general")
    subscription_price = serializers.IntegerField(required=False, min_value=0, default=100)

    def validate_subscription_name(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Subscription name required.")
        return normalized

    def validate_access_identifier(self, value):
        return (value or "").strip()

    def validate_access_notes(self, value):
        return (value or "").strip()

    def validate_category(self, value):
        normalized = (value or "").strip()
        return normalized or "general"

    def validate(self, attrs):
        start_date = attrs["start_date"]
        end_date = attrs["end_date"]
        mode = attrs["mode"]
        access_identifier = attrs.get("access_identifier", "")
        access_password = (attrs.get("access_password") or "").strip()
        access_notes = (attrs.get("access_notes") or "").strip()

        if end_date < start_date:
            raise serializers.ValidationError({
                "end_date": "End date cannot be earlier than the start date."
            })

        if mode == "sharing":
            if bool(access_identifier) != bool(access_password):
                raise serializers.ValidationError({
                    "access_password": "Login email or username and password must be provided together."
                })
            if access_notes and not (access_identifier and access_password):
                raise serializers.ValidationError({
                    "access_notes": "Owner notes can be added after you save matching login details."
                })
        else:
            if access_identifier or access_password or access_notes:
                raise serializers.ValidationError({
                    "access_identifier": "Buy-together groups cannot store access credentials."
                })

        attrs["access_password"] = access_password
        attrs["access_notes"] = access_notes
        return attrs


class WalletTopupVerifySerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField(max_length=100)
    razorpay_payment_id = serializers.CharField(max_length=100)
    razorpay_signature = serializers.CharField(max_length=255)

    def validate(self, attrs):
        return {
            "razorpay_order_id": (attrs.get("razorpay_order_id") or "").strip(),
            "razorpay_payment_id": (attrs.get("razorpay_payment_id") or "").strip(),
            "razorpay_signature": (attrs.get("razorpay_signature") or "").strip(),
        }


class SubmitPurchaseProofSerializer(serializers.Serializer):
    purchase_proof = serializers.FileField()
    purchase_reference = serializers.CharField(required=False, allow_blank=True, max_length=255)
    purchase_notes = serializers.CharField(required=False, allow_blank=True)

    def validate_purchase_reference(self, value):
        return (value or "").strip()

    def validate_purchase_notes(self, value):
        return (value or "").strip()


class SubmitReviewSerializer(serializers.Serializer):
    reviewed_user_id = serializers.IntegerField(min_value=1)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=600)

    def validate_comment(self, value):
        return (value or "").strip()


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(source="reviewer.username", read_only=True)
    reviewed_username = serializers.CharField(source="reviewed_user.username", read_only=True)
    group_id = serializers.IntegerField(source="group.id", read_only=True)
    group_name = serializers.CharField(source="group.subscription.name", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "group_id",
            "group_name",
            "reviewer_username",
            "reviewed_username",
            "rating",
            "comment",
            "created_at",
            "updated_at",
        ]


class GroupChatMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    is_own = serializers.SerializerMethodField()

    class Meta:
        model = GroupChatMessage
        fields = ["id", "sender_username", "message", "created_at", "is_own"]

    def get_is_own(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.sender_id == request.user.id)


class SendGroupChatMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)

    def validate_message(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Message cannot be empty.")
        return normalized


class ProfileUpdateSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    last_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    profile_picture = serializers.ImageField(required=False, allow_null=True)
    remove_profile_picture = serializers.BooleanField(required=False, write_only=True, default=False)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "phone", "profile_picture", "remove_profile_picture"]

    def validate_phone(self, value):
        normalized = (value or "").strip()
        if not normalized:
            return None

        if User.objects.exclude(pk=self.instance.pk).filter(phone=normalized).exists():
            raise serializers.ValidationError("This phone number is already in use.")

        return normalized

    def validate_email(self, value):
        return (value or "").strip()

    def validate_profile_picture(self, value):
        if not value:
            return value

        max_size_bytes = 5 * 1024 * 1024
        if getattr(value, "size", 0) > max_size_bytes:
            raise serializers.ValidationError("Profile picture must be 5 MB or smaller.")

        content_type = getattr(value, "content_type", "") or ""
        if content_type and not content_type.startswith("image/"):
            raise serializers.ValidationError("Upload a valid image file.")

        return value

    def update(self, instance, validated_data):
        remove_profile_picture = validated_data.pop("remove_profile_picture", False)
        profile_picture = validated_data.pop("profile_picture", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if remove_profile_picture and instance.profile_picture:
            instance.profile_picture.delete(save=False)
            instance.profile_picture = None

        if profile_picture is not None:
            if instance.profile_picture:
                instance.profile_picture.delete(save=False)
            instance.profile_picture = profile_picture

        instance.save()
        return instance


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
    owner_name = serializers.CharField(source="owner.username", read_only=True)
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

        unread_messages = GroupChatMessage.objects.filter(group=obj).exclude(sender=request.user)
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


class TransactionSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.subscription.name", read_only=True)
    title = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    mode = serializers.CharField(source="group.mode", read_only=True)
    mode_label = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id",
            "group_name",
            "amount",
            "type",
            "status",
            "payment_method",
            "mode",
            "mode_label",
            "title",
            "description",
            "created_at",
        ]

    def get_title(self, obj):
        return get_transaction_copy(obj)["title"]

    def get_description(self, obj):
        return get_transaction_copy(obj)["description"]

    def get_mode_label(self, obj):
        if not obj.group:
            return "Wallet"
        return get_mode_copy(obj.group.mode)["label"]
