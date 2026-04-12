import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

_SECRET_PREFIX = "enc::"


def _build_key():
    base_secret = os.environ.get("CREDENTIAL_ENCRYPTION_KEY") or settings.SECRET_KEY or ""
    digest = hashlib.sha256(base_secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_cipher():
    return Fernet(_build_key())


def is_encrypted_secret(value):
    return bool(value and value.startswith(_SECRET_PREFIX))


def encrypt_secret(value):
    normalized = (value or "").strip()
    if not normalized:
        return ""
    token = _get_cipher().encrypt(normalized.encode("utf-8")).decode("utf-8")
    return f"{_SECRET_PREFIX}{token}"


def decrypt_secret(value):
    if not value:
        return ""

    if not is_encrypted_secret(value):
        return value

    token = value[len(_SECRET_PREFIX):]
    try:
        return _get_cipher().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""
