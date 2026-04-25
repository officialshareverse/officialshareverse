from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0030_groupinvitelink_referralcode_referral"),
    ]

    operations = [
        migrations.AddField(
            model_name="wallet",
            name="bonus_balance",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
