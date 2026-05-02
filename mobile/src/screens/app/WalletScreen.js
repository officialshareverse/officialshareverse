import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import AppTextField from "../../components/AppTextField";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, radius, spacing } from "../../theme/tokens";
import { formatCurrency, formatRelativeTime } from "../../utils/formatters";
import { getActionError } from "../../utils/mySplits";

const ACCOUNT_TYPES = [
  { key: "bank_account", label: "Bank account" },
  { key: "vpa", label: "UPI VPA" },
];

const PAYOUT_MODES = [
  { key: "UPI", label: "UPI" },
  { key: "IMPS", label: "IMPS" },
  { key: "NEFT", label: "NEFT" },
  { key: "RTGS", label: "RTGS" },
];

const NATIVE_TOPUP_PRESETS = ["100", "300", "500", "1000"];

function BalanceCard({ label, value, tone = "primary" }) {
  return (
    <View style={[styles.balanceCard, tone === "bonus" ? styles.balanceCardBonus : null]}>
      <Text style={[styles.balanceValue, tone === "bonus" ? styles.balanceValueBonus : null]}>
        {value}
      </Text>
      <Text style={styles.balanceLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active ? styles.filterChipActive : null]}>
      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function PayoutRow({ payout, onSync, syncing }) {
  const isPending = ["queued", "pending", "processing"].includes(String(payout.status || "").toLowerCase());

  return (
    <View style={styles.payoutRow}>
      <View style={styles.payoutCopy}>
        <Text style={styles.payoutTitle}>{formatCurrency(payout.amount || 0)}</Text>
        <Text style={styles.payoutMeta}>
          {payout.destination_label || payout.payout_account_type || "Saved destination"} -{" "}
          {String(payout.status || "").replace(/_/g, " ")}
        </Text>
        <Text style={styles.payoutMeta}>
          Requested {formatRelativeTime(payout.requested_at)}
          {payout.processed_at ? ` | Processed ${formatRelativeTime(payout.processed_at)}` : ""}
        </Text>
        {payout.failure_reason ? (
          <Text style={styles.payoutError}>{payout.failure_reason}</Text>
        ) : null}
      </View>
      {isPending ? (
        <AppButton
          title={syncing ? "Syncing..." : "Sync"}
          onPress={onSync}
          variant="secondary"
          loading={syncing}
          fullWidth={false}
        />
      ) : null}
    </View>
  );
}

export default function WalletScreen({ navigation }) {
  const { api } = useAuth();
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [referral, setReferral] = useState(null);
  const [walletPayments, setWalletPayments] = useState(null);
  const [walletPayoutsConfig, setWalletPayoutsConfig] = useState(null);
  const [payoutAccount, setPayoutAccount] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState("");
  const [accountType, setAccountType] = useState("bank_account");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bankHolderName, setBankHolderName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [confirmBankAccountNumber, setConfirmBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [vpaAddress, setVpaAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutMode, setPayoutMode] = useState("IMPS");
  const [topupAmount, setTopupAmount] = useState("500");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const [profileResponse, transactionResponse, referralResponse, dashboardResponse] = await Promise.all([
        api.get("profile/"),
        api.get("transactions/"),
        api.get("referral/my-code/"),
        api.get("dashboard/"),
      ]);

      const dashboard = dashboardResponse.data || {};
      setProfile(profileResponse.data || null);
      setTransactions(Array.isArray(transactionResponse.data) ? transactionResponse.data : []);
      setReferral(referralResponse.data || null);
      setWalletPayments(dashboard.wallet_payments || null);
      setWalletPayoutsConfig(dashboard.wallet_payouts_config || null);
      setPayoutAccount(dashboard.wallet_payout_account || null);
      setPayouts(Array.isArray(dashboard.wallet_payouts) ? dashboard.wallet_payouts : []);
      setError("");
    } catch {
      setError("We could not load wallet activity right now.");
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!payoutAccount) {
      return;
    }

    setAccountType(payoutAccount.account_type || "bank_account");
    setContactName(payoutAccount.contact_name || "");
    setContactEmail(payoutAccount.contact_email || "");
    setContactPhone(payoutAccount.contact_phone || "");
    setBankHolderName(payoutAccount.bank_account_holder_name || "");
    setBankIfsc(payoutAccount.bank_account_ifsc || "");
    setVpaAddress(payoutAccount.masked_destination || "");
    setPayoutMode(payoutAccount.account_type === "vpa" ? "UPI" : "IMPS");
  }, [payoutAccount]);

  const latestTransactions = useMemo(() => transactions.slice(0, 10), [transactions]);
  const latestPayouts = useMemo(() => payouts.slice(0, 5), [payouts]);

  const openWebWallet = async () => {
    try {
      await Linking.openURL("https://shareverse.in/wallet");
    } catch {
      Alert.alert(
        "Open web wallet",
        "Use the ShareVerse web wallet page if this device cannot open it automatically."
      );
    }
  };

  const handleNativeTopup = async () => {
    try {
      setActionState("topup");
      const response = await api.post("payments/razorpay/create-order/", {
        amount: topupAmount.trim(),
      });
      const checkout = response.data?.checkout;
      if (!checkout) {
        throw new Error("Checkout payload missing from the server response.");
      }
      setError("");
      navigation.navigate("WalletTopupCheckout", {
        checkout,
        topup: response.data?.topup || { amount: topupAmount.trim() },
      });
    } catch (requestError) {
      const message = getActionError(
        requestError?.response?.data,
        requestError?.message || "We could not start the native wallet top-up right now."
      );
      setError(message);
      Alert.alert("Top-up unavailable", message);
    } finally {
      setActionState("");
    }
  };

  const handleSavePayoutAccount = async () => {
    const payload = {
      account_type: accountType,
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim(),
    };

    if (accountType === "bank_account") {
      payload.bank_account_holder_name = bankHolderName.trim();
      payload.bank_account_number = bankAccountNumber.trim();
      payload.confirm_bank_account_number = confirmBankAccountNumber.trim();
      payload.bank_account_ifsc = bankIfsc.trim().toUpperCase();
    } else {
      payload.vpa_address = vpaAddress.trim();
    }

    try {
      setActionState("save_account");
      const response = await api.put("wallet/payout-account/", payload);
      setPayoutAccount(response.data?.payout_account || response.data || null);
      setBankAccountNumber("");
      setConfirmBankAccountNumber("");
      setError("");
      Alert.alert("Saved", response.data?.message || "Your payout destination was saved.");
      await load();
    } catch (requestError) {
      const message = getActionError(
        requestError?.response?.data,
        "We could not save your payout destination right now."
      );
      setError(message);
      Alert.alert("Save failed", message);
    } finally {
      setActionState("");
    }
  };

  const handleWithdraw = async () => {
    try {
      setActionState("withdraw");
      const response = await api.post("withdraw-money/", {
        amount: withdrawAmount.trim(),
        payout_mode: payoutMode,
      });
      setWithdrawAmount("");
      setError("");
      Alert.alert(
        "Withdrawal requested",
        response.data?.message || "Your payout request was created successfully."
      );
      await load();
    } catch (requestError) {
      const message = getActionError(
        requestError?.response?.data,
        "We could not create your withdrawal request right now."
      );
      setError(message);
      Alert.alert("Withdrawal failed", message);
    } finally {
      setActionState("");
    }
  };

  const handleSyncPayout = async (payoutId) => {
    try {
      setActionState(`sync_${payoutId}`);
      const response = await api.post(`wallet/payouts/${payoutId}/sync/`);
      setError("");
      Alert.alert("Payout updated", response.data?.message || "The payout status was refreshed.");
      await load();
    } catch (requestError) {
      const message = getActionError(
        requestError?.response?.data,
        "We could not refresh that payout right now."
      );
      setError(message);
      Alert.alert("Sync failed", message);
    } finally {
      setActionState("");
    }
  };

  return (
    <Screen
      title="Wallet"
      subtitle="Track balances, save your payout destination, and request withdrawals."
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>Balances</Text>
        <View style={styles.balanceGrid}>
          <BalanceCard label="Spendable" value={formatCurrency(profile?.wallet_balance || 0)} />
          <BalanceCard label="Cash" value={formatCurrency(profile?.wallet_cash_balance || 0)} />
          <BalanceCard
            label="Bonus"
            value={formatCurrency(profile?.wallet_bonus_balance || 0)}
            tone="bonus"
          />
        </View>
        <Text style={styles.supportingCopy}>
          Bonus credit comes from referrals and can only be used to join groups.
        </Text>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Wallet actions</Text>
        <Text style={styles.supportingCopy}>
          {walletPayments?.helper_text || "Top up on the web wallet and manage withdrawals here."}
        </Text>
        <View style={styles.chipRow}>
          {NATIVE_TOPUP_PRESETS.map((amount) => (
            <FilterChip
              key={amount}
              label={`Rs ${amount}`}
              active={topupAmount === amount}
              onPress={() => setTopupAmount(amount)}
            />
          ))}
        </View>
        <AppTextField
          label="Top-up amount"
          value={topupAmount}
          onChangeText={setTopupAmount}
          placeholder="Enter amount in INR"
          keyboardType="decimal-pad"
          helper="Start a secure Razorpay checkout directly inside the app."
        />
        <AppButton
          title={actionState === "topup" ? "Starting Razorpay..." : "Top up natively"}
          onPress={() => void handleNativeTopup()}
          loading={actionState === "topup"}
          disabled={!walletPayments?.topup_enabled}
        />
        <AppButton title="Open web wallet" onPress={() => void openWebWallet()} variant="secondary" />
        <Text style={styles.supportingMeta}>
          Payout mode: {walletPayoutsConfig?.mode_label || "Manual review payouts"}
        </Text>
        <Text style={styles.supportingCopy}>
          {walletPayoutsConfig?.helper_text || "Save a destination and withdraw from the balance shown above."}
        </Text>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Payout destination</Text>
        <View style={styles.chipRow}>
          {ACCOUNT_TYPES.map((item) => (
            <FilterChip
              key={item.key}
              label={item.label}
              active={accountType === item.key}
              onPress={() => {
                setAccountType(item.key);
                setPayoutMode(item.key === "vpa" ? "UPI" : "IMPS");
              }}
            />
          ))}
        </View>
        {payoutAccount?.masked_destination ? (
          <Text style={styles.supportingMeta}>
            Current destination: {payoutAccount.masked_destination}
          </Text>
        ) : null}
        {payoutAccount?.last_error ? (
          <Text style={styles.payoutError}>Last payout account issue: {payoutAccount.last_error}</Text>
        ) : null}

        <AppTextField
          label="Contact name"
          value={contactName}
          onChangeText={setContactName}
          placeholder="Who should payouts be addressed to?"
          autoCapitalize="words"
        />
        <AppTextField
          label="Contact email"
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="name@example.com"
          keyboardType="email-address"
        />
        <AppTextField
          label="Contact phone"
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Optional phone number"
          keyboardType="phone-pad"
        />

        {accountType === "bank_account" ? (
          <>
            <AppTextField
              label="Account holder name"
              value={bankHolderName}
              onChangeText={setBankHolderName}
              placeholder="Full bank account holder name"
              autoCapitalize="words"
            />
            <AppTextField
              label="Bank account number"
              value={bankAccountNumber}
              onChangeText={setBankAccountNumber}
              placeholder="Enter the full account number"
              keyboardType="number-pad"
              helper={
                payoutAccount?.bank_account_last4
                  ? `Saved account ends with ${payoutAccount.bank_account_last4}. Re-enter the full number only when updating it.`
                  : "Use numbers only."
              }
            />
            <AppTextField
              label="Confirm account number"
              value={confirmBankAccountNumber}
              onChangeText={setConfirmBankAccountNumber}
              placeholder="Re-enter the account number"
              keyboardType="number-pad"
            />
            <AppTextField
              label="IFSC code"
              value={bankIfsc}
              onChangeText={setBankIfsc}
              placeholder="ABCD0123456"
              autoCapitalize="characters"
            />
          </>
        ) : (
          <AppTextField
            label="UPI VPA"
            value={vpaAddress}
            onChangeText={setVpaAddress}
            placeholder="name@bank"
            autoCapitalize="none"
            helper="Enter the UPI address where withdrawals should land."
          />
        )}

        <AppButton
          title={actionState === "save_account" ? "Saving..." : "Save payout destination"}
          onPress={() => void handleSavePayoutAccount()}
          loading={actionState === "save_account"}
        />
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Withdraw balance</Text>
        <Text style={styles.supportingCopy}>
          Available to withdraw: {formatCurrency(profile?.wallet_balance || 0)}
        </Text>
        <AppTextField
          label="Amount"
          value={withdrawAmount}
          onChangeText={setWithdrawAmount}
          placeholder="Enter amount in INR"
          keyboardType="decimal-pad"
        />
        <View style={styles.chipRow}>
          {PAYOUT_MODES.map((item) => (
            <FilterChip
              key={item.key}
              label={item.label}
              active={payoutMode === item.key}
              onPress={() => setPayoutMode(item.key)}
            />
          ))}
        </View>
        <AppButton
          title={actionState === "withdraw" ? "Requesting..." : "Request withdrawal"}
          onPress={() => void handleWithdraw()}
          loading={actionState === "withdraw"}
        />
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Recent payouts</Text>
        {latestPayouts.length ? (
          latestPayouts.map((payout) => (
            <PayoutRow
              key={payout.id}
              payout={payout}
              syncing={actionState === `sync_${payout.id}`}
              onSync={() => void handleSyncPayout(payout.id)}
            />
          ))
        ) : (
          <Text style={styles.supportingCopy}>
            Withdrawal requests will show up here after your first payout.
          </Text>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Referral snapshot</Text>
        <Text style={styles.supportingCopy}>
          Code: {referral?.code || "Loading..."} | Successful referrals: {referral?.successful_referrals || 0}
        </Text>
        <AppButton
          title="Open referral page"
          onPress={() => navigation.navigate("Referral")}
          variant="secondary"
        />
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Recent transactions</Text>
        {latestTransactions.length ? (
          latestTransactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionRow}>
              <View style={styles.transactionCopy}>
                <Text style={styles.transactionTitle}>{transaction.title}</Text>
                <Text style={styles.transactionMeta}>
                  {transaction.description} | {formatRelativeTime(transaction.created_at)}
                </Text>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  transaction.type === "credit" ? styles.creditAmount : styles.debitAmount,
                ]}
              >
                {transaction.type === "credit" ? "+" : "-"}
                {formatCurrency(transaction.amount)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.supportingCopy}>
            Transactions will start showing up after your first wallet move or group join.
          </Text>
        )}
      </SectionCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  balanceGrid: {
    gap: spacing.md,
  },
  balanceCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: spacing.md,
  },
  balanceCardBonus: {
    backgroundColor: "#fff3e7",
  },
  balanceValue: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "800",
  },
  balanceValueBonus: {
    color: colors.secondary,
  },
  balanceLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  supportingCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  supportingMeta: {
    color: colors.night,
    fontSize: 13,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  payoutRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  payoutCopy: {
    gap: 4,
  },
  payoutTitle: {
    color: colors.night,
    fontSize: 15,
    fontWeight: "800",
  },
  payoutMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  payoutError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 8,
  },
  transactionCopy: {
    flex: 1,
    gap: 4,
  },
  transactionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  transactionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: "800",
  },
  creditAmount: {
    color: colors.success,
  },
  debitAmount: {
    color: colors.night,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
