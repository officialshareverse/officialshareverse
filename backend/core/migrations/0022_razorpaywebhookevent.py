from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0021_wallettopuporder"),
    ]

    operations = [
        migrations.CreateModel(
            name="RazorpayWebhookEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_id", models.CharField(max_length=120, unique=True)),
                ("event_type", models.CharField(max_length=80)),
                ("payment_id", models.CharField(blank=True, default="", max_length=100)),
                ("provider_order_id", models.CharField(blank=True, default="", max_length=100)),
                (
                    "status",
                    models.CharField(
                        choices=[("processed", "Processed"), ("ignored", "Ignored"), ("failed", "Failed")],
                        default="processed",
                        max_length=20,
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                ("processed_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-processed_at", "-id"],
            },
        ),
    ]
