from django.db import migrations


def backfill_group_and_member_state(apps, schema_editor):
    Group = apps.get_model("core", "Group")
    GroupMember = apps.get_model("core", "GroupMember")

    Group.objects.filter(mode="group_buy", status="full").update(status="awaiting_purchase")
    Group.objects.filter(mode="sharing", status="full").update(status="active")

    GroupMember.objects.filter(group__mode="sharing").update(escrow_status="released")
    GroupMember.objects.filter(group__mode="group_buy", group__status="active").update(escrow_status="released")
    GroupMember.objects.filter(group__mode="group_buy", group__status="refunded").update(escrow_status="refunded")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_group_auto_refund_at_group_funds_released_at_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_group_and_member_state, migrations.RunPython.noop),
    ]
