import base64
import hashlib
import os

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import migrations

PREFIX = "enc::"


def _build_cipher():
    base_secret = os.environ.get("CREDENTIAL_ENCRYPTION_KEY") or settings.SECRET_KEY or ""
    digest = hashlib.sha256(base_secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def _encrypt_if_needed(value, cipher):
    normalized = (value or "").strip()
    if not normalized:
        return ""
    if normalized.startswith(PREFIX):
        return normalized
    return f"{PREFIX}{cipher.encrypt(normalized.encode('utf-8')).decode('utf-8')}"


def encrypt_existing_credentials(apps, schema_editor):
    Group = apps.get_model("core", "Group")
    cipher = _build_cipher()

    for group in Group.objects.exclude(access_identifier="").iterator():
        next_identifier = _encrypt_if_needed(group.access_identifier, cipher)
        if next_identifier != group.access_identifier:
            group.access_identifier = next_identifier
            group.save(update_fields=["access_identifier"])

    for group in Group.objects.exclude(access_password="").iterator():
        next_password = _encrypt_if_needed(group.access_password, cipher)
        if next_password != group.access_password:
            group.access_password = next_password
            group.save(update_fields=["access_password"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_credentialrevealtoken_passwordresetotp"),
    ]

    operations = [
        migrations.RunPython(encrypt_existing_credentials, migrations.RunPython.noop),
    ]
