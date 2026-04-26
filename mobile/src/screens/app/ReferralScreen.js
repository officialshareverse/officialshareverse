import { useCallback, useEffect, useState } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";
import { formatCurrency, formatRelativeTime } from "../../utils/formatters";

function ReferralMetric({ label, value }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function ReferralScreen() {
  const { api } = useAuth();
  const [referral, setReferral] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await api.get("referral/my-code/");
      setReferral(response.data || null);
      setLoadingMessage("");
    } catch {
      setLoadingMessage("We could not load referral details right now.");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleShare = async () => {
    if (!referral?.code) {
      return;
    }

    try {
      await Share.share({
        message: `Sign up on ShareVerse with my referral code ${referral.code} and join your first eligible group to unlock bonus credit.`,
      });
    } catch {
      Alert.alert("Share unavailable", "The share sheet could not open right now.");
    }
  };

  return (
    <Screen
      title="Refer and earn"
      subtitle="Invite people into ShareVerse and track who completes their first eligible join."
    >
      <SectionCard>
        <Text style={styles.codeLabel}>Your referral code</Text>
        <Text style={styles.codeValue}>{referral?.code || "Loading..."}</Text>
        <Text style={styles.supportingCopy}>
          Referral rewards arrive as bonus credit and can only be used to join groups.
        </Text>
        <AppButton title="Share referral code" onPress={() => void handleShare()} />
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.metricGrid}>
          <ReferralMetric label="Total referrals" value={String(referral?.total_referrals || 0)} />
          <ReferralMetric
            label="Successful"
            value={String(referral?.successful_referrals || 0)}
          />
          <ReferralMetric
            label="Rewards earned"
            value={formatCurrency(referral?.total_rewards_earned || 0)}
          />
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Referral activity</Text>
        {referral?.referrals?.length ? (
          referral.referrals.map((entry) => (
            <View key={entry.id} style={styles.referralRow}>
              <View style={styles.referralCopy}>
                <Text style={styles.referralName}>@{entry.referred_username}</Text>
                <Text style={styles.referralMeta}>
                  {entry.status} - {formatRelativeTime(entry.created_at)}
                </Text>
              </View>
              <Text style={styles.referralAmount}>
                {entry.reward_given ? formatCurrency(entry.reward_amount || 0) : "Pending"}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.supportingCopy}>
            Your first referral will appear here once someone signs up with your code.
          </Text>
        )}
      </SectionCard>

      {loadingMessage ? <Text style={styles.error}>{loadingMessage}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  codeValue: {
    color: colors.night,
    fontSize: 32,
    fontWeight: "800",
  },
  supportingCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  metricGrid: {
    gap: spacing.md,
  },
  metricCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: spacing.md,
  },
  metricValue: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "800",
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  referralRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 8,
  },
  referralCopy: {
    flex: 1,
    gap: 4,
  },
  referralName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  referralMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  referralAmount: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
