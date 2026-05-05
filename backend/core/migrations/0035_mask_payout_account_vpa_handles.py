from django.db import migrations


def mask_vpa_handle(vpa_handle):
    normalized = (vpa_handle or "").strip().lower()
    if not normalized:
        return ""
    if "*" in normalized:
        return normalized

    username, separator, handle = normalized.partition("@")
    if not separator:
        if len(normalized) <= 2:
            return "*" * len(normalized)
        return f"{normalized[:2]}{'*' * max(len(normalized) - 2, 1)}"

    if len(username) <= 2:
        masked_username = "*" * len(username)
    else:
        masked_username = f"{username[:2]}{'*' * max(len(username) - 2, 1)}"
    return f"{masked_username}@{handle}"


def mask_existing_vpa_handles(apps, schema_editor):
    PayoutAccount = apps.get_model("core", "PayoutAccount")
    accounts = PayoutAccount.objects.exclude(vpa_handle="")

    for account in accounts.iterator():
        masked_handle = mask_vpa_handle(account.vpa_handle)
        if masked_handle != account.vpa_handle:
            account.vpa_handle = masked_handle
            account.save(update_fields=["vpa_handle"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0034_contentreport_userblock_groupchatmessage_hidden_at_and_more"),
    ]

    operations = [
        migrations.RunPython(mask_existing_vpa_handles, migrations.RunPython.noop),
    ]
