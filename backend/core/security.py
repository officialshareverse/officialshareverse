"""Key-ring based credential encryption with rotation support.

New ciphertexts use ``enc::<key_id>::<fernet_token>``.  The legacy
``enc::<fernet_token>`` format remains decryptable while its key stays in the
configured key ring.
"""
import base64
import functools
import hashlib
import logging
from typing import Dict, Optional

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)

LEGACY_PREFIX = "enc::"
PBKDF2_ITERATIONS = 600_000
PBKDF2_SALT = b"shareverse-credential-encryption-v1"


def _derive_fernet_key(key_string: str) -> bytes:
    """Derive a Fernet key with PBKDF2-HMAC-SHA256."""
    raw = hashlib.pbkdf2_hmac(
        "sha256",
        key_string.encode("utf-8"),
        PBKDF2_SALT,
        PBKDF2_ITERATIONS,
    )
    return base64.urlsafe_b64encode(raw)


def _derive_legacy_fernet_key(key_string: str) -> bytes:
    """Return the old SHA-256-derived key for backward-compatible reads."""
    return base64.urlsafe_b64encode(hashlib.sha256(key_string.encode("utf-8")).digest())


@functools.lru_cache(maxsize=None)
def _get_fernet_for_key(key_string: str, legacy: bool = False) -> Fernet:
    key = _derive_legacy_fernet_key(key_string) if legacy else _derive_fernet_key(key_string)
    return Fernet(key)


def _get_key_strings() -> Dict[str, str]:
    configured_keys = getattr(settings, "CREDENTIAL_ENCRYPTION_KEYS", None) or {}
    keys = {str(key_id): value for key_id, value in configured_keys.items() if value}
    if keys:
        return keys

    active_key = getattr(settings, "CREDENTIAL_ENCRYPTION_KEY", None)
    if active_key:
        return {"v1": active_key}

    raise ImproperlyConfigured(
        "CREDENTIAL_ENCRYPTION_KEY is required. Configure a persistent secret "
        "and, when rotating, CREDENTIAL_ENCRYPTION_KEYS."
    )


def get_key_ring() -> Dict[str, Fernet]:
    """Return every configured key-id mapped to its modern Fernet cipher."""
    return {key_id: _get_fernet_for_key(key) for key_id, key in _get_key_strings().items()}


def get_active_key_id() -> str:
    active_key_id = getattr(settings, "CREDENTIAL_ENCRYPTION_ACTIVE_KEY_ID", "v1")
    if active_key_id not in get_key_ring():
        raise ImproperlyConfigured(
            "CREDENTIAL_ENCRYPTION_ACTIVE_KEY_ID={!r} is not present in "
            "CREDENTIAL_ENCRYPTION_KEYS.".format(active_key_id)
        )
    return active_key_id


def get_key_id_for_ciphertext(value: str) -> Optional[str]:
    """Return a key-ring ciphertext's embedded key id, if one exists."""
    if not is_encrypted_secret(value):
        return None
    remainder = value[len(LEGACY_PREFIX) :]
    if "::" not in remainder:
        return None
    return remainder.split("::", 1)[0] or None


def is_encrypted_secret(value) -> bool:
    return isinstance(value, str) and value.startswith(LEGACY_PREFIX)


def encrypt_secret(value, key_id: Optional[str] = None) -> str:
    """Encrypt a value under the selected key, defaulting to the active key."""
    if value is None or value == "":
        return ""
    if not isinstance(value, str):
        value = str(value)

    key_ring = get_key_ring()
    use_key_id = key_id or get_active_key_id()
    if use_key_id not in key_ring:
        raise ImproperlyConfigured(f"key_id={use_key_id!r} is not in CREDENTIAL_ENCRYPTION_KEYS.")

    token = key_ring[use_key_id].encrypt(value.encode("utf-8")).decode("ascii")
    return f"{LEGACY_PREFIX}{use_key_id}::{token}"


def decrypt_secret(value) -> str:
    """Decrypt modern and legacy ciphertexts; fail closed on invalid input."""
    if not value or not is_encrypted_secret(value):
        return value or ""

    remainder = value[len(LEGACY_PREFIX) :]
    key_strings = _get_key_strings()
    key_ring = get_key_ring()

    if "::" in remainder:
        key_id, token = remainder.split("::", 1)
        fernet = key_ring.get(key_id)
        if fernet is None:
            logger.warning("Credential ciphertext references unknown key id %r.", key_id)
            return ""
        try:
            return fernet.decrypt(token.encode("ascii")).decode("utf-8")
        except (InvalidToken, UnicodeError):
            # Supports a short-lived transitional format produced with the old KDF
            # but already carrying a key id.
            legacy_key = key_strings.get(key_id)
            if legacy_key:
                try:
                    return _get_fernet_for_key(legacy_key, legacy=True).decrypt(
                        token.encode("ascii")
                    ).decode("utf-8")
                except (InvalidToken, UnicodeError):
                    pass
            logger.warning("Credential ciphertext could not be decrypted for key id %r.", key_id)
            return ""

    active_key_id = get_active_key_id()
    ordered_key_ids = [active_key_id] + [key_id for key_id in key_ring if key_id != active_key_id]
    for key_id in ordered_key_ids:
        try:
            return key_ring[key_id].decrypt(remainder.encode("ascii")).decode("utf-8")
        except (InvalidToken, UnicodeError):
            pass
        try:
            return _get_fernet_for_key(key_strings[key_id], legacy=True).decrypt(
                remainder.encode("ascii")
            ).decode("utf-8")
        except (InvalidToken, UnicodeError):
            continue

    logger.warning("No credential-encryption key could decrypt legacy ciphertext.")
    return ""
