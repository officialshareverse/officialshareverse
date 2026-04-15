from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0024_user_profile_picture"),
    ]

    operations = [
        migrations.AddField(
            model_name="groupmember",
            name="platform_fee_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
