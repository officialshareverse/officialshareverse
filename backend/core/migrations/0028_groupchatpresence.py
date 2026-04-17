from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0027_walletpayout_manual_audit_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="GroupChatPresence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("last_seen_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("is_typing", models.BooleanField(default=False)),
                ("typing_updated_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("group", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="chat_presence_states", to="core.group")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="core.user")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["group", "last_seen_at"], name="core_groupc_group_i_f7fb62_idx"),
                    models.Index(fields=["group", "is_typing", "typing_updated_at"], name="core_groupc_group_i_4f80d6_idx"),
                ],
                "unique_together": {("group", "user")},
            },
        ),
    ]
