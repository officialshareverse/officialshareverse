from .common import *

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
    sender_id = serializers.IntegerField(source="sender.id", read_only=True)
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    is_own = serializers.SerializerMethodField()

    class Meta:
        model = GroupChatMessage
        fields = ["id", "sender_id", "sender_username", "message", "created_at", "is_own"]

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


class GroupChatPresenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupChatPresence
        fields = ["is_typing"]


class UserBlockSerializer(serializers.ModelSerializer):
    blocked_user_id = serializers.IntegerField(source="blocked.id", read_only=True)
    blocked_username = serializers.CharField(source="blocked.username", read_only=True)
    blocked_display_name = serializers.SerializerMethodField()

    class Meta:
        model = UserBlock
        fields = [
            "id",
            "blocked_user_id",
            "blocked_username",
            "blocked_display_name",
            "reason",
            "created_at",
        ]

    def get_blocked_display_name(self, obj):
        return public_user_display_name(obj.blocked)


class UserBlockCreateSerializer(serializers.Serializer):
    blocked_user_id = serializers.IntegerField()
    reason = serializers.CharField(max_length=300, allow_blank=True, required=False)


class ContentReportSerializer(serializers.ModelSerializer):
    reporter_username = serializers.CharField(source="reporter.username", read_only=True)
    reported_username = serializers.CharField(source="reported_user.username", read_only=True)
    group_name = serializers.CharField(source="group.subscription.name", read_only=True)
    chat_message_text = serializers.CharField(source="chat_message.message", read_only=True)

    class Meta:
        model = ContentReport
        fields = [
            "id",
            "reporter_username",
            "target_type",
            "reported_username",
            "group",
            "group_name",
            "chat_message",
            "chat_message_text",
            "reason",
            "details",
            "status",
            "created_at",
            "updated_at",
        ]


class ContentReportCreateSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=ContentReport.TARGET_TYPE_CHOICES)
    target_id = serializers.IntegerField()
    reason = serializers.ChoiceField(choices=ContentReport.REASON_CHOICES, default="other")
    details = serializers.CharField(max_length=1000, allow_blank=True, required=False)


