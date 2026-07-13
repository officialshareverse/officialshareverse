"""Re-encrypt group credentials to the configured active key."""
from django.core.management.base import BaseCommand

from core.models import Group
from core.security import (
    decrypt_secret,
    encrypt_secret,
    get_active_key_id,
    get_key_id_for_ciphertext,
)


class Command(BaseCommand):
    help = "Re-encrypt Group access credentials to the active encryption key."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--batch-size", type=int, default=500)

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        active_key_id = get_active_key_id()
        rotated = skipped = failed = 0
        fields = ("access_identifier", "access_password")
        groups = Group.objects.only("id", *fields).iterator(chunk_size=options["batch_size"])

        self.stdout.write(f"Active key id: {active_key_id}; dry run: {dry_run}")
        for group in groups:
            for field in fields:
                value = getattr(group, field, "")
                if not value:
                    continue
                current_key_id = get_key_id_for_ciphertext(value)
                if current_key_id == active_key_id:
                    skipped += 1
                    continue
                plaintext = decrypt_secret(value)
                if not plaintext:
                    failed += 1
                    self.stderr.write(
                        f"group_id={group.id} field={field}: decryption failed; not rotated."
                    )
                    continue
                if dry_run:
                    self.stdout.write(
                        f"group_id={group.id} field={field}: {current_key_id} -> {active_key_id}"
                    )
                else:
                    setattr(group, field, encrypt_secret(plaintext))
                    group.save(update_fields=[field])
                rotated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Rotated: {rotated}, skipped: {skipped}, failed: {failed}."
            )
        )
        if failed:
            self.stderr.write(
                "Keep old keys in CREDENTIAL_ENCRYPTION_KEYS until all ciphertexts rotate."
            )
