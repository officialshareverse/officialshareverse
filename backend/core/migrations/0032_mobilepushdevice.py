from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0031_wallet_bonus_balance"),
    ]

    operations = [
        migrations.CreateModel(
            name="MobilePushDevice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("expo_push_token", models.CharField(db_index=True, max_length=255, unique=True)),
                (
                    "platform",
                    models.CharField(
                        choices=[("android", "Android"), ("ios", "iOS"), ("web", "Web")],
                        default="android",
                        max_length=20,
                    ),
                ),
                ("project_id", models.CharField(blank=True, default="", max_length=120)),
                ("device_name", models.CharField(blank=True, default="", max_length=120)),
                ("is_active", models.BooleanField(default=True)),
                ("last_registered_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_notified_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="mobile_push_devices",
                        to="core.user",
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="mobilepushdevice",
            index=models.Index(fields=["user", "is_active"], name="core_mobile_user_id_42a3ee_idx"),
        ),
        migrations.AddIndex(
            model_name="mobilepushdevice",
            index=models.Index(fields=["platform", "is_active"], name="core_mobile_platfor_b83d7c_idx"),
        ),
    ]
