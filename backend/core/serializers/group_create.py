from .common import *

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
        if not settings.DEBUG and normalized.lower() in {"demo", "test", "sample"}:
            raise serializers.ValidationError("Use the real plan name before publishing.")
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


