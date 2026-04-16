import hashlib
import hmac
import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .security import decrypt_secret, encrypt_secret, is_encrypted_secret


class User(AbstractUser):
    phone = models.CharField(max_length=15, unique=True, blank=True, null=True)
    trust_score = models.FloatField(default=0)
    is_verified = models.BooleanField(default=False)
    profile_picture = models.ImageField(upload_to="profile-pictures/", blank=True, null=True)

    def __str__(self):
        return self.username


class Subscription(models.Model):
    name = models.CharField(max_length=100, unique=True)
    max_slots = models.IntegerField(default=5)
    category = models.CharField(max_length=50, default="general")
    price = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Group(models.Model):
    PROOF_REVIEW_STATUS_CHOICES = (
        ("not_submitted", "Not Submitted"),
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    )

    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE)

    total_slots = models.IntegerField()
    price_per_slot = models.DecimalField(max_digits=10, decimal_places=2)
    access_identifier = models.CharField(max_length=255, blank=True, default="")
    access_password = models.CharField(max_length=255, blank=True, default="")
    access_notes = models.TextField(blank=True, default="")

    start_date = models.DateField()
    end_date = models.DateField()

    MODE_CHOICES = (
        ("sharing", "Sharing"),
        ("group_buy", "Group Buy"),
    )
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default="sharing")

    STATUS_CHOICES = (
        ("forming", "Forming"),
        ("collecting", "Collecting"),
        ("awaiting_purchase", "Awaiting Purchase"),
        ("proof_submitted", "Proof Submitted"),
        ("disputed", "Disputed"),
        ("purchasing", "Purchasing"),
        ("active", "Active"),
        ("refunding", "Refunding"),
        ("refunded", "Refunded"),
        ("closed", "Closed"),
        ("failed", "Failed"),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="forming")

    is_refunded = models.BooleanField(default=False)
    purchase_deadline_at = models.DateTimeField(null=True, blank=True)
    auto_refund_at = models.DateTimeField(null=True, blank=True)
    purchase_proof = models.FileField(upload_to="purchase-proofs/", blank=True, null=True)
    purchase_reference = models.CharField(max_length=255, blank=True, default="")
    purchase_notes = models.TextField(blank=True, default="")
    proof_submitted_at = models.DateTimeField(null=True, blank=True)
    proof_review_status = models.CharField(
        max_length=20,
        choices=PROOF_REVIEW_STATUS_CHOICES,
        default="not_submitted",
    )
    proof_review_notes = models.TextField(blank=True, default="")
    proof_reviewed_at = models.DateTimeField(null=True, blank=True)
    proof_reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_purchase_proofs",
    )
    funds_released_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.subscription.name} - {self.owner.username} ({self.mode})"

    def set_access_credentials(self, identifier, password, notes=""):
        normalized_identifier = (identifier or "").strip()
        normalized_password = (password or "").strip()
        normalized_notes = (notes or "").strip()

        self.access_identifier = encrypt_secret(normalized_identifier) if normalized_identifier else ""
        self.access_password = encrypt_secret(normalized_password) if normalized_password else ""
        self.access_notes = normalized_notes

    def clear_access_credentials(self):
        self.access_identifier = ""
        self.access_password = ""
        self.access_notes = ""

    def get_access_identifier(self):
        return decrypt_secret(self.access_identifier)

    def get_access_password(self):
        return decrypt_secret(self.access_password)

    def credentials_available(self):
        return bool(self.get_access_identifier() and self.get_access_password())

    def ensure_credentials_encrypted(self):
        current_identifier = self.get_access_identifier()
        current_password = self.get_access_password()
        changed = False

        if current_identifier and not is_encrypted_secret(self.access_identifier):
            self.access_identifier = encrypt_secret(current_identifier)
            changed = True

        if current_password and not is_encrypted_secret(self.access_password):
            self.access_password = encrypt_secret(current_password)
            changed = True

        if not current_identifier and self.access_identifier:
            self.access_identifier = ""
            changed = True

        if not current_password and self.access_password:
            self.access_password = ""
            changed = True

        return changed


class GroupMember(models.Model):
    ESCROW_STATUS_CHOICES = (
        ("held", "Held"),
        ("released", "Released"),
        ("refunded", "Refunded"),
    )

    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, default="member")
    status = models.CharField(max_length=20, default="active")
    joined_at = models.DateTimeField(auto_now_add=True)
    has_paid = models.BooleanField(default=False)
    charged_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    platform_fee_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    escrow_status = models.CharField(max_length=20, choices=ESCROW_STATUS_CHOICES, default="held")
    access_confirmed = models.BooleanField(default=False)
    access_confirmed_at = models.DateTimeField(null=True, blank=True)
    access_issue_reported = models.BooleanField(default=False)
    access_issue_reported_at = models.DateTimeField(null=True, blank=True)
    access_issue_notes = models.TextField(blank=True, default="")
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    refund_processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("group", "user")

    def __str__(self):
        return f"{self.user.username} in {self.group.id}"


