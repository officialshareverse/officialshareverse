"""Enforce unique, case-insensitive user emails and usernames (A2 fix)."""
from django.db import migrations, models
from django.db.models.functions import Lower


def detect_ci_duplicates(apps, schema_editor):
    User = apps.get_model("core", "User")
    email_counts = {}
    for email in User.objects.exclude(email__isnull=True).exclude(email="").values_list("email", flat=True):
        email_counts[email.lower()] = email_counts.get(email.lower(), 0) + 1
    duplicate_emails = {key: count for key, count in email_counts.items() if count > 1}
    if duplicate_emails:
        sample = ", ".join(
            f"{email!r} (x{count})" for email, count in list(duplicate_emails.items())[:20]
        )
        raise RuntimeError(
            "Cannot add case-insensitive email uniqueness; resolve duplicate groups first: " + sample
        )

    username_counts = {}
    for username in User.objects.values_list("username", flat=True):
        username_counts[username.lower()] = username_counts.get(username.lower(), 0) + 1
    duplicate_usernames = {key: count for key, count in username_counts.items() if count > 1}
    if duplicate_usernames:
        sample = ", ".join(
            f"{username!r} (x{count})" for username, count in list(duplicate_usernames.items())[:20]
        )
        raise RuntimeError(
            "Cannot add case-insensitive username uniqueness; resolve duplicate groups first: " + sample
        )


def normalize_blank_emails_to_null(apps, schema_editor):
    apps.get_model("core", "User").objects.filter(email="").update(email=None)


def reverse_normalize_blank_emails_to_null(apps, schema_editor):
    apps.get_model("core", "User").objects.filter(email__isnull=True).update(email="")


class Migration(migrations.Migration):
    # Filename order intentionally differs from dependency order to preserve the
    # requested linear graph: 0040 -> 0042 -> 0043 -> 0041.
    dependencies = [("core", "0043_rehash_otps")]

    operations = [
        migrations.RunPython(detect_ci_duplicates, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="email",
            field=models.EmailField(
                blank=True,
                max_length=254,
                null=True,
                unique=True,
                verbose_name="email address",
            ),
        ),
        migrations.RunPython(
            normalize_blank_emails_to_null,
            reverse_normalize_blank_emails_to_null,
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(Lower("email"), name="unique_email_ci"),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(Lower("username"), name="unique_username_ci"),
        ),
    ]
