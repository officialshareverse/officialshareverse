from .common import *

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

        try:
            import magic
            file_header = value.read(2048)
            value.seek(0)
            mime_type = magic.from_buffer(file_header, mime=True)
            if not mime_type.startswith("image/"):
                raise serializers.ValidationError("Upload a valid image file.")
        except ImportError:
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