class Wallet(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.user.username} Wallet"


class Transaction(models.Model):
    TRANSACTION_TYPE = (
        ("debit", "Debit"),
        ("credit", "Credit"),
    )
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("success", "Success"),
        ("failed", "Failed"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    type = models.CharField(max_length=10, choices=TRANSACTION_TYPE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    payment_method = models.CharField(max_length=50, default="system")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.amount}"


class WalletTopupOrder(models.Model):
    STATUS_CHOICES = (
        ("created", "Created"),
        ("paid", "Paid"),
        ("failed", "Failed"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="wallet_topup_orders")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_subunits = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default="INR")
    provider = models.CharField(max_length=30, default="razorpay")
    receipt = models.CharField(max_length=40, unique=True)
    provider_order_id = models.CharField(max_length=100, unique=True)
    provider_payment_id = models.CharField(max_length=100, blank=True, null=True, unique=True)
    provider_signature = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="created")
    credited_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.user.username} top-up {self.amount} {self.currency}"


class PayoutAccount(models.Model):
    ACCOUNT_TYPE_CHOICES = (
        ("bank_account", "Bank Account"),
        ("vpa", "UPI VPA"),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="payout_account")
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES, default="bank_account")
    contact_name = models.CharField(max_length=120)
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=20, blank=True, default="")
    contact_type = models.CharField(max_length=20, default="customer")
    provider_contact_id = models.CharField(max_length=100, blank=True, default="")
    provider_fund_account_id = models.CharField(max_length=100, blank=True, default="")
    bank_account_holder_name = models.CharField(max_length=120, blank=True, default="")
    bank_account_ifsc = models.CharField(max_length=20, blank=True, default="")
    bank_account_number = models.CharField(max_length=255, blank=True, default="")
    bank_account_last4 = models.CharField(max_length=4, blank=True, default="")
    vpa_address = models.CharField(max_length=255, blank=True, default="")
    vpa_handle = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)
    last_error = models.TextField(blank=True, default="")
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"{self.user.username} payout account ({self.account_type})"

    def set_bank_account_number(self, account_number):
        normalized = (account_number or "").strip()
        self.bank_account_number = encrypt_secret(normalized) if normalized else ""
        self.bank_account_last4 = normalized[-4:] if len(normalized) >= 4 else normalized

    def get_bank_account_number(self):
        return decrypt_secret(self.bank_account_number)

    def set_vpa_address(self, vpa_address):
        normalized = (vpa_address or "").strip().lower()
        self.vpa_address = encrypt_secret(normalized) if normalized else ""
        self.vpa_handle = normalized

    def get_vpa_address(self):
        return decrypt_secret(self.vpa_address)

    def clear_bank_account(self):
        self.bank_account_holder_name = ""
        self.bank_account_ifsc = ""
        self.bank_account_number = ""
        self.bank_account_last4 = ""

    def clear_vpa(self):
        self.vpa_address = ""
        self.vpa_handle = ""

    def get_masked_destination(self):
        if self.account_type == "vpa":
            address = self.get_vpa_address()
            if not address:
                return ""
            username, separator, handle = address.partition("@")
            if not separator:
                return address
            if len(username) <= 2:
                masked_username = "*" * len(username)
            else:
                masked_username = f"{username[:2]}{'*' * max(len(username) - 2, 1)}"
            return f"{masked_username}@{handle}"

        if not self.bank_account_last4:
            return ""
        return f"Account ending {self.bank_account_last4}"


