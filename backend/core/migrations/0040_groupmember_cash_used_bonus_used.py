from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("core", "0039_enforce_one_open_manual_payout")]

    operations = [
        migrations.AddField(
            model_name="groupmember",
            name="cash_used",
            field=models.DecimalField(max_digits=10, decimal_places=2, default=0),
        ),
        migrations.AddField(
            model_name="groupmember",
            name="bonus_used",
            field=models.DecimalField(max_digits=10, decimal_places=2, default=0),
        ),
        # Backfill is intentionally NOT attempted: historical members have no
        # recorded split, so we conservatively assume 100% cash on refund
        # (default=0 for bonus_used means refund goes entirely to balance,
        # matching the old behavior for pre-migration rows). New joins record
        # the true split.
    ]
