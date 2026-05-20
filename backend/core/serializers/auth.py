from .common import *

class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    last_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    referral_code = serializers.CharField(required=False, allow_blank=True, allow_null=True, write_only=True)

    class Meta:
        model = User
        fields = ["username", "first_name", "last_name", "email", "phone", "password", "referral_code"]

    def validate_username(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Username is required.")
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError("This username is already in use.")
        return normalized

    def validate_email(self, value):
        normalized = (value or "").strip().lower()
        if not normalized:
            raise serializers.ValidationError("Email is required.")
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("This email is already in use.")
        return normalized

    def validate_phone(self, value):
        normalized = normalize_indian_phone_value(value)
        if not normalized:
            return None
        if User.objects.filter(phone=normalized).exists():
            raise serializers.ValidationError("This phone number is already in use.")
        return normalized

    def validate_referral_code(self, value):
        return validate_referral_code_value(value)

    def create(self, validated_data):
        is_verified = validated_data.pop("is_verified", False)
        validated_data.pop("referral_code", "")
        validated_data["password"] = make_password(validated_data["password"])
        validated_data["email"] = (validated_data.get("email") or "").strip().lower()
        validated_data["phone"] = (validated_data.get("phone") or "").strip() or None
        validated_data["is_verified"] = is_verified
        return super().create(validated_data)


class SignupRequestOTPSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    referral_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_username(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Username is required.")
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError("This username is already in use.")
        return normalized

    def validate_email(self, value):
        normalized = (value or "").strip().lower()
        if not normalized:
            raise serializers.ValidationError("Email is required.")
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("This email is already in use.")
        return normalized

    def validate_phone(self, value):
        normalized = normalize_indian_phone_value(value)
        if not normalized:
            return ""
        if User.objects.filter(phone=normalized).exists():
            raise serializers.ValidationError("This phone number is already in use.")
        return normalized

    def validate_referral_code(self, value):
        return validate_referral_code_value(value)

    def validate(self, attrs):
        attrs["channel"] = "email"
        return attrs


class SignupAvailabilitySerializer(serializers.Serializer):
    username = serializers.CharField()

    def validate_username(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Username is required.")
        return normalized


class SignupConfirmSerializer(serializers.Serializer):
    signup_session_id = serializers.UUIDField()
    otp = serializers.CharField(min_length=6, max_length=6)
    username = serializers.CharField()
    first_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    last_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(min_length=8, write_only=True)
    referral_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_referral_code(self, value):
        return validate_referral_code_value(value)

    def validate(self, attrs):
        attrs["username"] = (attrs.get("username") or "").strip()
        attrs["email"] = (attrs.get("email") or "").strip().lower()
        attrs["phone"] = normalize_indian_phone_value(attrs.get("phone"))
        attrs["otp"] = (attrs.get("otp") or "").strip()
        attrs["first_name"] = (attrs.get("first_name") or "").strip()
        attrs["last_name"] = (attrs.get("last_name") or "").strip()
        attrs["referral_code"] = normalize_referral_code_value(attrs.get("referral_code"))

        if not attrs["username"]:
            raise serializers.ValidationError({"username": "Username is required."})
        if not attrs["email"]:
            raise serializers.ValidationError({"email": "Email is required."})
        if not attrs["otp"].isdigit():
            raise serializers.ValidationError({"otp": "OTP must be a 6-digit code."})

        return attrs


class GoogleAuthSerializer(serializers.Serializer):
    credential = serializers.CharField()

    def validate_credential(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Google credential is required.")
        return normalized


class ForgotPasswordRequestSerializer(serializers.Serializer):
    username = serializers.CharField()
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        username = normalize_login_identifier(attrs.get("username"))
        email = (attrs.get("email") or "").strip().lower()

        if not username:
            raise serializers.ValidationError({"username": "Username or email is required."})

        user = find_user_by_login_identifier(username)
        if not user:
            raise serializers.ValidationError({"username": "Account verification failed."})

        if email and (user.email or "").strip().lower() != email:
            raise serializers.ValidationError({"email": "Account verification failed."})

        destination_email = (user.email or "").strip().lower()
        if not destination_email:
            raise serializers.ValidationError(
                {"email": "This account does not have an email address available for password reset."}
            )

        attrs["user"] = user
        attrs["email"] = destination_email
        attrs["channel"] = "email"
        return attrs


class ForgotPasswordConfirmSerializer(serializers.Serializer):
    username = serializers.CharField()
    reset_session_id = serializers.UUIDField()
    otp = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate(self, attrs):
        attrs["username"] = normalize_login_identifier(attrs.get("username"))
        attrs["otp"] = (attrs.get("otp") or "").strip()

        if not attrs["username"]:
            raise serializers.ValidationError({"username": "Username or email is required."})

        if not attrs["otp"].isdigit():
            raise serializers.ValidationError({"otp": "OTP must be a 6-digit code."})

        return attrs


