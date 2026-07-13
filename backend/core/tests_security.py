"""A3 tests for credential-encryption key rotation."""
import base64
import hashlib

from cryptography.fernet import Fernet
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, override_settings

from core.security import (
    decrypt_secret,
    encrypt_secret,
    get_active_key_id,
    get_key_id_for_ciphertext,
)


@override_settings(
    CREDENTIAL_ENCRYPTION_KEY="test-key-1",
    CREDENTIAL_ENCRYPTION_KEYS={"v1": "test-key-1"},
    CREDENTIAL_ENCRYPTION_ACTIVE_KEY_ID="v1",
)
class EncryptionRoundTripTests(TestCase):
    def test_round_trip_uses_active_key(self):
        encrypted = encrypt_secret("hello world")
        self.assertTrue(encrypted.startswith("enc::v1::"))
        self.assertEqual(decrypt_secret(encrypted), "hello world")

    def test_empty_and_plaintext_values(self):
        self.assertEqual(encrypt_secret(""), "")
        self.assertEqual(encrypt_secret(None), "")
        self.assertEqual(decrypt_secret("plain"), "plain")

    def test_ciphertexts_use_distinct_ivs(self):
        self.assertNotEqual(encrypt_secret("same"), encrypt_secret("same"))

    def test_legacy_sha256_ciphertext_decrypts(self):
        legacy_key = base64.urlsafe_b64encode(hashlib.sha256(b"test-key-1").digest())
        legacy_ciphertext = "enc::" + Fernet(legacy_key).encrypt(b"legacy").decode("ascii")
        self.assertEqual(decrypt_secret(legacy_ciphertext), "legacy")


@override_settings(
    CREDENTIAL_ENCRYPTION_KEY="v2-key",
    CREDENTIAL_ENCRYPTION_KEYS={"v1": "v1-key", "v2": "v2-key"},
    CREDENTIAL_ENCRYPTION_ACTIVE_KEY_ID="v2",
)
class KeyRotationTests(TestCase):
    def test_old_key_decrypts_and_new_key_encrypts(self):
        old_ciphertext = encrypt_secret("rotated", key_id="v1")
        self.assertEqual(get_key_id_for_ciphertext(old_ciphertext), "v1")
        self.assertEqual(decrypt_secret(old_ciphertext), "rotated")
        self.assertEqual(get_key_id_for_ciphertext(encrypt_secret("rotated")), "v2")

    def test_unknown_key_fails_closed(self):
        self.assertEqual(decrypt_secret("enc::unknown::gAAAAABm"), "")


class MissingKeyTests(TestCase):
    @override_settings(CREDENTIAL_ENCRYPTION_KEY="", CREDENTIAL_ENCRYPTION_KEYS={})
    def test_missing_key_fails(self):
        with self.assertRaises(ImproperlyConfigured):
            get_active_key_id()

    @override_settings(
        CREDENTIAL_ENCRYPTION_KEY="key",
        CREDENTIAL_ENCRYPTION_KEYS={"v1": "key"},
        CREDENTIAL_ENCRYPTION_ACTIVE_KEY_ID="v2",
    )
    def test_missing_active_key_id_fails(self):
        with self.assertRaises(ImproperlyConfigured):
            get_active_key_id()
