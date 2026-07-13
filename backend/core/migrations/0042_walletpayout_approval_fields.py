"""WalletPayout two-person approval fields (C6 fix)."""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0040_groupmember_cash_used_bonus_used"),
    ]

    operations = [
        migrations.AddField(
            model_name="walletpayout",
            name="approved_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="approved_payouts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="walletpayout",
            name="approved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
