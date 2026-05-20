from .common import *

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


class MobilePushRegistrationSerializer(serializers.Serializer):
    expo_push_token = serializers.CharField(max_length=255)
    platform = serializers.ChoiceField(choices=MobilePushDevice.PLATFORM_CHOICES, default="android")
    project_id = serializers.CharField(required=False, allow_blank=True, max_length=120)
    device_name = serializers.CharField(required=False, allow_blank=True, max_length=120)

    def validate_expo_push_token(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Expo push token is required.")
        if not (
            normalized.startswith("ExponentPushToken[")
            or normalized.startswith("ExpoPushToken[")
        ):
            raise serializers.ValidationError("Enter a valid Expo push token.")
        return normalized

    def validate_project_id(self, value):
        return (value or "").strip()

    def validate_device_name(self, value):
        return (value or "").strip()


class MobilePushUnregisterSerializer(serializers.Serializer):
    expo_push_token = serializers.CharField(max_length=255)

    def validate_expo_push_token(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Expo push token is required.")
        return normalized


class AccountDeletionRequestCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=120)
    details = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate_reason(self, value):
        return (value or "").strip()

    def validate_details(self, value):
        return (value or "").strip()


class AccountDeletionRequestSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = AccountDeletionRequest
        fields = [
            "id",
            "status",
            "status_label",
            "contact_email",
            "reason",
            "details",
            "request_source",
            "created_at",
            "updated_at",
            "processed_at",
        ]


