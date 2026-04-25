from datetime import date, timedelta
from decimal import Decimal
import shutil
import tempfile
import json
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import DatabaseError
from django.utils import timezone
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .pricing import get_group_join_pricing
from .models import (
    EscrowLedger,
    Group,
    GroupChatMessage,
    GroupChatPresence,
    GroupChatReadState,
    GroupInviteLink,
    GroupMember,
    Notification,
    PasswordResetOTP,
    PayoutAccount,
    RazorpayWebhookEvent,
    RazorpayXPayoutWebhookEvent,
    Referral,
    ReferralCode,
    Review,
    SignupOTP,
    Subscription,
    Transaction,
    User,
    Wallet,
    WalletPayout,
    WalletTopupOrder,
)
from .manual_payouts import create_manual_wallet_payout, create_manual_wallet_payout_request
from .payments import PaymentGatewayError


class GroupFlowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.media_root = tempfile.mkdtemp(prefix="shareverse-test-media-")
        self.media_override = override_settings(MEDIA_ROOT=self.media_root)
        self.media_override.enable()
        self.subscription = Subscription.objects.create(
            name="Netflix",
            max_slots=4,
            category="streaming",
            price=499,
        )
        self.owner = self.create_user("owner", "9000000001")
        self.member_one = self.create_user("member1", "9000000002")
        self.member_two = self.create_user("member2", "9000000003")
        self.outsider = self.create_user("outsider", "9000000004")

    def create_user(self, username, phone, is_staff=False):
        user = User.objects.create_user(
            username=username,
            password="password123",
            email=f"{username}@example.com",
            phone=phone,
            is_staff=is_staff,
        )
        wallet = Wallet.objects.get(user=user)
        wallet.balance = Decimal("1000.00")
        wallet.save()
        return user

    def tearDown(self):
        self.media_override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)
        super().tearDown()

    def create_group(
        self,
        mode="sharing",
        total_slots=2,
        status="forming",
        access_identifier="",
        access_password="",
        access_notes="",
        price_per_slot=Decimal("200.00"),
        start_date=None,
        end_date=None,
    ):
        group = Group.objects.create(
            owner=self.owner,
            subscription=self.subscription,
            total_slots=total_slots,
            price_per_slot=price_per_slot,
            start_date=start_date or date.today(),
            end_date=end_date or (date.today() + timedelta(days=29)),
            mode=mode,
            status=status,
        )
        if mode == "sharing" and access_identifier and access_password:
            group.set_access_credentials(access_identifier, access_password, access_notes)
            group.save(update_fields=["access_identifier", "access_password", "access_notes"])
        return group

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def submit_purchase_proof(self, group, reference="ORDER-001", notes="Bought from the creator account."):
        self.authenticate(self.owner)
        with patch(
            "django.core.files.storage.filesystem.FileSystemStorage._save",
            return_value="purchase-proofs/proof.txt",
        ):
            return self.client.post(
                f"/api/my-groups/{group.id}/submit-proof/",
                {
                    "purchase_reference": reference,
                    "purchase_notes": notes,
                    "purchase_proof": SimpleUploadedFile(
                        "proof.txt",
                        b"invoice proof",
                        content_type="text/plain",
                    ),
                },
                format="multipart",
            )

    def confirm_group_access(self, group, user):
        self.authenticate(user)
        return self.client.post(
            f"/api/groups/{group.id}/confirm-access/",
            format="json",
        )

    def report_access_issue(self, group, user, details="I did not receive access yet."):
        self.authenticate(user)
        return self.client.post(
            f"/api/groups/{group.id}/report-access-issue/",
            {"details": details},
            format="json",
        )

    def submit_review(self, group, user, reviewed_user, rating=5, comment="Very smooth group experience."):
        self.authenticate(user)
        return self.client.post(
            f"/api/groups/{group.id}/reviews/",
            {
                "reviewed_user_id": reviewed_user.id,
                "rating": rating,
                "comment": comment,
            },
            format="json",
        )

    def get_group_chat(self, group, user):
        self.authenticate(user)
        return self.client.get(f"/api/groups/{group.id}/chat/")

    def update_group_chat_presence(self, group, user, is_typing):
        self.authenticate(user)
        return self.client.patch(
            f"/api/groups/{group.id}/chat/",
            {"is_typing": is_typing},
            format="json",
        )

    def get_chat_inbox(self, user):
        self.authenticate(user)
        return self.client.get("/api/group-chats/")

    def get_notifications(self, user):
        self.authenticate(user)
        return self.client.get("/api/notifications/")

    def mark_notification_read(self, user, notification_id):
        self.authenticate(user)
        return self.client.post(f"/api/notifications/{notification_id}/read/", format="json")

    def mark_all_notifications_read(self, user):
        self.authenticate(user)
        return self.client.post("/api/notifications/mark-all-read/", format="json")

    def send_group_chat(self, group, user, message="Hello everyone"):
        self.authenticate(user)
        return self.client.post(
            f"/api/groups/{group.id}/chat/",
            {"message": message},
            format="json",
        )

    def save_bank_payout_account(self, user=None):
        self.authenticate(user or self.owner)
        with patch("core.views.create_razorpayx_contact") as contact_mock, patch(
            "core.views.create_razorpayx_bank_fund_account"
        ) as fund_account_mock:
            contact_mock.return_value = {"id": "cont_test_123"}
            fund_account_mock.return_value = {"id": "fa_test_123"}
            return self.client.put(
                "/api/wallet/payout-account/",
                {
                    "account_type": "bank_account",
                    "contact_name": "Owner Account",
                    "contact_email": "owner@example.com",
                    "contact_phone": "9000000001",
                    "bank_account_holder_name": "Owner Account",
                    "bank_account_number": "123456789012",
                    "confirm_bank_account_number": "123456789012",
                    "bank_account_ifsc": "HDFC0001234",
                },
                format="json",
            )

    def save_vpa_payout_account(self, user=None):
        self.authenticate(user or self.owner)
        with patch("core.views.create_razorpayx_contact") as contact_mock, patch(
            "core.views.create_razorpayx_vpa_fund_account"
        ) as fund_account_mock:
            contact_mock.return_value = {"id": "cont_test_123"}
            fund_account_mock.return_value = {"id": "fa_vpa_test_123"}
            return self.client.put(
                "/api/wallet/payout-account/",
                {
                    "account_type": "vpa",
                    "contact_name": "Owner Account",
                    "contact_email": "owner@example.com",
                    "contact_phone": "9000000001",
                    "vpa_address": "owner@upi",
                },
                format="json",
            )

    def create_local_bank_payout_account(self, user=None):
        payout_user = user or self.owner
        payout_account = PayoutAccount(
            user=payout_user,
            account_type="bank_account",
            contact_name="Owner Account",
            contact_email=payout_user.email,
            contact_phone=payout_user.phone or "",
            bank_account_holder_name="Owner Account",
            bank_account_ifsc="HDFC0001234",
            is_active=True,
        )
        payout_account.set_bank_account_number("123456789012")
        payout_account.save()
        return payout_account

    def test_signup_username_availability_endpoint_reports_existing_and_new_usernames(self):
        self.create_user("takenuser", "9111111119")

        taken_response = self.client.post(
            "/api/signup/check-availability/",
            {"username": "takenuser"},
            format="json",
        )
        available_response = self.client.post(
            "/api/signup/check-availability/",
            {"username": "freshuser"},
            format="json",
        )

        self.assertEqual(taken_response.status_code, status.HTTP_200_OK)
        self.assertFalse(taken_response.data["available"])
        self.assertEqual(taken_response.data["message"], "This username is already in use.")

        self.assertEqual(available_response.status_code, status.HTTP_200_OK)
        self.assertTrue(available_response.data["available"])
        self.assertEqual(available_response.data["message"], "Username is available.")

    def test_user_can_save_local_payout_account_when_payout_provider_is_unconfigured(self):
        self.authenticate(self.owner)
        response = self.client.put(
            "/api/wallet/payout-account/",
            {
                "account_type": "bank_account",
                "contact_name": "Owner Account",
                "contact_email": "owner@example.com",
                "contact_phone": "9000000001",
                "bank_account_holder_name": "Owner Account",
                "bank_account_number": "123456789012",
                "confirm_bank_account_number": "123456789012",
                "bank_account_ifsc": "HDFC0001234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["message"],
            "Withdrawal destination saved for manual review requests.",
        )
        payout_account = PayoutAccount.objects.get(user=self.owner)
        self.assertEqual(payout_account.provider_contact_id, "")
        self.assertEqual(payout_account.provider_fund_account_id, "")
        self.assertEqual(payout_account.bank_account_last4, "9012")
        self.assertIsNone(payout_account.last_synced_at)

    def test_signup_accepts_name_fields_after_otp_verification(self):
        request_response = self.client.post(
            "/api/signup/request-otp/",
            {
                "username": "newuser",
                "email": "newuser@example.com",
                "phone": "9111111111",
            },
            format="json",
        )

        self.assertEqual(request_response.status_code, status.HTTP_200_OK)
        self.assertIn("signup_session_id", request_response.data)
        self.assertIn("dev_otp", request_response.data)
        self.assertEqual(SignupOTP.objects.count(), 1)

        response = self.client.post(
            "/api/signup/",
            {
                "username": "newuser",
                "first_name": "New",
                "last_name": "Member",
                "email": "newuser@example.com",
                "phone": "9111111111",
                "password": "password123",
                "signup_session_id": request_response.data["signup_session_id"],
                "otp": request_response.data["dev_otp"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username="newuser")
        self.assertEqual(created_user.first_name, "New")
        self.assertEqual(created_user.last_name, "Member")
        self.assertTrue(created_user.is_verified)

    def test_signup_rejects_invalid_otp(self):
        request_response = self.client.post(
            "/api/signup/request-otp/",
            {
                "username": "otpuser",
                "email": "otpuser@example.com",
            },
            format="json",
        )

        self.assertEqual(request_response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            "/api/signup/",
            {
                "username": "otpuser",
                "email": "otpuser@example.com",
                "password": "password123",
                "signup_session_id": request_response.data["signup_session_id"],
                "otp": "000000",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["attempts_remaining"], 4)
        self.assertFalse(User.objects.filter(username="otpuser").exists())

    @patch("core.auth_views.verify_google_id_token")
    def test_google_auth_creates_verified_user_and_returns_tokens(self, verify_google_id_token_mock):
        verify_google_id_token_mock.return_value = {
            "iss": "accounts.google.com",
            "sub": "google-sub-1",
            "email": "google-user@example.com",
            "email_verified": True,
            "given_name": "Google",
            "family_name": "Member",
            "name": "Google Member",
        }

        response = self.client.post(
            "/api/auth/google/",
            {"credential": "google-id-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["created"])
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["email"], "google-user@example.com")
        self.assertIn("sv_refresh_token", response.cookies)
        self.assertTrue(response.cookies["sv_refresh_token"]["httponly"])

        created_user = User.objects.get(email="google-user@example.com")
        self.assertTrue(created_user.is_verified)
        self.assertEqual(created_user.first_name, "Google")
        self.assertEqual(created_user.last_name, "Member")
        self.assertFalse(created_user.has_usable_password())

    @patch("core.auth_views.verify_google_id_token")
    def test_google_auth_logs_in_existing_user_with_same_email(self, verify_google_id_token_mock):
        existing_user = User.objects.create_user(
            username="existinggoogle",
            password="password123",
            email="google-existing@example.com",
            first_name="",
            last_name="",
            is_verified=False,
        )

        verify_google_id_token_mock.return_value = {
            "iss": "accounts.google.com",
            "sub": "google-sub-2",
            "email": "google-existing@example.com",
            "email_verified": True,
            "given_name": "Existing",
            "family_name": "Member",
            "name": "Existing Member",
        }

        response = self.client.post(
            "/api/auth/google/",
            {"credential": "google-id-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["created"])
        existing_user.refresh_from_db()
        self.assertEqual(existing_user.first_name, "Existing")
        self.assertEqual(existing_user.last_name, "Member")
        self.assertTrue(existing_user.is_verified)
        self.assertEqual(response.data["user"]["username"], existing_user.username)
        self.assertIn("sv_refresh_token", response.cookies)

    def test_login_sets_refresh_cookie_and_refresh_endpoint_restores_access(self):
        login_response = self.client.post(
            "/api/login/",
            {
                "username": self.owner.username,
                "password": "password123",
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", login_response.data)
        self.assertNotIn("refresh", login_response.data)
        self.assertIn("sv_refresh_token", login_response.cookies)
        self.assertTrue(login_response.cookies["sv_refresh_token"]["httponly"])
        issued_access_token = AccessToken(login_response.data["access"])
        self.assertEqual(
            issued_access_token["exp"] - issued_access_token["iat"],
            int(api_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
        )

        original_refresh_token = login_response.cookies["sv_refresh_token"].value

        self.client.cookies["sv_refresh_token"] = original_refresh_token
        refresh_response = self.client.post("/api/auth/refresh/", format="json")

        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_response.data)
        self.assertEqual(refresh_response.data["user"]["username"], self.owner.username)
        self.assertIn("sv_refresh_token", refresh_response.cookies)

        rotated_refresh_token = refresh_response.cookies["sv_refresh_token"].value
        self.assertNotEqual(rotated_refresh_token, original_refresh_token)
        self.assertTrue(
            BlacklistedToken.objects.filter(
                token__jti=RefreshToken(original_refresh_token, verify=False)["jti"]
            ).exists()
        )
        self.assertTrue(
            OutstandingToken.objects.filter(
                user=self.owner,
                jti=RefreshToken(rotated_refresh_token)["jti"],
            ).exists()
        )

    def test_login_cors_preflight_allows_credentials(self):
        response = self.client.options(
            "/api/login/",
            HTTP_ORIGIN="http://localhost:3000",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Access-Control-Allow-Origin"], "http://localhost:3000")
        self.assertEqual(response["Access-Control-Allow-Credentials"], "true")

    def test_login_response_includes_cors_credentials_header(self):
        response = self.client.post(
            "/api/login/",
            {
                "username": self.owner.username,
                "password": "password123",
            },
            format="json",
            HTTP_ORIGIN="http://localhost:3000",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Access-Control-Allow-Origin"], "http://localhost:3000")
        self.assertEqual(response["Access-Control-Allow-Credentials"], "true")

    def test_login_accepts_email_identifier(self):
        response = self.client.post(
            "/api/login/",
            {
                "username": self.owner.email.upper(),
                "password": "password123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], self.owner.username)
        self.assertIn("sv_refresh_token", response.cookies)

    @patch("core.rate_limit.cache.delete_many", side_effect=RuntimeError("cache unavailable"))
    @patch("core.rate_limit.cache.get", side_effect=RuntimeError("cache unavailable"))
    def test_login_succeeds_when_rate_limit_cache_is_unavailable(self, cache_get_mock, cache_delete_many_mock):
        response = self.client.post(
            "/api/login/",
            {
                "username": self.owner.username,
                "password": "password123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], self.owner.username)

    def test_logout_clears_refresh_cookie(self):
        login_response = self.client.post(
            "/api/login/",
            {
                "username": self.owner.username,
                "password": "password123",
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        refresh_token = login_response.cookies["sv_refresh_token"].value
        self.client.cookies["sv_refresh_token"] = refresh_token

        logout_response = self.client.post("/api/auth/logout/", format="json")

        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        self.assertIn("sv_refresh_token", logout_response.cookies)
        self.assertEqual(logout_response.cookies["sv_refresh_token"].value, "")
        self.assertTrue(
            BlacklistedToken.objects.filter(
                token__jti=RefreshToken(refresh_token, verify=False)["jti"]
            ).exists()
        )

        self.client.cookies["sv_refresh_token"] = refresh_token
        refresh_response = self.client.post("/api/auth/refresh/", format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("core.auth_views.verify_google_id_token", side_effect=ValueError("bad token"))
    def test_google_auth_rejects_invalid_credentials(self, verify_google_id_token_mock):
        response = self.client.post(
            "/api/auth/google/",
            {"credential": "invalid-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Google sign-in could not be verified.")
        verify_google_id_token_mock.assert_called_once()

    def test_create_group_rejects_end_date_before_start_date(self):
        self.authenticate(self.owner)
        response = self.client.post(
            "/api/create-group/",
            {
                "subscription_name": "Spotify",
                "mode": "sharing",
                "total_slots": 2,
                "price_per_slot": "199.00",
                "start_date": "2026-04-20",
                "end_date": "2026-04-19",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_date", response.data)

    def test_create_sharing_group_allows_empty_credentials(self):
        self.authenticate(self.owner)
        response = self.client.post(
            "/api/create-group/",
            {
                "subscription_name": "Spotify",
                "mode": "sharing",
                "total_slots": 2,
                "price_per_slot": "199.00",
                "start_date": "2026-04-12",
                "end_date": "2026-05-11",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group = Group.objects.get(id=response.data["group_id"])
        self.assertEqual(group.get_access_identifier(), "")
        self.assertEqual(group.get_access_password(), "")
        self.assertEqual(group.access_notes, "")

    def test_create_group_persists_exact_start_and_end_dates(self):
        self.authenticate(self.owner)
        response = self.client.post(
            "/api/create-group/",
            {
                "subscription_name": "Spotify",
                "mode": "sharing",
                "total_slots": 2,
                "price_per_slot": "199.00",
                "start_date": "2026-04-12",
                "end_date": "2026-05-11",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group = Group.objects.get(id=response.data["group_id"])
        self.assertEqual(group.start_date, date(2026, 4, 12))
        self.assertEqual(group.end_date, date(2026, 5, 11))

    def test_forgot_password_reset_with_otp_flow(self):
        login_response = self.client.post(
            "/api/login/",
            {
                "username": self.owner.username,
                "password": "password123",
            },
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        original_access_token = login_response.data["access"]
        original_refresh_token = login_response.cookies["sv_refresh_token"].value

        request_otp_response = self.client.post(
            "/api/forgot-password/request-otp/",
            {
                "username": self.owner.username,
                "phone": self.owner.phone,
            },
            format="json",
        )

        self.assertEqual(request_otp_response.status_code, status.HTTP_200_OK)
        self.assertIn("reset_session_id", request_otp_response.data)
        self.assertIn("dev_otp", request_otp_response.data)

        confirm_response = self.client.post(
            "/api/forgot-password/confirm-otp/",
            {
                "username": self.owner.username,
                "reset_session_id": request_otp_response.data["reset_session_id"],
                "otp": request_otp_response.data["dev_otp"],
                "new_password": "newpass123",
            },
            format="json",
        )

        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password("newpass123"))
        self.assertTrue(
            BlacklistedToken.objects.filter(
                token__jti=RefreshToken(original_refresh_token, verify=False)["jti"]
            ).exists()
        )

        login_response = self.client.post(
            "/api/login/",
            {
                "username": self.owner.username,
                "password": "newpass123",
            },
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", login_response.data)

        old_access_response = self.client.get(
            "/api/profile/",
            HTTP_AUTHORIZATION=f"Bearer {original_access_token}",
        )
        self.assertEqual(old_access_response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.cookies["sv_refresh_token"] = original_refresh_token
        old_refresh_response = self.client.post("/api/auth/refresh/", format="json")
        self.assertEqual(old_refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("sv_refresh_token", old_refresh_response.cookies)
        self.assertEqual(old_refresh_response.cookies["sv_refresh_token"].value, "")

    def test_forgot_password_accepts_email_identifier(self):
        request_otp_response = self.client.post(
            "/api/forgot-password/request-otp/",
            {
                "username": self.owner.email.upper(),
                "email": self.owner.email.upper(),
            },
            format="json",
        )

        self.assertEqual(request_otp_response.status_code, status.HTTP_200_OK)
        self.assertIn("reset_session_id", request_otp_response.data)
        self.assertIn("dev_otp", request_otp_response.data)

        confirm_response = self.client.post(
            "/api/forgot-password/confirm-otp/",
            {
                "username": self.owner.email.upper(),
                "reset_session_id": request_otp_response.data["reset_session_id"],
                "otp": request_otp_response.data["dev_otp"],
                "new_password": "emailpass123",
            },
            format="json",
        )

        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password("emailpass123"))

    def test_login_is_rate_limited_after_repeated_failures(self):
        with patch("core.auth_views.LOGIN_FAILED_ATTEMPT_LIMIT", 2), patch(
            "core.auth_views.LOGIN_FAILED_ATTEMPT_WINDOW_SECONDS", 120
        ):
            first_attempt = self.client.post(
                "/api/login/",
                {
                    "username": self.owner.username,
                    "password": "wrong-password",
                },
                format="json",
            )
            second_attempt = self.client.post(
                "/api/login/",
                {
                    "username": self.owner.username,
                    "password": "wrong-password",
                },
                format="json",
            )
            third_attempt = self.client.post(
                "/api/login/",
                {
                    "username": self.owner.username,
                    "password": "wrong-password",
                },
                format="json",
            )

        self.assertEqual(first_attempt.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(second_attempt.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(third_attempt.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("retry_after_seconds", third_attempt.data)

    def test_successful_login_clears_failed_login_rate_limit_state(self):
        with patch("core.auth_views.LOGIN_FAILED_ATTEMPT_LIMIT", 2), patch(
            "core.auth_views.LOGIN_FAILED_ATTEMPT_WINDOW_SECONDS", 120
        ):
            first_failed_attempt = self.client.post(
                "/api/login/",
                {
                    "username": self.owner.username,
                    "password": "wrong-password",
                },
                format="json",
            )
            successful_attempt = self.client.post(
                "/api/login/",
                {
                    "username": self.owner.username,
                    "password": "password123",
                },
                format="json",
            )
            second_failed_attempt = self.client.post(
                "/api/login/",
                {
                    "username": self.owner.username,
                    "password": "wrong-password",
                },
                format="json",
            )
            third_failed_attempt = self.client.post(
                "/api/login/",
                {
                    "username": self.owner.username,
                    "password": "wrong-password",
                },
                format="json",
            )

        self.assertEqual(first_failed_attempt.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(successful_attempt.status_code, status.HTTP_200_OK)
        self.assertEqual(second_failed_attempt.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(third_failed_attempt.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_forgot_password_fails_with_wrong_verification_details(self):
        response = self.client.post(
            "/api/forgot-password/request-otp/",
            {
                "username": self.owner.username,
                "phone": "9999999999",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password("password123"))

    def test_forgot_password_reduces_attempts_on_invalid_otp(self):
        request_otp_response = self.client.post(
            "/api/forgot-password/request-otp/",
            {
                "username": self.owner.username,
                "phone": self.owner.phone,
            },
            format="json",
        )
        self.assertEqual(request_otp_response.status_code, status.HTTP_200_OK)

        wrong_otp_response = self.client.post(
            "/api/forgot-password/confirm-otp/",
            {
                "username": self.owner.username,
                "reset_session_id": request_otp_response.data["reset_session_id"],
                "otp": "000000",
                "new_password": "newpass123",
            },
            format="json",
        )

        self.assertEqual(wrong_otp_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(wrong_otp_response.data["attempts_remaining"], 4)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password("password123"))

    def test_forgot_password_request_otp_enforces_cooldown(self):
        first_response = self.client.post(
            "/api/forgot-password/request-otp/",
            {
                "username": self.owner.username,
                "phone": self.owner.phone,
            },
            format="json",
        )
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)

        second_response = self.client.post(
            "/api/forgot-password/request-otp/",
            {
                "username": self.owner.username,
                "phone": self.owner.phone,
            },
            format="json",
        )
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("retry_after_seconds", second_response.data)

    def test_forgot_password_lockout_after_repeated_invalid_otps(self):
        first_response = self.client.post(
            "/api/forgot-password/request-otp/",
            {
                "username": self.owner.username,
                "phone": self.owner.phone,
            },
            format="json",
        )
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)

        for _ in range(5):
            bad_attempt = self.client.post(
                "/api/forgot-password/confirm-otp/",
                {
                    "username": self.owner.username,
                    "reset_session_id": first_response.data["reset_session_id"],
                    "otp": "000000",
                    "new_password": "newpass123",
                },
                format="json",
            )
            self.assertIn(
                bad_attempt.status_code,
                {status.HTTP_400_BAD_REQUEST, status.HTTP_429_TOO_MANY_REQUESTS},
            )

        PasswordResetOTP.objects.filter(user=self.owner).update(
            created_at=timezone.now() - timedelta(minutes=2)
        )

        second_response = self.client.post(
            "/api/forgot-password/request-otp/",
            {
                "username": self.owner.username,
                "phone": self.owner.phone,
            },
            format="json",
        )
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)

        for _ in range(3):
            bad_attempt = self.client.post(
                "/api/forgot-password/confirm-otp/",
                {
                    "username": self.owner.username,
                    "reset_session_id": second_response.data["reset_session_id"],
                    "otp": "000000",
                    "new_password": "newpass123",
                },
                format="json",
            )
            if bad_attempt.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                break

        locked_response = self.client.post(
            "/api/forgot-password/request-otp/",
            {
                "username": self.owner.username,
                "phone": self.owner.phone,
            },
            format="json",
        )
        self.assertEqual(locked_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("retry_after_seconds", locked_response.data)

    def test_forgot_password_confirm_endpoint_rate_limited(self):
        request_otp_response = self.client.post(
            "/api/forgot-password/request-otp/",
            {
                "username": self.owner.username,
                "phone": self.owner.phone,
            },
            format="json",
        )
        self.assertEqual(request_otp_response.status_code, status.HTTP_200_OK)

        with patch("core.auth_views.PASSWORD_RESET_OTP_CONFIRM_RATE_LIMIT", 2), patch(
            "core.auth_views.PASSWORD_RESET_OTP_CONFIRM_RATE_WINDOW_SECONDS", 120
        ):
            first_attempt = self.client.post(
                "/api/forgot-password/confirm-otp/",
                {
                    "username": self.owner.username,
                    "reset_session_id": request_otp_response.data["reset_session_id"],
                    "otp": "000000",
                    "new_password": "newpass123",
                },
                format="json",
            )
            second_attempt = self.client.post(
                "/api/forgot-password/confirm-otp/",
                {
                    "username": self.owner.username,
                    "reset_session_id": request_otp_response.data["reset_session_id"],
                    "otp": "000000",
                    "new_password": "newpass123",
                },
                format="json",
            )
            third_attempt = self.client.post(
                "/api/forgot-password/confirm-otp/",
                {
                    "username": self.owner.username,
                    "reset_session_id": request_otp_response.data["reset_session_id"],
                    "otp": "000000",
                    "new_password": "newpass123",
                },
                format="json",
            )

        self.assertEqual(first_attempt.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second_attempt.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(third_attempt.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("retry_after_seconds", third_attempt.data)

    def test_joining_sharing_group_does_not_reveal_credentials_to_member(self):
        group = self.create_group(
            mode="sharing",
            total_slots=2,
            access_identifier="owner@sharedmail.com",
            access_password="sub-pass-123",
            access_notes="Use the Kids profile only.",
        )
        owner_wallet = Wallet.objects.get(user=self.owner)
        member_wallet = Wallet.objects.get(user=self.member_one)

        self.authenticate(self.member_one)
        response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["credentials"]["available"])
        self.assertFalse(response.data["credentials"]["requires_one_time_reveal"])
        self.assertEqual(
            response.data["credentials"]["message"],
            "Access is coordinated privately by the group owner.",
        )

        group.refresh_from_db()
        owner_wallet.refresh_from_db()
        member_wallet.refresh_from_db()
        member = GroupMember.objects.get(group=group, user=self.member_one)

        self.assertEqual(group.status, "collecting")
        self.assertEqual(member_wallet.balance, Decimal("790.00"))
        self.assertEqual(owner_wallet.balance, Decimal("1000.00"))
        self.assertTrue(member.has_paid)
        self.assertEqual(member.escrow_status, "held")
        self.assertFalse(member.access_confirmed)
        self.assertTrue(group.access_identifier.startswith("enc::"))
        self.assertTrue(group.access_password.startswith("enc::"))
        self.assertEqual(group.get_access_identifier(), "owner@sharedmail.com")
        self.assertEqual(group.get_access_password(), "sub-pass-123")

        member_token_response = self.client.post(
            "/api/credentials/request-reveal/",
            {"group_id": group.id},
            format="json",
        )
        self.assertEqual(member_token_response.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate(self.owner)
        owner_token_response = self.client.post(
            "/api/credentials/request-reveal/",
            {"group_id": group.id},
            format="json",
        )
        self.assertEqual(owner_token_response.status_code, status.HTTP_200_OK)
        self.assertIn("reveal_token", owner_token_response.data)

        reveal_response = self.client.post(
            "/api/credentials/reveal/",
            {"reveal_token": owner_token_response.data["reveal_token"]},
            format="json",
        )
        self.assertEqual(reveal_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            reveal_response.data["credentials"]["login_identifier"],
            "owner@sharedmail.com",
        )
        self.assertEqual(reveal_response.data["credentials"]["password"], "sub-pass-123")

        reused_token_response = self.client.post(
            "/api/credentials/reveal/",
            {"reveal_token": owner_token_response.data["reveal_token"]},
            format="json",
        )
        self.assertEqual(reused_token_response.status_code, status.HTTP_400_BAD_REQUEST)

        self.assertTrue(GroupMember.objects.filter(group=group, user=self.member_one).exists())
        self.assertFalse(
            Transaction.objects.filter(
                user=self.owner,
                group=group,
                payment_method="group_share_payout",
                amount=Decimal("200.00"),
            ).exists()
        )

    def test_dashboard_returns_safe_access_coordination_message_for_joined_sharing_group(self):
        group = self.create_group(
            mode="sharing",
            total_slots=2,
            status="active",
            access_identifier="shared-login@example.com",
            access_password="stream-pass",
            access_notes="PIN is 4321.",
        )
        GroupMember.objects.create(
            group=group,
            user=self.member_one,
            has_paid=True,
            charged_amount=Decimal("210.00"),
            platform_fee_amount=Decimal("10.00"),
            escrow_status="held",
        )

        self.authenticate(self.member_one)
        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["groups"]), 1)
        self.assertTrue(response.data["groups"][0]["access_confirmation_required"])
        credentials = response.data["groups"][0]["credentials"]
        self.assertFalse(credentials["available"])
        self.assertFalse(credentials["requires_one_time_reveal"])
        self.assertEqual(
            credentials["message"],
            "Access is coordinated privately by the group owner.",
        )

    def test_confirming_access_for_sharing_group_releases_creator_payout(self):
        group = self.create_group(
            mode="sharing",
            total_slots=2,
            status="forming",
        )
        owner_wallet = Wallet.objects.get(user=self.owner)

        self.authenticate(self.member_one)
        join_response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")
        self.assertEqual(join_response.status_code, status.HTTP_200_OK)

        confirm_response = self.client.post(f"/api/groups/{group.id}/confirm-access/", format="json")
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.assertEqual(confirm_response.data["message"], "Access confirmed. The host payout has been released.")

        group.refresh_from_db()
        owner_wallet.refresh_from_db()
        member = GroupMember.objects.get(group=group, user=self.member_one)

        self.assertEqual(group.status, "active")
        self.assertTrue(member.access_confirmed)
        self.assertEqual(member.escrow_status, "released")
        self.assertEqual(owner_wallet.balance, Decimal("1190.00"))
        self.assertTrue(
            Transaction.objects.filter(
                user=self.owner,
                group=group,
                payment_method="group_share_payout",
                amount=Decimal("190.00"),
            ).exists()
        )

    def test_late_joining_sharing_group_charges_only_for_remaining_days(self):
        group = self.create_group(
            mode="sharing",
            total_slots=3,
            status="active",
            price_per_slot=Decimal("300.00"),
            start_date=date.today() - timedelta(days=20),
            end_date=date.today() + timedelta(days=9),
        )
        owner_wallet = Wallet.objects.get(user=self.owner)
        member_wallet = Wallet.objects.get(user=self.member_one)

        self.authenticate(self.member_one)
        response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["charged_amount"], "105.00")
        self.assertEqual(response.data["join_subtotal"], "100.00")
        self.assertEqual(response.data["platform_fee_amount"], "5.00")
        self.assertTrue(response.data["is_prorated"])
        self.assertEqual(response.data["remaining_cycle_days"], 10)
        self.assertEqual(response.data["total_cycle_days"], 30)

        owner_wallet.refresh_from_db()
        member_wallet.refresh_from_db()
        member = GroupMember.objects.get(group=group, user=self.member_one)

        self.assertEqual(member.charged_amount, Decimal("105.00"))
        self.assertEqual(member.platform_fee_amount, Decimal("5.00"))
        self.assertEqual(member_wallet.balance, Decimal("895.00"))
        self.assertEqual(owner_wallet.balance, Decimal("1000.00"))
        self.assertEqual(member.escrow_status, "held")
        self.assertTrue(
            Transaction.objects.filter(
                user=self.member_one,
                group=group,
                payment_method="wallet",
                amount=Decimal("105.00"),
            ).exists()
        )
        self.assertFalse(
            Transaction.objects.filter(
                user=self.owner,
                group=group,
                payment_method="group_share_payout",
                amount=Decimal("100.00"),
            ).exists()
        )

    def test_groups_list_exposes_prorated_join_price_for_late_sharing_group(self):
        group = self.create_group(
            mode="sharing",
            total_slots=3,
            status="active",
            price_per_slot=Decimal("300.00"),
            start_date=date.today() - timedelta(days=20),
            end_date=date.today() + timedelta(days=9),
        )

        self.authenticate(self.member_one)
        response = self.client.get("/api/groups/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = next(item for item in response.data if item["id"] == group.id)
        self.assertEqual(payload["price_per_slot"], "300.00")
        self.assertEqual(payload["join_price"], "105.00")
        self.assertEqual(payload["join_subtotal"], "100.00")
        self.assertEqual(payload["platform_fee_amount"], "5.00")
        self.assertTrue(payload["is_prorated"])
        self.assertEqual(payload["remaining_cycle_days"], 10)
        self.assertEqual(payload["total_cycle_days"], 30)
        self.assertIn("remaining 10 of 30 days", payload["pricing_note"])

    def test_joined_member_can_view_and_send_group_chat_messages(self):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        first_message = self.send_group_chat(group, self.member_one, "Hi, I just joined.")
        self.assertEqual(first_message.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first_message.data["chat_message"]["sender_username"], self.member_one.username)
        self.assertEqual(first_message.data["chat_message"]["message"], "Hi, I just joined.")
        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                message__contains="New group chat message",
            ).exists()
        )

        owner_message = self.send_group_chat(group, self.owner, "Welcome to the group chat.")
        self.assertEqual(owner_message.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.member_one,
                message__contains="New group chat message",
            ).exists()
        )

        response = self.get_group_chat(group, self.member_one)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["group"]["id"], group.id)
        self.assertEqual(response.data["group"]["subscription_name"], self.subscription.name)
        self.assertEqual(len(response.data["messages"]), 2)
        self.assertEqual(response.data["messages"][0]["message"], "Hi, I just joined.")
        self.assertEqual(response.data["messages"][1]["message"], "Welcome to the group chat.")
        self.assertEqual(response.data["unread_chat_count"], 0)
        self.assertTrue(any(participant["username"] == self.owner.username for participant in response.data["participants"]))
        self.assertTrue(any(participant["username"] == self.member_one.username for participant in response.data["participants"]))
        self.assertTrue(
            GroupChatReadState.objects.filter(group=group, user=self.member_one).exists()
        )

    def test_non_member_cannot_access_group_chat(self):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_group_chat(group, self.outsider)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        send_response = self.send_group_chat(group, self.outsider, "Let me in")
        self.assertEqual(send_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_group_chat_presence_patch_updates_typing_state(self):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.update_group_chat_presence(group, self.member_one, True)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        presence = GroupChatPresence.objects.get(group=group, user=self.member_one)
        self.assertTrue(presence.is_typing)
        self.assertEqual(response.data["presence"]["status"], "online")
        self.assertTrue(response.data["presence"]["is_typing"])

    def test_group_chat_detail_includes_participant_presence_metadata(self):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        self.send_group_chat(group, self.owner, "Checking in.")

        GroupChatPresence.objects.update_or_create(
            group=group,
            user=self.owner,
            defaults={
                "last_seen_at": timezone.now(),
                "is_typing": True,
                "typing_updated_at": timezone.now(),
            },
        )

        response = self.get_group_chat(group, self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        owner_participant = next(
            participant for participant in response.data["participants"] if participant["username"] == self.owner.username
        )
        viewer_participant = next(
            participant for participant in response.data["participants"] if participant["username"] == self.member_one.username
        )
        self.assertEqual(owner_participant["presence"]["status"], "online")
        self.assertTrue(owner_participant["presence"]["is_typing"])
        self.assertEqual(viewer_participant["presence"]["status"], "online")
        self.assertFalse(viewer_participant["presence"]["is_typing"])
        self.assertEqual(response.data["online_participant_count"], 2)
        self.assertEqual(response.data["active_typing_users"], [self.owner.username])

    def test_group_chat_inbox_includes_presence_and_typing_metadata(self):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        self.send_group_chat(group, self.owner, "Reply when you can.")

        GroupChatPresence.objects.update_or_create(
            group=group,
            user=self.owner,
            defaults={
                "last_seen_at": timezone.now(),
                "is_typing": True,
                "typing_updated_at": timezone.now(),
            },
        )
        GroupChatPresence.objects.update_or_create(
            group=group,
            user=self.member_one,
            defaults={
                "last_seen_at": timezone.now() - timedelta(minutes=12),
                "is_typing": False,
                "typing_updated_at": timezone.now() - timedelta(minutes=12),
            },
        )

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        chat_item = response.data["chats"][0]
        self.assertEqual(chat_item["online_participant_count"], 1)
        self.assertEqual(chat_item["active_typing_users"], [self.owner.username])
        owner_preview = next(item for item in chat_item["participant_preview"] if item["username"] == self.owner.username)
        self.assertEqual(owner_preview["presence"]["status"], "online")
        self.assertTrue(owner_preview["presence"]["is_typing"])

    @patch("core.views.GroupChatPresence.objects.filter", side_effect=DatabaseError("presence unavailable"))
    def test_group_chat_detail_handles_presence_table_failures(self, _presence_filter_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        self.send_group_chat(group, self.owner, "Still available.")

        response = self.get_group_chat(group, self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["group"]["id"], group.id)
        self.assertEqual(response.data["online_participant_count"], 0)
        self.assertEqual(response.data["active_typing_users"], [])

    @patch("core.views.GroupChatMessage.objects.filter", side_effect=DatabaseError("messages unavailable"))
    def test_group_chat_detail_handles_message_table_failures(self, _message_filter_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_group_chat(group, self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["group"]["id"], group.id)
        self.assertEqual(response.data["messages"], [])

    @patch("core.views.log_operation_event")
    @patch("core.views.GroupChatMessage.objects.filter", side_effect=DatabaseError("messages unavailable"))
    def test_group_chat_detail_logs_message_table_failures(self, _message_filter_mock, log_operation_event_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_group_chat(group, self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log_operation_event_mock.assert_called_once_with(
            "group_chat_detail_messages_load_failed",
            level="error",
            endpoint="group_chat_detail",
            stage="messages_load",
            user_id=self.member_one.id,
            group_id=group.id,
            exception_type="DatabaseError",
            exception_message="messages unavailable",
        )

    @patch("core.views.build_group_chat_activity_snapshot", side_effect=RuntimeError("snapshot unavailable"))
    def test_group_chat_detail_handles_unexpected_snapshot_failures(self, _snapshot_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_group_chat(group, self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["group"]["id"], group.id)
        self.assertEqual(response.data["online_participant_count"], 0)
        self.assertEqual(response.data["active_typing_users"], [])

    @patch("core.views.get_status_copy", side_effect=RuntimeError("status unavailable"))
    def test_group_chat_detail_handles_group_label_failures(self, _status_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_group_chat(group, self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["group"]["id"], group.id)
        self.assertTrue(response.data["group"]["status_label"])

    @patch("core.views.build_safe_group_chat_group_payload", side_effect=RuntimeError("payload unavailable"))
    def test_group_chat_detail_handles_top_level_failures(self, _payload_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_group_chat(group, self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["messages"], [])
        self.assertEqual(response.data["active_typing_users"], [])

    @patch("core.views.GroupChatView.get", side_effect=RuntimeError("view exploded"))
    def test_group_chat_detail_dispatch_catches_uncaught_failures(self, _get_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_group_chat(group, self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["group"]["id"], group.id)
        self.assertEqual(response.data["messages"], [])

    @patch("core.views.log_operation_event")
    @patch("core.views.GroupChatView.get", side_effect=RuntimeError("view exploded"))
    def test_group_chat_detail_dispatch_logs_uncaught_failures(self, _get_mock, log_operation_event_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_group_chat(group, self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log_operation_event_mock.assert_called_once_with(
            "group_chat_detail_dispatch_failed",
            level="error",
            endpoint="group_chat_detail",
            stage="dispatch",
            user_id=self.member_one.id,
            group_id=group.id,
            exception_type="RuntimeError",
            exception_message="view exploded",
        )

    @patch("core.views.GroupChatPresence.objects.filter", side_effect=DatabaseError("presence unavailable"))
    def test_group_chat_inbox_handles_presence_table_failures(self, _presence_filter_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        self.send_group_chat(group, self.owner, "Inbox should still load.")

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_chats"], 1)
        self.assertEqual(response.data["chats"][0]["online_participant_count"], 0)
        self.assertEqual(response.data["chats"][0]["active_typing_users"], [])

    @patch("core.views.log_operation_event")
    @patch("core.views.GroupChatPresence.objects.filter", side_effect=DatabaseError("presence unavailable"))
    def test_group_chat_inbox_logs_presence_table_failures(self, _presence_filter_mock, log_operation_event_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        self.send_group_chat(group, self.owner, "Inbox should still load.")

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log_operation_event_mock.assert_called_once_with(
            "group_chat_inbox_presence_load_failed",
            level="error",
            endpoint="group_chat_inbox",
            stage="presence_load",
            user_id=self.member_one.id,
            group_id=None,
            exception_type="DatabaseError",
            exception_message="presence unavailable",
        )

    @patch("core.views.GroupChatMessage.objects.filter", side_effect=DatabaseError("messages unavailable"))
    def test_group_chat_inbox_handles_message_table_failures(self, _message_filter_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_chats"], 1)
        self.assertEqual(response.data["chats"][0]["message_count"], 0)
        self.assertIsNone(response.data["chats"][0]["last_message"])

    @patch("core.views.build_group_chat_activity_snapshot", side_effect=RuntimeError("snapshot unavailable"))
    def test_group_chat_inbox_handles_unexpected_snapshot_failures(self, _snapshot_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_chats"], 1)
        self.assertEqual(response.data["chats"][0]["online_participant_count"], 0)
        self.assertEqual(response.data["chats"][0]["active_typing_users"], [])

    @patch("core.views.get_status_copy", side_effect=RuntimeError("status unavailable"))
    def test_group_chat_inbox_handles_group_label_failures(self, _status_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_chats"], 1)
        self.assertTrue(response.data["chats"][0]["group"]["status_label"])

    @patch("core.views.build_safe_group_chat_group_payload", side_effect=RuntimeError("payload unavailable"))
    def test_group_chat_inbox_handles_top_level_failures(self, _payload_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_chats"], 1)
        self.assertEqual(response.data["chats"][0]["group"]["status_label"], "Unavailable right now")

    @patch("core.views.GroupChatInboxView.get", side_effect=RuntimeError("view exploded"))
    def test_group_chat_inbox_dispatch_catches_uncaught_failures(self, _get_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_chats"], 0)
        self.assertEqual(response.data["chats"], [])

    @patch("core.views.log_operation_event")
    @patch("core.views.GroupChatInboxView.get", side_effect=RuntimeError("view exploded"))
    def test_group_chat_inbox_dispatch_logs_uncaught_failures(self, _get_mock, log_operation_event_mock):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log_operation_event_mock.assert_called_once_with(
            "group_chat_inbox_dispatch_failed",
            level="error",
            endpoint="group_chat_inbox",
            stage="dispatch",
            user_id=self.member_one.id,
            group_id=None,
            exception_type="RuntimeError",
            exception_message="view exploded",
        )

    @override_settings(
        RAZORPAYX_KEY_ID="rzp_test_x_123",
        RAZORPAYX_KEY_SECRET="secret_x_123",
        RAZORPAYX_SOURCE_ACCOUNT_NUMBER="2323230000001",
    )
    def test_user_can_save_bank_payout_account(self):
        response = self.save_bank_payout_account(self.owner)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        account = PayoutAccount.objects.get(user=self.owner)
        self.assertEqual(account.provider_contact_id, "cont_test_123")
        self.assertEqual(account.provider_fund_account_id, "fa_test_123")
        self.assertEqual(account.bank_account_holder_name, "Owner Account")
        self.assertEqual(account.bank_account_ifsc, "HDFC0001234")
        self.assertEqual(account.bank_account_last4, "9012")
        self.assertTrue(account.bank_account_number.startswith("enc::"))

    @override_settings(
        RAZORPAYX_KEY_ID="rzp_test_x_123",
        RAZORPAYX_KEY_SECRET="secret_x_123",
        RAZORPAYX_SOURCE_ACCOUNT_NUMBER="2323230000001",
    )
    def test_user_can_create_wallet_payout_request(self):
        self.save_bank_payout_account(self.owner)
        wallet = Wallet.objects.get(user=self.owner)

        self.authenticate(self.owner)
        with patch("core.views.create_razorpayx_payout") as payout_mock:
            payout_mock.return_value = {
                "id": "pout_test_123",
                "status": "pending",
                "fund_account_id": "fa_test_123",
                "fees": 0,
                "tax": 0,
            }
            response = self.client.post(
                "/api/withdraw-money/",
                {"amount": "250.00", "payout_mode": "IMPS"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("750.00"))
        payout = WalletPayout.objects.get(user=self.owner)
        self.assertEqual(payout.status, "pending")
        self.assertEqual(payout.provider_payout_id, "pout_test_123")
        self.assertEqual(payout.mode, "IMPS")
        self.assertEqual(payout.transaction.status, "pending")
        self.assertEqual(payout.transaction.payment_method, "wallet_payout")

    @override_settings(
        RAZORPAYX_KEY_ID="rzp_test_x_123",
        RAZORPAYX_KEY_SECRET="secret_x_123",
        RAZORPAYX_SOURCE_ACCOUNT_NUMBER="2323230000001",
    )
    def test_failed_wallet_payout_returns_money_to_wallet(self):
        self.save_bank_payout_account(self.owner)
        wallet = Wallet.objects.get(user=self.owner)

        self.authenticate(self.owner)
        with patch("core.views.create_razorpayx_payout", side_effect=PaymentGatewayError("Payout gateway unavailable")):
            response = self.client.post(
                "/api/withdraw-money/",
                {"amount": "250.00", "payout_mode": "IMPS"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1000.00"))
        payout = WalletPayout.objects.get(user=self.owner)
        self.assertEqual(payout.status, "failed")
        self.assertIsNotNone(payout.wallet_restored_at)
        self.assertEqual(payout.transaction.status, "failed")
        self.assertIsNotNone(payout.refund_transaction)
        self.assertEqual(payout.refund_transaction.payment_method, "wallet_payout_reversal")

    @override_settings(
        RAZORPAYX_KEY_ID="rzp_test_x_123",
        RAZORPAYX_KEY_SECRET="secret_x_123",
        RAZORPAYX_SOURCE_ACCOUNT_NUMBER="2323230000001",
        RAZORPAYX_WEBHOOK_SECRET="payout_webhook_secret",
    )
    def test_wallet_payout_webhook_marks_payout_processed(self):
        self.save_bank_payout_account(self.owner)

        self.authenticate(self.owner)
        with patch("core.views.create_razorpayx_payout") as payout_mock:
            payout_mock.return_value = {
                "id": "pout_test_123",
                "status": "pending",
                "fund_account_id": "fa_test_123",
                "fees": 0,
                "tax": 0,
            }
            withdraw_response = self.client.post(
                "/api/withdraw-money/",
                {"amount": "250.00", "payout_mode": "IMPS"},
                format="json",
            )

        self.assertEqual(withdraw_response.status_code, status.HTTP_201_CREATED)

        payload = {
            "event": "payout.processed",
            "payload": {
                "payout": {
                    "entity": {
                        "id": "pout_test_123",
                        "reference_id": WalletPayout.objects.get(user=self.owner).provider_reference_id,
                        "status": "processed",
                        "fund_account_id": "fa_test_123",
                        "utr": "UTR123",
                        "fees": 100,
                        "tax": 18,
                    }
                }
            },
        }

        with patch("core.views.verify_razorpayx_webhook_signature", return_value=True):
            response = self.client.post(
                "/api/payments/razorpayx/webhook/",
                data=json.dumps(payload),
                content_type="application/json",
                HTTP_X_RAZORPAY_SIGNATURE="sig_test",
                HTTP_X_RAZORPAY_EVENT_ID="evt_payout_123",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payout = WalletPayout.objects.get(user=self.owner)
        self.assertEqual(payout.status, "processed")
        self.assertEqual(payout.transaction.status, "success")
        self.assertEqual(payout.utr, "UTR123")
        self.assertTrue(
            RazorpayXPayoutWebhookEvent.objects.filter(
                event_id="evt_payout_123",
                status="processed",
            ).exists()
        )

    @override_settings(
        RAZORPAYX_KEY_ID="rzp_test_x_123",
        RAZORPAYX_KEY_SECRET="secret_x_123",
        RAZORPAYX_SOURCE_ACCOUNT_NUMBER="2323230000001",
    )
    def test_user_cannot_withdraw_more_than_wallet_balance(self):
        wallet = Wallet.objects.get(user=self.owner)
        self.save_bank_payout_account(self.owner)

        self.authenticate(self.owner)
        response = self.client.post(
            "/api/withdraw-money/",
            {"amount": "1500.00", "payout_mode": "IMPS"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Insufficient wallet balance")
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1000.00"))

    def test_manual_wallet_payout_deducts_wallet_and_records_processed_transaction(self):
        payout_account = self.create_local_bank_payout_account(self.owner)
        wallet = Wallet.objects.get(user=self.owner)
        staff_user = self.create_user("staffadmin", "9000000005", is_staff=True)

        payout = create_manual_wallet_payout(
            user=self.owner,
            amount=Decimal("250.00"),
            payout_account=payout_account,
            created_by=staff_user,
            external_reference="UTR-MANUAL-123",
            admin_notes="Sent through bank transfer after support review.",
        )

        wallet.refresh_from_db()
        payout.refresh_from_db()

        self.assertEqual(wallet.balance, Decimal("750.00"))
        self.assertEqual(payout.provider, "manual")
        self.assertEqual(payout.status, "processed")
        self.assertEqual(payout.provider_status_source, "admin_manual")
        self.assertEqual(payout.utr, "UTR-MANUAL-123")
        self.assertEqual(payout.processed_by, staff_user)
        self.assertEqual(payout.wallet_balance_before, Decimal("1000.00"))
        self.assertEqual(payout.wallet_balance_after, Decimal("750.00"))
        self.assertEqual(payout.transaction.status, "success")
        self.assertEqual(payout.transaction.payment_method, "wallet_payout")
        self.assertEqual(
            payout.status_details["created_by_username"],
            staff_user.username,
        )
        self.assertEqual(payout.status_details["wallet_balance_before"], "1000.00")
        self.assertEqual(payout.status_details["wallet_balance_after"], "750.00")
        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                message__icontains="manual withdrawal",
            ).exists()
        )

    def test_user_can_create_manual_wallet_payout_request_when_provider_is_unconfigured(self):
        self.create_local_bank_payout_account(self.owner)
        wallet = Wallet.objects.get(user=self.owner)

        self.authenticate(self.owner)
        response = self.client.post(
            "/api/withdraw-money/",
            {"amount": "250.00", "payout_mode": "IMPS"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data["message"],
            "Withdrawal request submitted for manual review.",
        )
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1000.00"))
        payout = WalletPayout.objects.get(user=self.owner, provider="manual")
        self.assertEqual(payout.status, "pending")
        self.assertIsNone(payout.transaction)
        self.assertEqual(payout.provider_status_source, "user_manual_request")

    def test_manual_wallet_payout_can_process_existing_request(self):
        payout_account = self.create_local_bank_payout_account(self.owner)
        wallet = Wallet.objects.get(user=self.owner)
        staff_user = self.create_user("staffadmin", "9000000005", is_staff=True)
        pending_request = create_manual_wallet_payout_request(
            user=self.owner,
            amount=Decimal("250.00"),
            payout_account=payout_account,
            mode="IMPS",
        )

        processed_payout = create_manual_wallet_payout(
            user=self.owner,
            amount=pending_request.amount,
            payout_account=pending_request.payout_account,
            destination_label=pending_request.destination_label,
            mode=pending_request.mode,
            created_by=staff_user,
            external_reference="UTR-MANUAL-456",
            admin_notes="Approved after bank transfer.",
            wallet_payout=pending_request,
        )

        wallet.refresh_from_db()
        processed_payout.refresh_from_db()

        self.assertEqual(processed_payout.id, pending_request.id)
        self.assertEqual(wallet.balance, Decimal("750.00"))
        self.assertEqual(processed_payout.status, "processed")
        self.assertEqual(processed_payout.utr, "UTR-MANUAL-456")
        self.assertEqual(processed_payout.processed_by, staff_user)
        self.assertEqual(processed_payout.wallet_balance_before, Decimal("1000.00"))
        self.assertEqual(processed_payout.wallet_balance_after, Decimal("750.00"))
        self.assertEqual(processed_payout.status_details["requested_by_username"], self.owner.username)
        self.assertEqual(processed_payout.status_details["created_by_username"], staff_user.username)
        self.assertEqual(processed_payout.status_details["wallet_balance_before"], "1000.00")
        self.assertEqual(processed_payout.status_details["wallet_balance_after"], "750.00")
        self.assertIsNotNone(processed_payout.transaction)

    def test_admin_can_open_pending_manual_wallet_payout_change_page(self):
        payout_account = self.create_local_bank_payout_account(self.owner)
        admin_user = User.objects.create_superuser(
            username="superadmin",
            email="superadmin@example.com",
            password="password123",
        )
        pending_request = create_manual_wallet_payout_request(
            user=self.owner,
            amount=Decimal("25.00"),
            payout_account=payout_account,
            mode="IMPS",
        )

        logged_in = self.client.login(username=admin_user.username, password="password123")

        self.assertTrue(logged_in)
        response = self.client.get(f"/admin/core/walletpayout/{pending_request.id}/change/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "Process now")
        self.assertContains(response, "Status details")
        self.assertContains(response, "Destination details")
        self.assertContains(response, "123456789012")
        self.assertContains(response, "HDFC0001234")
        self.assertContains(response, f"/admin/core/payoutaccount/{payout_account.id}/change/")

    def test_admin_can_open_saved_payout_account_change_page(self):
        payout_account = self.create_local_bank_payout_account(self.owner)
        admin_user = User.objects.create_superuser(
            username="superadmin2",
            email="superadmin2@example.com",
            password="password123",
        )

        logged_in = self.client.login(username=admin_user.username, password="password123")

        self.assertTrue(logged_in)
        response = self.client.get(f"/admin/core/payoutaccount/{payout_account.id}/change/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "Full destination details")
        self.assertContains(response, "123456789012")
        self.assertContains(response, "HDFC0001234")

    def test_manual_wallet_payout_rejects_when_wallet_balance_is_too_low(self):
        payout_account = self.create_local_bank_payout_account(self.owner)
        wallet = Wallet.objects.get(user=self.owner)

        with self.assertRaises(ValidationError):
            create_manual_wallet_payout(
                user=self.owner,
                amount=Decimal("1500.00"),
                payout_account=payout_account,
                external_reference="UTR-TOO-HIGH",
            )

        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1000.00"))
        self.assertFalse(
            WalletPayout.objects.filter(
                user=self.owner,
                provider="manual",
            ).exists()
        )

    @override_settings(
        RAZORPAY_KEY_ID="rzp_test_123",
        RAZORPAY_KEY_SECRET="test_secret_123",
        RAZORPAY_COMPANY_NAME="ShareVerse",
    )
    @patch("core.views.create_razorpay_order")
    def test_wallet_topup_create_order_returns_checkout_payload(self, create_order_mock):
        create_order_mock.return_value = {"id": "order_test_123"}

        self.authenticate(self.owner)
        response = self.client.post(
            "/api/payments/razorpay/create-order/",
            {"amount": "250.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["checkout"]["key"], "rzp_test_123")
        self.assertEqual(response.data["checkout"]["order_id"], "order_test_123")
        self.assertEqual(response.data["checkout"]["amount"], 25000)
        self.assertEqual(response.data["payment"]["mode"], "test")
        self.assertFalse(response.data["payment"]["is_live_mode"])
        self.assertEqual(response.data["topup"]["amount"], "250.00")
        self.assertTrue(
            WalletTopupOrder.objects.filter(
                user=self.owner,
                provider_order_id="order_test_123",
                amount=Decimal("250.00"),
                amount_subunits=25000,
            ).exists()
        )

    @patch("core.views.verify_razorpay_signature", return_value=True)
    @patch("core.views.fetch_razorpay_payment")
    def test_wallet_topup_verify_credits_wallet_once(self, fetch_payment_mock, verify_signature_mock):
        wallet = Wallet.objects.get(user=self.owner)
        topup_order = WalletTopupOrder.objects.create(
            user=self.owner,
            amount=Decimal("250.00"),
            amount_subunits=25000,
            currency="INR",
            receipt="topup_test_receipt",
            provider_order_id="order_test_123",
        )
        fetch_payment_mock.return_value = {
            "id": "pay_test_123",
            "order_id": "order_test_123",
            "amount": 25000,
            "currency": "INR",
            "status": "captured",
            "captured": True,
        }

        self.authenticate(self.owner)
        response = self.client.post(
            "/api/payments/razorpay/verify/",
            {
                "razorpay_order_id": "order_test_123",
                "razorpay_payment_id": "pay_test_123",
                "razorpay_signature": "signature_123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        wallet.refresh_from_db()
        topup_order.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1250.00"))
        self.assertEqual(topup_order.status, "paid")
        self.assertEqual(topup_order.provider_payment_id, "pay_test_123")
        self.assertTrue(topup_order.credited_at)
        self.assertEqual(
            Transaction.objects.filter(
                user=self.owner,
                payment_method="wallet_topup",
                status="success",
                amount=Decimal("250.00"),
            ).count(),
            1,
        )

        second_response = self.client.post(
            "/api/payments/razorpay/verify/",
            {
                "razorpay_order_id": "order_test_123",
                "razorpay_payment_id": "pay_test_123",
                "razorpay_signature": "signature_123",
            },
            format="json",
        )

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1250.00"))
        self.assertEqual(
            Transaction.objects.filter(
                user=self.owner,
                payment_method="wallet_topup",
                status="success",
                amount=Decimal("250.00"),
            ).count(),
            1,
        )
        verify_signature_mock.assert_called()

    @patch("core.views.verify_razorpay_signature", return_value=True)
    @patch("core.views.capture_razorpay_payment")
    @patch("core.views.fetch_razorpay_payment")
    def test_wallet_topup_verify_captures_authorized_payment(
        self,
        fetch_payment_mock,
        capture_payment_mock,
        verify_signature_mock,
    ):
        wallet = Wallet.objects.get(user=self.owner)
        WalletTopupOrder.objects.create(
            user=self.owner,
            amount=Decimal("125.00"),
            amount_subunits=12500,
            currency="INR",
            receipt="topup_capture_receipt",
            provider_order_id="order_capture_123",
        )
        fetch_payment_mock.return_value = {
            "id": "pay_capture_123",
            "order_id": "order_capture_123",
            "amount": 12500,
            "currency": "INR",
            "status": "authorized",
            "captured": False,
        }
        capture_payment_mock.return_value = {
            "id": "pay_capture_123",
            "order_id": "order_capture_123",
            "amount": 12500,
            "currency": "INR",
            "status": "captured",
            "captured": True,
        }

        self.authenticate(self.owner)
        response = self.client.post(
            "/api/payments/razorpay/verify/",
            {
                "razorpay_order_id": "order_capture_123",
                "razorpay_payment_id": "pay_capture_123",
                "razorpay_signature": "signature_capture_123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1125.00"))
        capture_payment_mock.assert_called_once_with(
            payment_id="pay_capture_123",
            amount_subunits=12500,
            currency="INR",
        )
        verify_signature_mock.assert_called()

    @patch("core.views.verify_razorpay_signature", return_value=False)
    def test_wallet_topup_verify_rejects_invalid_signature(self, verify_signature_mock):
        wallet = Wallet.objects.get(user=self.owner)
        WalletTopupOrder.objects.create(
            user=self.owner,
            amount=Decimal("99.00"),
            amount_subunits=9900,
            currency="INR",
            receipt="topup_bad_signature",
            provider_order_id="order_bad_signature",
        )

        self.authenticate(self.owner)
        response = self.client.post(
            "/api/payments/razorpay/verify/",
            {
                "razorpay_order_id": "order_bad_signature",
                "razorpay_payment_id": "pay_bad_signature",
                "razorpay_signature": "bad_signature",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Payment signature verification failed.")
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1000.00"))
        self.assertFalse(
            Transaction.objects.filter(
                user=self.owner,
                payment_method="wallet_topup",
                amount=Decimal("99.00"),
            ).exists()
        )
        verify_signature_mock.assert_called_once()

    @patch("core.views.verify_razorpay_webhook_signature", return_value=True)
    def test_wallet_topup_webhook_credits_wallet_once(self, verify_webhook_signature_mock):
        wallet = Wallet.objects.get(user=self.owner)
        topup_order = WalletTopupOrder.objects.create(
            user=self.owner,
            amount=Decimal("300.00"),
            amount_subunits=30000,
            currency="INR",
            receipt="topup_webhook_receipt",
            provider_order_id="order_webhook_123",
        )
        payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_webhook_123",
                        "order_id": "order_webhook_123",
                        "amount": 30000,
                        "currency": "INR",
                        "status": "captured",
                        "captured": True,
                    }
                }
            },
        }

        response = self.client.post(
            "/api/payments/razorpay/webhook/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE="webhook_signature_123",
            HTTP_X_RAZORPAY_EVENT_ID="evt_webhook_123",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        wallet.refresh_from_db()
        topup_order.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1300.00"))
        self.assertEqual(topup_order.status, "paid")
        self.assertEqual(topup_order.provider_payment_id, "pay_webhook_123")
        self.assertEqual(
            Transaction.objects.filter(
                user=self.owner,
                payment_method="wallet_topup",
                amount=Decimal("300.00"),
                status="success",
            ).count(),
            1,
        )
        self.assertTrue(
            RazorpayWebhookEvent.objects.filter(
                event_id="evt_webhook_123",
                status="processed",
                payment_id="pay_webhook_123",
            ).exists()
        )

        duplicate_response = self.client.post(
            "/api/payments/razorpay/webhook/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE="webhook_signature_123",
            HTTP_X_RAZORPAY_EVENT_ID="evt_webhook_123",
        )

        self.assertEqual(duplicate_response.status_code, status.HTTP_200_OK)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1300.00"))
        self.assertEqual(
            Transaction.objects.filter(
                user=self.owner,
                payment_method="wallet_topup",
                amount=Decimal("300.00"),
                status="success",
            ).count(),
            1,
        )
        verify_webhook_signature_mock.assert_called()

    @patch("core.views.verify_razorpay_webhook_signature", return_value=False)
    def test_wallet_topup_webhook_rejects_invalid_signature(self, verify_webhook_signature_mock):
        wallet = Wallet.objects.get(user=self.owner)
        topup_order = WalletTopupOrder.objects.create(
            user=self.owner,
            amount=Decimal("180.00"),
            amount_subunits=18000,
            currency="INR",
            receipt="topup_invalid_webhook_receipt",
            provider_order_id="order_invalid_webhook",
        )
        payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_invalid_webhook",
                        "order_id": "order_invalid_webhook",
                        "amount": 18000,
                        "currency": "INR",
                        "status": "captured",
                        "captured": True,
                    }
                }
            },
        }

        response = self.client.post(
            "/api/payments/razorpay/webhook/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE="bad_webhook_signature",
            HTTP_X_RAZORPAY_EVENT_ID="evt_bad_webhook",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Invalid webhook signature.")
        wallet.refresh_from_db()
        topup_order.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1000.00"))
        self.assertEqual(topup_order.status, "created")
        self.assertFalse(RazorpayWebhookEvent.objects.filter(event_id="evt_bad_webhook").exists())
        verify_webhook_signature_mock.assert_called_once()

    @override_settings(
        RAZORPAY_KEY_ID="rzp_live_123",
        RAZORPAY_KEY_SECRET="live_secret_123",
        RAZORPAY_WEBHOOK_SECRET="webhook_secret_123",
    )
    def test_dashboard_reports_live_wallet_payment_mode(self):
        self.authenticate(self.owner)
        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["wallet_payments"]["mode"], "live")
        self.assertTrue(response.data["wallet_payments"]["is_live_mode"])
        self.assertTrue(response.data["wallet_payments"]["topup_enabled"])
        self.assertTrue(response.data["wallet_payments"]["webhook_enabled"])

    @override_settings(
        RAZORPAY_KEY_ID="rzp_live_123",
        RAZORPAY_KEY_SECRET="live_secret_123",
        RAZORPAYX_KEY_ID="",
        RAZORPAYX_KEY_SECRET="",
        RAZORPAYX_WEBHOOK_SECRET="",
        RAZORPAYX_SOURCE_ACCOUNT_NUMBER="",
    )
    def test_dashboard_reports_manual_review_wallet_payout_mode_without_automated_payouts(self):
        self.authenticate(self.owner)
        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["wallet_payouts_config"]["mode"], "manual_review")
        self.assertEqual(response.data["wallet_payouts_config"]["mode_label"], "Manual review payouts")
        self.assertEqual(response.data["wallet_payouts_config"]["provider"], "manual")
        self.assertTrue(response.data["wallet_payouts_config"]["manual_review_enabled"])
        self.assertFalse(response.data["wallet_payouts_config"]["payout_enabled"])
        self.assertFalse(response.data["wallet_payouts_config"]["is_live_mode"])

    @override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
    def test_wallet_topup_create_order_requires_gateway_configuration(self):
        self.authenticate(self.owner)
        response = self.client.post(
            "/api/payments/razorpay/create-order/",
            {"amount": "150.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            response.data["error"],
            "Wallet top-ups are not configured on this server yet.",
        )
        self.assertEqual(response.data["payment"]["mode"], "unconfigured")

    def test_group_payloads_include_unread_chat_counts(self):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        self.send_group_chat(group, self.owner, "Please check the latest update.")

        self.authenticate(self.member_one)
        dashboard_response = self.client.get("/api/dashboard/")
        self.assertEqual(dashboard_response.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard_response.data["groups"][0]["unread_chat_count"], 1)

        self.authenticate(self.owner)
        my_groups_response = self.client.get("/api/my-groups/")
        self.assertEqual(my_groups_response.status_code, status.HTTP_200_OK)
        self.assertEqual(my_groups_response.data[0]["unread_chat_count"], 0)

        self.get_group_chat(group, self.member_one)
        self.authenticate(self.member_one)
        dashboard_after_read = self.client.get("/api/dashboard/")
        self.assertEqual(dashboard_after_read.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard_after_read.data["groups"][0]["unread_chat_count"], 0)

    def test_group_chat_inbox_returns_all_accessible_chats_with_unread_total(self):
        owned_group = self.create_group(mode="sharing", total_slots=2, status="active")
        joined_group = self.create_group(mode="group_buy", total_slots=2, status="proof_submitted")
        GroupMember.objects.create(group=owned_group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=joined_group, user=self.member_one, has_paid=True)

        self.send_group_chat(owned_group, self.owner, "Owner thread update")
        self.send_group_chat(joined_group, self.owner, "Joined thread update")

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_chats"], 2)
        self.assertEqual(response.data["total_unread_count"], 2)
        chat_group_ids = [item["group"]["id"] for item in response.data["chats"]]
        self.assertIn(owned_group.id, chat_group_ids)
        self.assertIn(joined_group.id, chat_group_ids)
        owned_chat = next(item for item in response.data["chats"] if item["group"]["id"] == owned_group.id)
        joined_chat = next(item for item in response.data["chats"] if item["group"]["id"] == joined_group.id)
        self.assertEqual(owned_chat["unread_chat_count"], 1)
        self.assertEqual(joined_chat["unread_chat_count"], 1)
        self.assertEqual(owned_chat["last_message"]["message"], "Owner thread update")
        self.assertEqual(joined_chat["last_message"]["message"], "Joined thread update")
        self.assertIn("participant_preview", owned_chat)
        self.assertTrue(owned_chat["participant_preview"][0]["initials"])
        self.assertFalse(owned_chat["is_owner"])

    def test_group_chat_inbox_orders_by_latest_activity(self):
        older_chat_group = self.create_group(mode="sharing", total_slots=2, status="active")
        newer_chat_group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=older_chat_group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=newer_chat_group, user=self.member_one, has_paid=True)

        self.send_group_chat(older_chat_group, self.owner, "Older message")
        self.send_group_chat(newer_chat_group, self.owner, "Newer message")

        older_message = GroupChatMessage.objects.filter(group=older_chat_group).first()
        newer_message = GroupChatMessage.objects.filter(group=newer_chat_group).first()
        GroupChatMessage.objects.filter(id=older_message.id).update(created_at=timezone.now() - timedelta(days=1))
        GroupChatMessage.objects.filter(id=newer_message.id).update(created_at=timezone.now() - timedelta(hours=1))

        response = self.get_chat_inbox(self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["group"]["id"] for item in response.data["chats"][:2]],
            [newer_chat_group.id, older_chat_group.id],
        )

    def test_notification_can_be_marked_read(self):
        notification = Notification.objects.create(
            user=self.owner,
            message="Upload proof for your filled buy-together group.",
        )

        response = self.mark_notification_read(self.owner, notification.id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)
        self.assertTrue(response.data["notification"]["is_read"])

    def test_user_can_mark_all_notifications_read(self):
        Notification.objects.create(user=self.owner, message="First notification")
        Notification.objects.create(user=self.owner, message="Second notification")

        response = self.mark_all_notifications_read(self.owner)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated_count"], 2)
        self.assertEqual(Notification.objects.filter(user=self.owner, is_read=False).count(), 0)

    def test_notifications_endpoint_returns_latest_first(self):
        older = Notification.objects.create(user=self.owner, message="Older")
        newer = Notification.objects.create(user=self.owner, message="Newer")
        Notification.objects.filter(id=older.id).update(created_at=timezone.now() - timedelta(days=1))
        Notification.objects.filter(id=newer.id).update(created_at=timezone.now() - timedelta(hours=1))

        response = self.get_notifications(self.owner)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data[:2]], [newer.id, older.id])

    def test_notifications_payload_includes_category_metadata(self):
        Notification.objects.create(
            user=self.owner,
            message="New group chat message in Netflix from member1.",
        )
        Notification.objects.create(
            user=self.owner,
            message="Your wallet top-up was credited successfully.",
        )
        Notification.objects.create(
            user=self.owner,
            message="Your account was created and verified successfully.",
        )

        response = self.get_notifications(self.owner)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload_by_message = {item["message"]: item for item in response.data}

        chat_item = payload_by_message["New group chat message in Netflix from member1."]
        self.assertEqual(chat_item["category"], "groups")
        self.assertEqual(chat_item["kind"], "chat")
        self.assertEqual(chat_item["context_title"], "Netflix")

        wallet_item = payload_by_message["Your wallet top-up was credited successfully."]
        self.assertEqual(wallet_item["category"], "wallet")
        self.assertEqual(wallet_item["icon"], "wallet")

        system_item = payload_by_message["Your account was created and verified successfully."]
        self.assertEqual(system_item["category"], "system")
        self.assertEqual(system_item["icon"], "shield")

    def test_my_groups_returns_latest_created_group_first(self):
        older_group = self.create_group(mode="sharing", total_slots=2, status="active")
        newer_group = self.create_group(mode="group_buy", total_slots=2, status="forming")

        Group.objects.filter(id=older_group.id).update(created_at=timezone.now() - timedelta(days=2))
        Group.objects.filter(id=newer_group.id).update(created_at=timezone.now() - timedelta(hours=1))

        self.authenticate(self.owner)
        response = self.client.get("/api/my-groups/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([group["id"] for group in response.data[:2]], [newer_group.id, older_group.id])

    def test_dashboard_returns_latest_joined_group_first(self):
        first_group = self.create_group(mode="sharing", total_slots=3, status="active")
        second_group = self.create_group(mode="sharing", total_slots=3, status="active")

        first_membership = GroupMember.objects.create(group=first_group, user=self.member_one, has_paid=True)
        second_membership = GroupMember.objects.create(group=second_group, user=self.member_one, has_paid=True)

        GroupMember.objects.filter(id=first_membership.id).update(joined_at=timezone.now() - timedelta(days=3))
        GroupMember.objects.filter(id=second_membership.id).update(joined_at=timezone.now() - timedelta(hours=2))

        self.authenticate(self.member_one)
        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([group["id"] for group in response.data["groups"][:2]], [second_group.id, first_group.id])

    def test_dashboard_returns_group_buy_confirmation_state_for_joined_member(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="proof_submitted")
        group.purchase_deadline_at = timezone.now() + timedelta(hours=6)
        group.auto_refund_at = group.purchase_deadline_at
        group.save(update_fields=["purchase_deadline_at", "auto_refund_at"])
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(
            group=group,
            user=self.member_two,
            has_paid=True,
            access_confirmed=True,
        )

        self.authenticate(self.member_one)
        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["groups"]), 1)
        joined_group = response.data["groups"][0]
        self.assertEqual(joined_group["charged_amount"], "200.00")
        self.assertFalse(joined_group["is_prorated"])
        self.assertTrue(joined_group["access_confirmation_required"])
        self.assertTrue(joined_group["can_report_access_issue"])
        self.assertFalse(joined_group["has_confirmed_access"])
        self.assertFalse(joined_group["has_reported_access_issue"])
        self.assertEqual(joined_group["confirmed_members"], 1)
        self.assertEqual(joined_group["remaining_confirmations"], 1)

    def test_joining_group_buy_group_marks_it_full_but_not_active(self):
        group = self.create_group(mode="group_buy", total_slots=2)

        self.authenticate(self.member_one)
        first_response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(first_response.data["charged_amount"], "210.00")
        self.assertEqual(first_response.data["join_subtotal"], "200.00")
        self.assertEqual(first_response.data["platform_fee_amount"], "10.00")

        self.authenticate(self.member_two)
        second_response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data["charged_amount"], "210.00")

        self.member_one.refresh_from_db()
        self.member_two.refresh_from_db()
        first_wallet = Wallet.objects.get(user=self.member_one)
        second_wallet = Wallet.objects.get(user=self.member_two)
        self.assertEqual(first_wallet.balance, Decimal("790.00"))
        self.assertEqual(second_wallet.balance, Decimal("790.00"))
        self.assertEqual(
            GroupMember.objects.get(group=group, user=self.member_one).platform_fee_amount,
            Decimal("10.00"),
        )
        self.assertEqual(
            GroupMember.objects.get(group=group, user=self.member_two).platform_fee_amount,
            Decimal("10.00"),
        )

        group.refresh_from_db()
        self.assertEqual(group.status, "awaiting_purchase")
        self.assertEqual(GroupMember.objects.filter(group=group, has_paid=True).count(), 2)
        self.assertEqual(GroupMember.objects.filter(group=group, escrow_status="held").count(), 2)
        self.assertEqual(EscrowLedger.objects.filter(group=group, entry_type="hold").count(), 2)
        self.assertIsNotNone(group.purchase_deadline_at)
        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                message__contains="upload proof before the deadline",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.member_one,
                message__contains="creator will buy the subscription and upload proof next",
            ).exists()
        )

    def test_owner_can_activate_full_group_buy_group_and_notify_members(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        owner_wallet = Wallet.objects.get(user=self.owner)

        proof_response = self.submit_purchase_proof(group)
        self.assertEqual(proof_response.status_code, status.HTTP_200_OK)

        first_confirmation = self.confirm_group_access(group, self.member_one)
        self.assertEqual(first_confirmation.status_code, status.HTTP_200_OK)
        self.assertEqual(first_confirmation.data["remaining_confirmations"], 1)

        second_confirmation = self.confirm_group_access(group, self.member_two)
        self.assertEqual(second_confirmation.status_code, status.HTTP_200_OK)
        group.refresh_from_db()
        owner_wallet.refresh_from_db()

        self.assertEqual(group.status, "active")
        self.assertEqual(owner_wallet.balance, Decimal("1380.00"))
        self.assertEqual(GroupMember.objects.filter(group=group, escrow_status="released").count(), 2)
        self.assertEqual(EscrowLedger.objects.filter(group=group, entry_type="release").count(), 2)
        self.assertEqual(
            Transaction.objects.filter(
                user=self.owner,
                group=group,
                payment_method="group_buy_escrow_release",
                amount=Decimal("380.00"),
            ).count(),
            1,
        )
        self.assertEqual(Notification.objects.filter(user=self.member_one).count(), 2)
        self.assertEqual(Notification.objects.filter(user=self.member_two).count(), 2)
        self.assertEqual(Notification.objects.filter(user=self.owner).count(), 3)
        self.assertEqual(second_confirmation.data["status"], "active")

    def test_owner_can_submit_purchase_proof_for_full_group_buy_group(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)

        response = self.submit_purchase_proof(
            group,
            reference="ORDER-2026-11",
            notes="Invoice screenshot attached.",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group.refresh_from_db()

        self.assertEqual(group.status, "proof_submitted")
        self.assertIsNotNone(group.proof_submitted_at)
        self.assertEqual(group.purchase_reference, "ORDER-2026-11")
        self.assertEqual(group.purchase_notes, "Invoice screenshot attached.")
        self.assertTrue(bool(group.auto_refund_at))
        self.assertTrue(bool(group.purchase_deadline_at))
        self.assertTrue(bool(group.purchase_proof))
        self.assertTrue(response.data["purchase_proof"]["available"])
        self.assertTrue(response.data["purchase_proof"]["file_url"])
        self.assertEqual(GroupMember.objects.filter(group=group, access_confirmed=True).count(), 0)

    def test_my_groups_list_marks_full_buy_together_group_ready_for_proof_upload(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)

        self.authenticate(self.owner)
        response = self.client.get("/api/my-groups/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = next(item for item in response.data if item["id"] == group.id)
        self.assertTrue(payload["can_submit_proof"])

    def test_member_confirmation_endpoint_updates_progress(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        self.submit_purchase_proof(group, reference="ORDER-QUEUE-1", notes="Queue check")

        confirm_response = self.confirm_group_access(group, self.member_one)

        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        group.refresh_from_db()
        self.assertEqual(group.status, "proof_submitted")
        self.assertEqual(confirm_response.data["confirmed_members"], 1)
        self.assertEqual(confirm_response.data["remaining_confirmations"], 1)
        self.assertTrue(
            GroupMember.objects.get(group=group, user=self.member_one).access_confirmed
        )

    def test_owner_cannot_activate_purchase_before_member_confirmations(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        self.submit_purchase_proof(group)

        self.authenticate(self.owner)
        response = self.client.post(f"/api/my-groups/{group.id}/activate/", format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["error"],
            "All group members must confirm receiving access before funds can be released",
        )

    def test_member_cannot_confirm_access_twice(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        self.submit_purchase_proof(group, reference="ORDER-CONFIRM-1", notes="Shared off-platform")

        first_response = self.confirm_group_access(group, self.member_one)
        second_response = self.confirm_group_access(group, self.member_one)

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second_response.data["error"], "You already confirmed receiving access")

    def test_owner_cannot_confirm_access_as_member(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        self.submit_purchase_proof(group)

        self.authenticate(self.owner)
        response = self.client.post(f"/api/groups/{group.id}/confirm-access/", format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "The host cannot confirm access as a member")

    def test_member_can_report_access_issue_and_pause_payout(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        self.submit_purchase_proof(group)

        response = self.report_access_issue(
            group,
            self.member_one,
            details="The creator did not send the credentials.",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group.refresh_from_db()
        member = GroupMember.objects.get(group=group, user=self.member_one)

        self.assertEqual(group.status, "disputed")
        self.assertIsNone(group.auto_refund_at)
        self.assertIsNone(group.purchase_deadline_at)
        self.assertTrue(member.access_issue_reported)
        self.assertEqual(member.access_issue_notes, "The creator did not send the credentials.")
        self.assertEqual(response.data["reported_issues"], 1)

    def test_member_can_confirm_after_reporting_issue_and_restore_confirmation_window(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        self.submit_purchase_proof(group)
        self.report_access_issue(group, self.member_one, details="Still waiting for credentials.")

        response = self.confirm_group_access(group, self.member_one)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group.refresh_from_db()
        member = GroupMember.objects.get(group=group, user=self.member_one)

        self.assertEqual(group.status, "proof_submitted")
        self.assertFalse(member.access_issue_reported)
        self.assertTrue(member.access_confirmed)
        self.assertEqual(response.data["remaining_confirmations"], 1)
        self.assertEqual(response.data["reported_issues"], 0)
        self.assertIsNotNone(group.auto_refund_at)
        self.assertIsNotNone(group.purchase_deadline_at)

    def test_owner_cannot_report_access_issue_as_member(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        self.submit_purchase_proof(group)

        self.authenticate(self.owner)
        response = self.client.post(
            f"/api/groups/{group.id}/report-access-issue/",
            {"details": "Owner cannot use this endpoint."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["error"],
            "The purchaser cannot report an access issue as a member",
        )

    def test_management_command_auto_releases_clean_expired_confirmation_window(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        owner_wallet = Wallet.objects.get(user=self.owner)
        member_one_wallet = Wallet.objects.get(user=self.member_one)
        member_two_wallet = Wallet.objects.get(user=self.member_two)
        member_one_wallet.balance = Decimal("800.00")
        member_one_wallet.save()
        member_two_wallet.balance = Decimal("800.00")
        member_two_wallet.save()

        first_member = GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        second_member = GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        EscrowLedger.objects.create(
            user=self.member_one,
            group=group,
            member=first_member,
            amount=Decimal("200.00"),
            entry_type="hold",
            status="success",
        )
        EscrowLedger.objects.create(
            user=self.member_two,
            group=group,
            member=second_member,
            amount=Decimal("200.00"),
            entry_type="hold",
            status="success",
        )

        self.submit_purchase_proof(group)
        group.refresh_from_db()
        group.auto_refund_at = timezone.now() - timedelta(minutes=1)
        group.purchase_deadline_at = timezone.now() - timedelta(minutes=1)
        group.save(update_fields=["auto_refund_at", "purchase_deadline_at"])

        call_command("process_expired_group_buy_refunds")

        group.refresh_from_db()
        member_one_wallet.refresh_from_db()
        member_two_wallet.refresh_from_db()
        owner_wallet.refresh_from_db()

        self.assertEqual(group.status, "active")
        self.assertEqual(member_one_wallet.balance, Decimal("800.00"))
        self.assertEqual(member_two_wallet.balance, Decimal("800.00"))
        self.assertEqual(owner_wallet.balance, Decimal("1380.00"))
        self.assertEqual(EscrowLedger.objects.filter(group=group, entry_type="release").count(), 2)

    def test_disputed_group_does_not_auto_release_when_deadline_worker_runs(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        owner_wallet = Wallet.objects.get(user=self.owner)
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        self.submit_purchase_proof(group)
        self.report_access_issue(group, self.member_one, details="Still missing access.")

        group.auto_refund_at = timezone.now() - timedelta(minutes=1)
        group.purchase_deadline_at = timezone.now() - timedelta(minutes=1)
        group.save(update_fields=["auto_refund_at", "purchase_deadline_at"])

        call_command("process_expired_group_buy_refunds")

        group.refresh_from_db()
        owner_wallet.refresh_from_db()

        self.assertEqual(group.status, "disputed")
        self.assertEqual(owner_wallet.balance, Decimal("1000.00"))
        self.assertEqual(EscrowLedger.objects.filter(group=group, entry_type="release").count(), 0)

    def test_expired_buy_together_group_auto_refunds_on_owner_detail_view(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        group.purchase_deadline_at = timezone.now() - timedelta(minutes=5)
        group.auto_refund_at = timezone.now() - timedelta(minutes=5)
        group.save(update_fields=["purchase_deadline_at", "auto_refund_at"])

        member_one_wallet = Wallet.objects.get(user=self.member_one)
        member_two_wallet = Wallet.objects.get(user=self.member_two)
        member_one_wallet.balance = Decimal("800.00")
        member_one_wallet.save()
        member_two_wallet.balance = Decimal("800.00")
        member_two_wallet.save()

        first_member = GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        second_member = GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        EscrowLedger.objects.create(
            user=self.member_one,
            group=group,
            member=first_member,
            amount=Decimal("200.00"),
            entry_type="hold",
            status="success",
        )
        EscrowLedger.objects.create(
            user=self.member_two,
            group=group,
            member=second_member,
            amount=Decimal("200.00"),
            entry_type="hold",
            status="success",
        )

        self.authenticate(self.owner)
        response = self.client.get(f"/api/my-groups/{group.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group.refresh_from_db()
        member_one_wallet.refresh_from_db()
        member_two_wallet.refresh_from_db()

        self.assertEqual(group.status, "refunded")
        self.assertTrue(group.is_refunded)
        self.assertEqual(member_one_wallet.balance, Decimal("1000.00"))
        self.assertEqual(member_two_wallet.balance, Decimal("1000.00"))
        self.assertEqual(response.data["status"], "refunded")
        self.assertFalse(response.data["can_refund"])
        self.assertEqual(EscrowLedger.objects.filter(group=group, entry_type="refund").count(), 2)

    def test_owner_can_refund_held_group_buy_funds(self):
        group = self.create_group(mode="group_buy", total_slots=2, status="awaiting_purchase")
        member_one_wallet = Wallet.objects.get(user=self.member_one)
        member_two_wallet = Wallet.objects.get(user=self.member_two)
        member_one_wallet.balance = Decimal("800.00")
        member_one_wallet.save()
        member_two_wallet.balance = Decimal("800.00")
        member_two_wallet.save()

        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=True)
        EscrowLedger.objects.create(
            user=self.member_one,
            group=group,
            member=GroupMember.objects.get(group=group, user=self.member_one),
            amount=Decimal("200.00"),
            entry_type="hold",
            status="success",
        )
        EscrowLedger.objects.create(
            user=self.member_two,
            group=group,
            member=GroupMember.objects.get(group=group, user=self.member_two),
            amount=Decimal("200.00"),
            entry_type="hold",
            status="success",
        )

        self.authenticate(self.owner)
        response = self.client.post(f"/api/my-groups/{group.id}/refund/", format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group.refresh_from_db()
        member_one_wallet.refresh_from_db()
        member_two_wallet.refresh_from_db()

        self.assertEqual(group.status, "refunded")
        self.assertTrue(group.is_refunded)
        self.assertEqual(member_one_wallet.balance, Decimal("1000.00"))
        self.assertEqual(member_two_wallet.balance, Decimal("1000.00"))
        self.assertEqual(GroupMember.objects.filter(group=group, escrow_status="refunded").count(), 2)
        self.assertEqual(EscrowLedger.objects.filter(group=group, entry_type="refund").count(), 2)

    def test_group_buy_refund_returns_platform_fee_to_joined_member(self):
        group = self.create_group(mode="group_buy", total_slots=1, status="forming")
        member_wallet = Wallet.objects.get(user=self.member_one)

        self.authenticate(self.member_one)
        join_response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")

        self.assertEqual(join_response.status_code, status.HTTP_200_OK)
        member_wallet.refresh_from_db()
        self.assertEqual(member_wallet.balance, Decimal("790.00"))

        self.authenticate(self.owner)
        refund_response = self.client.post(f"/api/my-groups/{group.id}/refund/", format="json")

        self.assertEqual(refund_response.status_code, status.HTTP_200_OK)
        member_wallet.refresh_from_db()
        payout_member = GroupMember.objects.get(group=group, user=self.member_one)
        self.assertEqual(member_wallet.balance, Decimal("1000.00"))
        self.assertEqual(payout_member.refund_amount, Decimal("210.00"))
        self.assertTrue(
            Transaction.objects.filter(
                user=self.member_one,
                group=group,
                payment_method="refund",
                amount=Decimal("210.00"),
            ).exists()
        )
        self.assertTrue(
            EscrowLedger.objects.filter(
                user=self.member_one,
                group=group,
                entry_type="refund",
                amount=Decimal("200.00"),
            ).exists()
        )

    def test_owner_group_detail_shows_member_payment_progress(self):
        group = self.create_group(mode="group_buy", total_slots=3, status="collecting")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        GroupMember.objects.create(group=group, user=self.member_two, has_paid=False)

        self.authenticate(self.owner)
        response = self.client.get(f"/api/my-groups/{group.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["filled_slots"], 2)
        self.assertEqual(response.data["paid_members"], 1)
        self.assertFalse(response.data["can_activate"])
        self.assertTrue(response.data["can_refund"])
        self.assertEqual(len(response.data["members"]), 2)
        self.assertEqual(response.data["members"][0]["username"], "member1")

    def test_owner_can_edit_group_before_members_join(self):
        group = self.create_group(mode="sharing", total_slots=2, status="forming")

        self.authenticate(self.owner)
        response = self.client.patch(
            f"/api/my-groups/{group.id}/",
            {
                "subscription_name": "Spotify",
                "total_slots": 4,
                "price_per_slot": "250.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group.refresh_from_db()
        self.assertEqual(group.subscription.name, "Spotify")
        self.assertEqual(group.total_slots, 4)
        self.assertEqual(group.price_per_slot, Decimal("250.00"))

    def test_owner_cannot_change_price_after_members_join(self):
        group = self.create_group(mode="sharing", total_slots=3, status="forming")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        self.authenticate(self.owner)
        response = self.client.patch(
            f"/api/my-groups/{group.id}/",
            {
                "price_per_slot": "250.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("price_per_slot", response.data)

    def test_owner_can_update_sharing_credentials_after_members_join(self):
        group = self.create_group(
            mode="sharing",
            total_slots=3,
            status="active",
            access_identifier="old@example.com",
            access_password="old-pass",
        )
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        self.authenticate(self.owner)
        response = self.client.patch(
            f"/api/my-groups/{group.id}/",
            {
                "access_identifier": "new@example.com",
                "access_password": "new-pass",
                "access_notes": "Use profile 2.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group.refresh_from_db()
        self.assertTrue(group.access_identifier.startswith("enc::"))
        self.assertTrue(group.access_password.startswith("enc::"))
        self.assertEqual(group.get_access_identifier(), "new@example.com")
        self.assertEqual(group.get_access_password(), "new-pass")
        self.assertEqual(group.access_notes, "Use profile 2.")

    def test_owner_can_delete_empty_group(self):
        group = self.create_group(mode="sharing", total_slots=2, status="forming")

        self.authenticate(self.owner)
        response = self.client.delete(f"/api/my-groups/{group.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Group.objects.filter(id=group.id).exists())

    def test_owner_can_close_joined_sharing_group_and_members_cannot_rejoin(self):
        group = self.create_group(mode="sharing", total_slots=3, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        self.authenticate(self.owner)
        response = self.client.post(f"/api/my-groups/{group.id}/close/", format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group.refresh_from_db()
        self.assertEqual(group.status, "closed")
        self.assertEqual(Notification.objects.filter(user=self.member_one).count(), 1)

        self.authenticate(self.member_two)
        browse_response = self.client.get("/api/groups/")
        self.assertEqual(browse_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(browse_response.data), 0)

        join_response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")
        self.assertEqual(join_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(join_response.data["error"], "This group has been closed by the owner")

    def test_owner_cannot_close_buy_together_group_with_member_funds_before_activation(self):
        group = self.create_group(mode="group_buy", total_slots=3, status="collecting")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        self.authenticate(self.owner)
        response = self.client.post(f"/api/my-groups/{group.id}/close/", format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["error"],
            "Buy-together groups with members cannot be closed before activation.",
        )
        group.refresh_from_db()
        self.assertEqual(group.status, "collecting")

    def test_member_can_rate_group_owner_after_group_is_active(self):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.submit_review(
            group,
            self.member_one,
            self.owner,
            rating=4,
            comment="Reliable and easy to coordinate with.",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Review.objects.filter(
                group=group,
                reviewer=self.member_one,
                reviewed_user=self.owner,
                rating=4,
            ).exists()
        )
        self.assertEqual(Notification.objects.filter(user=self.owner).count(), 1)

        self.authenticate(self.member_one)
        dashboard_response = self.client.get("/api/dashboard/")
        self.assertEqual(dashboard_response.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard_response.data["groups"][0]["owner_rating"]["average_rating"], 4.0)
        self.assertEqual(dashboard_response.data["groups"][0]["owner_rating"]["review_count"], 1)

    def test_owner_can_rate_group_member_and_update_existing_review(self):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        first_response = self.submit_review(
            group,
            self.owner,
            self.member_one,
            rating=5,
            comment="Very responsive member.",
        )
        second_response = self.submit_review(
            group,
            self.owner,
            self.member_one,
            rating=3,
            comment="Needed a few reminders.",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Review.objects.filter(group=group, reviewer=self.owner, reviewed_user=self.member_one).count(),
            1,
        )
        updated_review = Review.objects.get(group=group, reviewer=self.owner, reviewed_user=self.member_one)
        self.assertEqual(updated_review.rating, 3)
        self.assertEqual(updated_review.comment, "Needed a few reminders.")

        self.authenticate(self.owner)
        detail_response = self.client.get(f"/api/my-groups/{group.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["members"][0]["rating"]["average_rating"], 3.0)
        self.assertEqual(detail_response.data["members"][0]["rating"]["my_review"]["comment"], "Needed a few reminders.")

    def test_user_cannot_rate_before_group_is_active(self):
        group = self.create_group(mode="sharing", total_slots=2, status="forming")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        response = self.submit_review(group, self.member_one, self.owner, rating=5)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Ratings unlock after a group becomes active.")

    def test_profile_endpoint_includes_recent_reviews(self):
        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        self.submit_review(
            group,
            self.member_one,
            self.owner,
            rating=5,
            comment="Great host for the group.",
        )

        self.authenticate(self.owner)
        response = self.client.get("/api/profile/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["average_rating"], 5.0)
        self.assertEqual(response.data["review_count"], 1)
        self.assertEqual(response.data["recent_reviews"][0]["reviewer_username"], self.member_one.username)
        self.assertEqual(response.data["recent_reviews"][0]["group_name"], self.subscription.name)

    def test_profile_endpoint_returns_account_summary(self):
        self.owner.first_name = "Profile"
        self.owner.last_name = "Owner"
        self.owner.is_verified = True
        self.owner.trust_score = Decimal("4.2")
        self.owner.save()

        group = self.create_group(mode="sharing", total_slots=2, status="active")
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)
        Transaction.objects.create(
            user=self.owner,
            group=group,
            amount=Decimal("200.00"),
            type="credit",
            status="success",
            payment_method="group_share_payout",
        )

        self.authenticate(self.owner)
        response = self.client.get("/api/profile/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["full_name"], "Profile Owner")
        self.assertEqual(response.data["groups_created"], 1)
        self.assertEqual(response.data["sharing_groups_created"], 1)
        self.assertEqual(response.data["wallet_balance"], "1000.00")
        self.assertEqual(response.data["total_earned"], "200")
        self.assertTrue(response.data["is_verified"])
        self.assertFalse(response.data["is_staff"])

    def test_dashboard_returns_current_user_identity_for_client_personalization(self):
        self.authenticate(self.owner)
        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_user"]["id"], self.owner.id)
        self.assertEqual(response.data["current_user"]["username"], self.owner.username)

    def test_profile_endpoint_allows_updating_account_details(self):
        self.authenticate(self.owner)
        response = self.client.patch(
            "/api/profile/",
            {
                "first_name": "Updated",
                "last_name": "Owner",
                "email": "updated@example.com",
                "phone": "9888877777",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.first_name, "Updated")
        self.assertEqual(self.owner.last_name, "Owner")
        self.assertEqual(self.owner.email, "updated@example.com")
        self.assertEqual(self.owner.phone, "9888877777")
        self.assertEqual(response.data["full_name"], "Updated Owner")

    def test_owner_can_generate_and_member_can_accept_group_invite_link(self):
        group = self.create_group(mode="sharing", total_slots=2, status="forming")

        self.authenticate(self.owner)
        invite_response = self.client.post(
            "/api/invite/generate/",
            {
                "group_id": group.id,
                "max_uses": 2,
                "expires_in_hours": 24,
            },
            format="json",
        )

        self.assertEqual(invite_response.status_code, status.HTTP_201_CREATED)
        self.assertIn("invite_url", invite_response.data)

        self.client.force_authenticate(user=None)
        info_response = self.client.get(f"/api/invite/info/?token={invite_response.data['token']}")

        self.assertEqual(info_response.status_code, status.HTTP_200_OK)
        self.assertEqual(info_response.data["subscription_name"], self.subscription.name)
        self.assertEqual(info_response.data["owner_username"], self.owner.username)
        self.assertTrue(info_response.data["is_joinable"])

        member_wallet = Wallet.objects.get(user=self.member_one)
        starting_balance = member_wallet.balance

        self.authenticate(self.member_one)
        accept_response = self.client.post(
            "/api/invite/accept/",
            {"token": invite_response.data["token"]},
            format="json",
        )

        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
        self.assertTrue(GroupMember.objects.filter(group=group, user=self.member_one).exists())

        invite_link = GroupInviteLink.objects.get(id=invite_response.data["id"])
        self.assertEqual(invite_link.use_count, 1)

        member_wallet.refresh_from_db()
        self.assertEqual(
            member_wallet.balance,
            starting_balance - get_group_join_pricing(group)["join_price"],
        )

    @override_settings(EXPOSE_DEV_OTP=True)
    @patch("core.auth_views.deliver_otp_code", return_value=True)
    def test_signup_with_referral_code_creates_referral_record(self, _deliver_otp_code):
        referral_code = self.owner.referral_code.code

        otp_response = self.client.post(
            "/api/signup/request-otp/",
            {
                "username": "newreferraluser",
                "email": "newreferraluser@example.com",
                "phone": "",
                "referral_code": referral_code,
            },
            format="json",
        )

        self.assertEqual(otp_response.status_code, status.HTTP_200_OK)

        signup_response = self.client.post(
            "/api/signup/",
            {
                "username": "newreferraluser",
                "first_name": "New",
                "last_name": "User",
                "email": "newreferraluser@example.com",
                "phone": "",
                "password": "password123",
                "signup_session_id": otp_response.data["signup_session_id"],
                "otp": otp_response.data["dev_otp"],
                "referral_code": referral_code,
            },
            format="json",
        )

        self.assertEqual(signup_response.status_code, status.HTTP_201_CREATED)

        new_user = User.objects.get(username="newreferraluser")
        referral = Referral.objects.get(referred_user=new_user)
        referrer_code = ReferralCode.objects.get(user=self.owner)

        self.assertEqual(referral.referrer_id, self.owner.id)
        self.assertEqual(referral.referral_code_id, referrer_code.id)
        self.assertEqual(referral.status, "signed_up")

        referrer_code.refresh_from_db()
        self.assertEqual(referrer_code.total_referrals, 1)

    def test_first_group_join_applies_referral_rewards_to_both_wallets(self):
        group_owner = self.member_one
        referred_user = self.outsider
        referral_code = self.owner.referral_code
        referral_code.total_referrals = 1
        referral_code.save(update_fields=["total_referrals"])

        referral = Referral.objects.create(
            referrer=self.owner,
            referred_user=referred_user,
            referral_code=referral_code,
            status="signed_up",
        )

        group = Group.objects.create(
            owner=group_owner,
            subscription=self.subscription,
            total_slots=2,
            price_per_slot=Decimal("200.00"),
            start_date=date.today(),
            end_date=date.today() + timedelta(days=29),
            mode="sharing",
            status="forming",
        )

        referrer_wallet = Wallet.objects.get(user=self.owner)
        referred_wallet = Wallet.objects.get(user=referred_user)
        referrer_starting_balance = referrer_wallet.balance
        referred_starting_balance = referred_wallet.balance

        self.authenticate(referred_user)
        response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        referral.refresh_from_db()
        referral_code.refresh_from_db()
        referrer_wallet.refresh_from_db()
        referred_wallet.refresh_from_db()
        expected_join_price = get_group_join_pricing(group)["join_price"]

        self.assertTrue(referral.reward_given)
        self.assertEqual(referral.status, "rewarded")
        self.assertEqual(referral.reward_amount, Decimal("25.00"))
        self.assertEqual(referral_code.successful_referrals, 1)
        self.assertEqual(referrer_wallet.balance, referrer_starting_balance)
        self.assertEqual(referrer_wallet.bonus_balance, Decimal("25.00"))
        self.assertEqual(referred_wallet.balance, referred_starting_balance - expected_join_price)
        self.assertEqual(referred_wallet.bonus_balance, Decimal("10.00"))
        self.assertTrue(
            Transaction.objects.filter(user=self.owner, payment_method="referral_reward", type="credit").exists()
        )
        self.assertTrue(
            Transaction.objects.filter(user=referred_user, payment_method="referral_reward", type="credit").exists()
        )

    def test_referral_reward_requires_minimum_join_subtotal(self):
        group_owner = self.member_one
        referred_user = self.outsider
        referral_code = self.owner.referral_code
        referral_code.total_referrals = 1
        referral_code.save(update_fields=["total_referrals"])

        referral = Referral.objects.create(
            referrer=self.owner,
            referred_user=referred_user,
            referral_code=referral_code,
            status="signed_up",
        )

        group = Group.objects.create(
            owner=group_owner,
            subscription=self.subscription,
            total_slots=2,
            price_per_slot=Decimal("149.00"),
            start_date=date.today(),
            end_date=date.today() + timedelta(days=29),
            mode="sharing",
            status="forming",
        )

        referrer_wallet = Wallet.objects.get(user=self.owner)
        referred_wallet = Wallet.objects.get(user=referred_user)
        referrer_starting_balance = referrer_wallet.balance
        referred_starting_balance = referred_wallet.balance

        self.authenticate(referred_user)
        response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["referral_reward"])

        referral.refresh_from_db()
        referral_code.refresh_from_db()
        referrer_wallet.refresh_from_db()
        referred_wallet.refresh_from_db()
        expected_join_price = get_group_join_pricing(group)["join_price"]

        self.assertFalse(referral.reward_given)
        self.assertEqual(referral.status, "signed_up")
        self.assertEqual(referral.reward_amount, Decimal("0.00"))
        self.assertEqual(referral_code.successful_referrals, 0)
        self.assertEqual(referrer_wallet.balance, referrer_starting_balance)
        self.assertEqual(referred_wallet.balance, referred_starting_balance - expected_join_price)
        self.assertFalse(
            Transaction.objects.filter(user=self.owner, payment_method="referral_reward", type="credit").exists()
        )
        self.assertFalse(
            Transaction.objects.filter(user=referred_user, payment_method="referral_reward", type="credit").exists()
        )

    def test_group_join_uses_bonus_balance_before_cash_balance(self):
        group = self.create_group(mode="sharing", total_slots=2, status="forming")
        expected_join_price = get_group_join_pricing(group)["join_price"]
        bonus_credit = Decimal("150.00")
        cash_needed = expected_join_price - bonus_credit

        wallet = Wallet.objects.get(user=self.outsider)
        wallet.balance = cash_needed
        wallet.bonus_balance = bonus_credit
        wallet.save(update_fields=["balance", "bonus_balance"])

        self.authenticate(self.outsider)
        response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("0.00"))
        self.assertEqual(wallet.bonus_balance, Decimal("0.00"))
        self.assertEqual(response.data["remaining_balance"], "0.00")
        self.assertEqual(response.data["remaining_cash_balance"], "0.00")
        self.assertEqual(response.data["remaining_bonus_balance"], "0.00")
        self.assertTrue(
            Transaction.objects.filter(
                user=self.outsider,
                payment_method="wallet",
                type="debit",
                amount=cash_needed,
            ).exists()
        )
        self.assertTrue(
            Transaction.objects.filter(
                user=self.outsider,
                payment_method="wallet_bonus",
                type="debit",
                amount=bonus_credit,
            ).exists()
        )

    def test_user_cannot_withdraw_bonus_balance(self):
        wallet = Wallet.objects.get(user=self.owner)
        wallet.balance = Decimal("100.00")
        wallet.bonus_balance = Decimal("250.00")
        wallet.save(update_fields=["balance", "bonus_balance"])
        self.create_local_bank_payout_account(self.owner)

        self.authenticate(self.owner)
        response = self.client.post(
            "/api/withdraw-money/",
            {"amount": "120.00", "payout_mode": "IMPS"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient wallet balance", response.data["error"])

        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("100.00"))
        self.assertEqual(wallet.bonus_balance, Decimal("250.00"))

    def test_dashboard_returns_cash_bonus_and_spendable_balances(self):
        wallet = Wallet.objects.get(user=self.owner)
        wallet.balance = Decimal("400.00")
        wallet.bonus_balance = Decimal("25.00")
        wallet.save(update_fields=["balance", "bonus_balance"])

        self.authenticate(self.owner)
        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["balance"], "400.00")
        self.assertEqual(response.data["bonus_balance"], "25.00")
        self.assertEqual(response.data["withdrawable_balance"], "400.00")
        self.assertEqual(response.data["spendable_balance"], "425.00")
        self.assertEqual(response.data["wallet_balance"], "425.00")

    def test_health_endpoint_reports_service_readiness(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertEqual(response.data["database"], "ok")
        self.assertIn("payments", response.data)
        self.assertIn("payouts", response.data)

    @override_settings(
        RAZORPAY_KEY_ID="rzp_live_123",
        RAZORPAY_KEY_SECRET="live_secret_123",
        RAZORPAYX_KEY_ID="",
        RAZORPAYX_KEY_SECRET="",
        RAZORPAYX_WEBHOOK_SECRET="",
        RAZORPAYX_SOURCE_ACCOUNT_NUMBER="",
    )
    def test_health_endpoint_reports_manual_review_payout_mode_without_automated_payouts(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["payments"], "live")
        self.assertEqual(response.data["payouts"], "manual_review")
