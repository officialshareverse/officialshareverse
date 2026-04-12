from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0019_groupmember_charged_amount"),
    ]

    operations = [
        migrations.AlterField(
            model_name="review",
            name="comment",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="review",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AlterUniqueTogether(
            name="review",
            unique_together={("reviewer", "reviewed_user", "group")},
        ),
    ]
