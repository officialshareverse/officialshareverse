from decimal import Decimal

from django.db import migrations, models


def backfill_groupmember_charged_amount(apps, schema_editor):
    GroupMember = apps.get_model("core", "GroupMember")

    for member in GroupMember.objects.select_related("group").all():
        if member.charged_amount and member.charged_amount > 0:
            continue
        member.charged_amount = member.group.price_per_slot or Decimal("0.00")
        member.save(update_fields=["charged_amount"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0018_groupchatreadstate"),
    ]

    operations = [
        migrations.AddField(
            model_name="groupmember",
            name="charged_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.RunPython(
            backfill_groupmember_charged_amount,
            migrations.RunPython.noop,
        ),
    ]
