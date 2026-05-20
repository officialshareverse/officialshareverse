from .common import *

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
