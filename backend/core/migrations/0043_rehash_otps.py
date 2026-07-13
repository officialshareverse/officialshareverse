"""OTP hash cutover: invalidate legacy SHA-256 OTPs and widen the field."""
from django.db import migrations, models
from django.utils import timezone


def force_expire_otps(apps, schema_editor):
    now = timezone.now()
    for model_name in ("SignupOTP", "PasswordResetOTP"):
        model = apps.get_model("core", model_name)
        model.objects.filter(is_used=False).update(
            is_used=True,
            expires_at=now,
            attempts_remaining=0,
        )


class Migration(migrations.Migration):
    dependencies = [("core", "0042_walletpayout_approval_fields")]

    operations = [
        migrations.AlterField(
            model_name="signupotp",
            name="otp_hash",
            field=models.CharField(max_length=255),
        ),
        migrations.AlterField(
            model_name="passwordresetotp",
            name="otp_hash",
            field=models.CharField(max_length=255),
        ),
        migrations.RunPython(force_expire_otps, migrations.RunPython.noop),
    ]
