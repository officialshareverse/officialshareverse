from .common import *

class GenerateGroupInviteLinkSerializer(serializers.Serializer):
    group_id = serializers.IntegerField(min_value=1)
    max_uses = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    expires_in_hours = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=720)


class GroupInviteLinkSerializer(serializers.ModelSerializer):
    group_id = serializers.IntegerField(read_only=True)
    invite_url = serializers.SerializerMethodField()

    class Meta:
        model = GroupInviteLink
        fields = [
            "id",
            "token",
            "group_id",
            "is_active",
            "max_uses",
            "use_count",
            "expires_at",
            "created_at",
            "invite_url",
        ]

    def get_invite_url(self, obj):
        return f"{get_frontend_base_url()}/invite/{obj.token}"


class AcceptGroupInviteSerializer(serializers.Serializer):
    token = serializers.UUIDField()


class ReferralSerializer(serializers.ModelSerializer):
    referred_username = serializers.CharField(source="referred_user.username", read_only=True)

    class Meta:
        model = Referral
        fields = [
            "id",
            "referred_username",
            "status",
            "reward_given",
            "reward_amount",
            "created_at",
            "updated_at",
        ]


class ReferralCodeSerializer(serializers.ModelSerializer):
    referrals = ReferralSerializer(source="user.referrals_made", many=True, read_only=True)
    total_rewards_earned = serializers.SerializerMethodField()

    class Meta:
        model = ReferralCode
        fields = [
            "code",
            "total_referrals",
            "successful_referrals",
            "total_rewards_earned",
            "referrals",
        ]

    def get_total_rewards_earned(self, obj):
        total_rewards = (
            Referral.objects.filter(referral_code=obj, reward_given=True).aggregate(total=Sum("reward_amount"))["total"]
            or Decimal("0.00")
        )
        return str(total_rewards)


class ValidateReferralCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=20)

    def validate_code(self, value):
        return normalize_referral_code_value(value)


