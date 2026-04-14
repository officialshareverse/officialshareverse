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
from pathlib import Path
from django.utils import timezone
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    EscrowLedger,
    Group,
    GroupChatMessage,
    GroupChatReadState,
    GroupMember,
    Notification,
    PasswordResetOTP,
    PayoutAccount,
    RazorpayWebhookEvent,
    RazorpayXPayoutWebhookEvent,
    Review,
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
        test_media_parent = Path(__file__).resolve().parent / "test-media"
        test_media_parent.mkdir(exist_ok=True)
        self.media_root = tempfile.mkdtemp(dir=test_media_parent)
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

    def test_signup_accepts_name_fields(self):
        response = self.client.post(
            "/api/signup/",
            {
                "username": "newuser",
                "first_name": "New",
                "last_name": "Member",
                "email": "newuser@example.com",
                "phone": "9111111111",
                "password": "password123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username="newuser")
        self.assertEqual(created_user.first_name, "New")
        self.assertEqual(created_user.last_name, "Member")

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
                "access_identifier": "spotify-owner@example.com",
                "access_password": "securepass",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_date", response.data)

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
                "access_identifier": "spotify-owner@example.com",
                "access_password": "securepass",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group = Group.objects.get(id=response.data["group_id"])
        self.assertEqual(group.start_date, date(2026, 4, 12))
        self.assertEqual(group.end_date, date(2026, 5, 11))

    def test_forgot_password_reset_with_otp_flow(self):
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

        with patch("core.views.PASSWORD_RESET_OTP_CONFIRM_RATE_LIMIT", 2), patch(
            "core.views.PASSWORD_RESET_OTP_CONFIRM_RATE_WINDOW_SECONDS", 120
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

        self.assertEqual(group.status, "active")
        self.assertEqual(member_wallet.balance, Decimal("800.00"))
        self.assertEqual(owner_wallet.balance, Decimal("1200.00"))
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
        self.assertTrue(
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
        GroupMember.objects.create(group=group, user=self.member_one, has_paid=True)

        self.authenticate(self.member_one)
        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["groups"]), 1)
        credentials = response.data["groups"][0]["credentials"]
        self.assertFalse(credentials["available"])
        self.assertFalse(credentials["requires_one_time_reveal"])
        self.assertEqual(
            credentials["message"],
            "Access is coordinated privately by the group owner.",
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
        self.assertEqual(response.data["charged_amount"], "100.00")
        self.assertTrue(response.data["is_prorated"])
        self.assertEqual(response.data["remaining_cycle_days"], 10)
        self.assertEqual(response.data["total_cycle_days"], 30)

        owner_wallet.refresh_from_db()
        member_wallet.refresh_from_db()
        member = GroupMember.objects.get(group=group, user=self.member_one)

        self.assertEqual(member.charged_amount, Decimal("100.00"))
        self.assertEqual(member_wallet.balance, Decimal("900.00"))
        self.assertEqual(owner_wallet.balance, Decimal("1100.00"))
        self.assertTrue(
            Transaction.objects.filter(
                user=self.member_one,
                group=group,
                payment_method="wallet",
                amount=Decimal("100.00"),
            ).exists()
        )
        self.assertTrue(
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
        self.assertEqual(payload["join_price"], "100.00")
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
        self.assertEqual(payout.transaction.status, "success")
        self.assertEqual(payout.transaction.payment_method, "wallet_payout")
        self.assertEqual(
            payout.status_details["created_by_username"],
            staff_user.username,
        )
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

        self.authenticate(self.member_two)
        second_response = self.client.post("/api/join-group/", {"group_id": group.id}, format="json")
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)

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
        self.assertEqual(owner_wallet.balance, Decimal("1400.00"))
        self.assertEqual(GroupMember.objects.filter(group=group, escrow_status="released").count(), 2)
        self.assertEqual(EscrowLedger.objects.filter(group=group, entry_type="release").count(), 2)
        self.assertEqual(
            Transaction.objects.filter(
                user=self.owner,
                group=group,
                payment_method="group_buy_escrow_release",
                amount=Decimal("400.00"),
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
        self.assertEqual(response.data["error"], "The purchaser cannot confirm access as a member")

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
        self.assertEqual(owner_wallet.balance, Decimal("1400.00"))
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

    def test_health_endpoint_reports_service_readiness(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertEqual(response.data["database"], "ok")
        self.assertIn("payments", response.data)
        self.assertIn("payouts", response.data)