class WalletPayout(models.Model):
    STATUS_CHOICES = (
        ("created", "Created"),
        ("pending", "Pending"),
        ("queued", "Queued"),
        ("processing", "Processing"),
        ("processed", "Processed"),
        ("cancelled", "Cancelled"),
        ("reversed", "Reversed"),
        ("rejected", "Rejected"),
        ("failed", "Failed"),
    )
    MODE_CHOICES = (
        ("UPI", "UPI"),
        ("IMPS", "IMPS"),
        ("NEFT", "NEFT"),
        ("RTGS", "RTGS"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="wallet_payouts")
    payout_account = models.ForeignKey(
        PayoutAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payouts",
    )
    transaction = models.OneToOneField(
        "Transaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wallet_payout",
    )
    refund_transaction = models.OneToOneField(
        "Transaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wallet_payout_refund",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_subunits = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default="INR")
    provider = models.CharField(max_length=30, default="razorpayx")
    provider_payout_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    provider_contact_id = models.CharField(max_length=100, blank=True, default="")
    provider_fund_account_id = models.CharField(max_length=100, blank=True, default="")
    provider_reference_id = models.CharField(max_length=40, unique=True)
    idempotency_key = models.CharField(max_length=80, unique=True)
    source_account_number = models.CharField(max_length=40)
    mode = models.CharField(max_length=10, choices=MODE_CHOICES)
    purpose = models.CharField(max_length=30, default="payout")
    narration = models.CharField(max_length=30, blank=True, default="")
    destination_label = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="created")
    status_details = models.JSONField(default=dict, blank=True)
    failure_reason = models.TextField(blank=True, default="")
    provider_status_source = models.CharField(max_length=80, blank=True, default="")
    utr = models.CharField(max_length=120, blank=True, default="")
    fees = models.PositiveIntegerField(default=0)
    tax = models.PositiveIntegerField(default=0)
    processed_at = models.DateTimeField(null=True, blank=True)
    wallet_restored_at = models.DateTimeField(null=True, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-requested_at", "-id"]

    def __str__(self):
        return f"{self.user.username} payout {self.amount} {self.currency}"


class RazorpayWebhookEvent(models.Model):
    STATUS_CHOICES = (
        ("processed", "Processed"),
        ("ignored", "Ignored"),
        ("failed", "Failed"),
    )

    event_id = models.CharField(max_length=120, unique=True)
    event_type = models.CharField(max_length=80)
    payment_id = models.CharField(max_length=100, blank=True, default="")
    provider_order_id = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="processed")
    notes = models.TextField(blank=True, default="")
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-processed_at", "-id"]

    def __str__(self):
        return f"{self.event_type} ({self.event_id})"


class RazorpayXPayoutWebhookEvent(models.Model):
    STATUS_CHOICES = (
        ("processed", "Processed"),
        ("ignored", "Ignored"),
        ("failed", "Failed"),
    )

    event_id = models.CharField(max_length=120, unique=True)
    event_type = models.CharField(max_length=80)
    payout_id = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="processed")
    notes = models.TextField(blank=True, default="")
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-processed_at", "-id"]

    def __str__(self):
        return f"{self.event_type} ({self.event_id})"


class Review(models.Model):
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="given_reviews")
    reviewed_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_reviews")
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    rating = models.IntegerField()
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("reviewer", "reviewed_user", "group")
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.reviewer.username} -> {self.reviewed_user.username}"


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class JoinRequest(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "group")


class EscrowLedger(models.Model):
    ENTRY_TYPE_CHOICES = (
        ("hold", "Hold"),
        ("release", "Release"),
        ("refund", "Refund"),
    )
    STATUS_CHOICES = (
        ("success", "Success"),
        ("failed", "Failed"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    member = models.ForeignKey(GroupMember, on_delete=models.CASCADE, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    entry_type = models.CharField(max_length=20, choices=ENTRY_TYPE_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="success")
    created_at = models.DateTimeField(auto_now_add=True)


class GroupChatMessage(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="chat_messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.sender.username} in group {self.group_id}"


class GroupChatReadState(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="chat_read_states")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    last_read_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("group", "user")

    def __str__(self):
        return f"{self.user.username} read chat for group {self.group_id}"


class CredentialRevealToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "group", "expires_at"]),
        ]

    @staticmethod
    def build_token_hash(raw_token):
        return hashlib.sha256((raw_token or "").encode("utf-8")).hexdigest()

    def is_usable(self):
        return self.used_at is None and self.expires_at > timezone.now()


class PasswordResetOTP(models.Model):
    CHANNEL_CHOICES = (
        ("phone", "Phone"),
        ("email", "Email"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    otp_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts_remaining = models.PositiveIntegerField(default=5)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "expires_at"]),
        ]

    @staticmethod
    def build_otp_hash(raw_otp):
        return hashlib.sha256((raw_otp or "").encode("utf-8")).hexdigest()

    def verify_otp(self, raw_otp):
        return hmac.compare_digest(self.otp_hash, self.build_otp_hash(raw_otp))

    def is_active(self):
        return not self.is_used and self.expires_at > timezone.now() and self.attempts_remaining > 0


class SignupOTP(models.Model):
    CHANNEL_CHOICES = (
        ("email", "Email"),
        ("phone", "Phone"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=15, blank=True, default="")
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES, default="email")
    otp_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts_remaining = models.PositiveIntegerField(default=5)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @staticmethod
    def build_otp_hash(raw_otp):
        return hashlib.sha256((raw_otp or "").encode("utf-8")).hexdigest()

    def verify_otp(self, raw_otp):
        return hmac.compare_digest(self.otp_hash, self.build_otp_hash(raw_otp))

    def is_active(self):
        return not self.is_used and self.expires_at > timezone.now() and self.attempts_remaining > 0


@receiver(post_save, sender=User)
def create_wallet(sender, instance, created, **kwargs):
    if created:
        Wallet.objects.create(user=instance)
