import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";
import { formatCurrency, formatRelativeTime } from "../../utils/formatters";

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

export default function WalletScreen({ navigation }) {
  const { api } = useAuth();
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [referral, setReferral] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const [profileResponse, transactionResponse, referralResponse] = await Promise.all([
        api.get("profile/"),
        api.get("transactions/"),
        api.get("referral/my-code/"),
      ]);
      setProfile(profileResponse.data || null);
      setTransactions(Array.isArray(transactionResponse.data) ? transactionResponse.data : []);
      setReferral(referralResponse.data || null);
      setError("");
    } catch {
      setError("We could not load wallet activity right now.");
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const latestTransactions = useMemo(() => transactions.slice(0, 10), [transactions]);

  return (
    <Screen
      title="Wallet"
      subtitle="Track spendable balance, cash, bonus credit, and recent activity."
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
        <Text style={styles.sectionTitle}>Referral snapshot</Text>
        <Text style={styles.supportingCopy}>
          Code: {referral?.code || "Loading..."} - Successful referrals:{" "}
          {referral?.successful_referrals || 0}
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
                  {transaction.description} - {formatRelativeTime(transaction.created_at)}
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
