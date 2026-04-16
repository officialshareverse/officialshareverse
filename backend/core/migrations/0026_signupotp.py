import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0025_groupmember_platform_fee_amount"),
    ]

    operations = [
        migrations.CreateModel(
            name="SignupOTP",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("username", models.CharField(max_length=150)),
                ("email", models.EmailField(max_length=254)),
                ("phone", models.CharField(blank=True, default="", max_length=15)),
                ("channel", models.CharField(choices=[("email", "Email"), ("phone", "Phone")], default="email", max_length=10)),
                ("otp_hash", models.CharField(max_length=64)),
                ("expires_at", models.DateTimeField()),
                ("attempts_remaining", models.PositiveIntegerField(default=5)),
                ("is_used", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
