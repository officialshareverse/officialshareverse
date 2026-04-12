from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0020_review_constraints_and_timestamps"),
    ]

    operations = [
        migrations.CreateModel(
            name="WalletTopupOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=10)),
                ("amount_subunits", models.PositiveIntegerField()),
                ("currency", models.CharField(default="INR", max_length=3)),
                ("provider", models.CharField(default="razorpay", max_length=30)),
                ("receipt", models.CharField(max_length=40, unique=True)),
                ("provider_order_id", models.CharField(max_length=100, unique=True)),
                ("provider_payment_id", models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ("provider_signature", models.CharField(blank=True, default="", max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[("created", "Created"), ("paid", "Paid"), ("failed", "Failed")],
                        default="created",
                        max_length=20,
                    ),
                ),
                ("credited_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="wallet_topup_orders",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
    ]
