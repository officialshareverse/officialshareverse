from .common import *

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


