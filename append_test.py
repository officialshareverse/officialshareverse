import os

filepath = r'C:\Users\ACER\mystartup\backend\core\tests.py'
test_code = """

class RestoreWalletForFailedPayoutTest(APITestCase):
    \"\"\"
    A11 regression test: restore_wallet_for_failed_payout must use
    update_fields=["balance"] (or an F-expression update) so it doesn't
    clobber a concurrently-written bonus_balance.

    Before the fix, the function called wallet.save() with no
    update_fields, which wrote every column on the Wallet row. If the
    in-memory wallet instance was stale on bonus_balance (e.g., a
    referral reward landed in a different transaction), the bare save
    would silently overwrite the new bonus_balance with the stale value.
    \"\"\"

    def setUp(self):
        from core.models import User, Wallet, WalletPayout, PayoutAccount
        from decimal import Decimal

        self.user = User.objects.create_user(
            username="payoutuser2@example.com",
            password="testpass123",
            email="payoutuser2@example.com",
        )
        # Wallet is auto-created via post_save signal, but fetch it
        # explicitly so we have a handle.
        self.wallet, _ = Wallet.objects.get_or_create(user=self.user)
        self.wallet.balance = Decimal("500.00")
        self.wallet.bonus_balance = Decimal("0.00")
        self.wallet.save(update_fields=["balance", "bonus_balance"])

        # Minimal payout account + payout in a "failed" state.
        self.payout_account = PayoutAccount.objects.create(
            user=self.user,
            account_type="upi",
            vpa_handle="payoutuser2@upi",
            is_verified=True,
        )
        self.payout = WalletPayout.objects.create(
            user=self.user,
            payout_account=self.payout_account,
            amount=Decimal("200.00"),
            status="failed",
            provider="razorpayx",
            provider_payout_id="rpout_fake123",
        )

    def test_restore_credits_balance(self):
        \"\"\"Restore should add the payout amount back to wallet.balance.\"\"\"
        from core.views.common import restore_wallet_for_failed_payout
        from decimal import Decimal

        result = restore_wallet_for_failed_payout(self.payout)
        self.assertTrue(result)

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("700.00"))

    def test_restore_does_not_clobber_concurrent_bonus_balance(self):
        \"\"\"
        Simulate a concurrent referral reward that lands between the
        restore's select_for_update and its save. Before the fix, the bare
        save() would overwrite the new bonus_balance with the stale
        in-memory value (0.00).
        \"\"\"
        from core.views.common import restore_wallet_for_failed_payout
        from decimal import Decimal
        from core.models import Wallet

        # Simulate the concurrent bonus award by directly updating
        # bonus_balance in a separate query (bypassing the in-memory
        # wallet instance the restore function will use).
        Wallet.objects.filter(pk=self.wallet.pk).update(bonus_balance=Decimal("100.00"))

        result = restore_wallet_for_failed_payout(self.payout)
        self.assertTrue(result)

        self.wallet.refresh_from_db()
        # Balance must be 500 + 200 = 700
        self.assertEqual(self.wallet.balance, Decimal("700.00"))
        # Bonus balance must be PRESERVED at 100.00, not clobbered to 0.00.
        self.assertEqual(
            self.wallet.bonus_balance,
            Decimal("100.00"),
            "restore_wallet_for_failed_payout must not overwrite bonus_balance",
        )

    def test_restore_is_idempotent(self):
        \"\"\"Calling restore twice must not double-credit the wallet.\"\"\"
        from core.views.common import restore_wallet_for_failed_payout
        from decimal import Decimal

        first = restore_wallet_for_failed_payout(self.payout)
        self.assertTrue(first)

        # Reload the payout to pick up wallet_restored_at.
        self.payout.refresh_from_db()
        second = restore_wallet_for_failed_payout(self.payout)
        self.assertFalse(second, "Second restore must be a no-op")

        self.wallet.refresh_from_db()
        # Balance must be 500 + 200 = 700, NOT 900.
        self.assertEqual(self.wallet.balance, Decimal("700.00"))

    def test_restore_creates_refund_transaction(self):
        \"\"\"Restore must create exactly one 'wallet_payout_reversal' credit transaction.\"\"\"
        from core.views.common import restore_wallet_for_failed_payout
        from core.models import Transaction

        restore_wallet_for_failed_payout(self.payout)

        reversal_txs = Transaction.objects.filter(
            user=self.user,
            payment_method="wallet_payout_reversal",
            type="credit",
            status="success",
            amount__gte=0,
        )
        self.assertEqual(reversal_txs.count(), 1)
        self.assertEqual(reversal_txs.first().amount, self.payout.amount)
"""

with open(filepath, 'a', encoding='utf-8') as f:
    f.write(test_code)

print('Test appended successfully.')
