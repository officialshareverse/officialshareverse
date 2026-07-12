from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ("core", "0038_user_google_sub"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="walletpayout",
            index=models.Index(
                fields=["user"],
                name="one_open_manual_req_idx",
                condition=models.Q(
                    provider="manual",
                    transaction__isnull=True,
                    status__in=["created", "pending", "queued", "processing"],
                ),
            ),
        ),
    ]
