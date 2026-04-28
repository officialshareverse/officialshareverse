import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";
import { formatCurrency, formatRelativeTime, formatShortDate } from "../../utils/formatters";

function KeyValue({ label, value, tone = "default" }) {
  return (
    <View style={styles.keyValueRow}>
      <Text style={styles.keyValueLabel}>{label}</Text>
      <Text style={[styles.keyValueValue, tone === "primary" ? styles.keyValuePrimary : null]}>
        {value}
      </Text>
    </View>
  );
}

function MemberRow({ member }) {
  return (
    <View style={styles.memberRow}>
      <View style={styles.memberCopy}>
        <Text style={styles.memberName}>@{member.username}</Text>
        <Text style={styles.memberMeta}>
          {member.has_paid ? "Paid" : "Pending"} -{" "}
          {member.access_confirmed ? "Confirmed" : "Waiting"}
        </Text>
      </View>
      <Text style={styles.memberAmount}>{formatCurrency(member.charged_amount || 0)}</Text>
    </View>
  );
}

export default function MySplitDetailScreen({ route, navigation }) {
  const { api } = useAuth();
  const groupId = route.params?.groupId;
  const [group, setGroup] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!groupId) {
      setError("Missing group id.");
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const response = await api.get(`my-groups/${groupId}/`);
      setGroup(response.data || null);
      setError("");
    } catch {
      setError("We could not load this split right now.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [api, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const inviteLinks = useMemo(() => group?.invite_links || [], [group?.invite_links]);
  const members = useMemo(() => group?.members || [], [group?.members]);

  const handleGenerateInvite = async () => {
    try {
      setInviteLoading(true);
      const response = await api.post("invite/generate/", {
        group_id: groupId,
        expires_in_hours: 72,
      });
      setGroup((current) => ({
        ...(current || {}),
        invite_links: [response.data, ...(current?.invite_links || [])],
      }));
      setError("");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error || "We could not generate an invite link right now."
      );
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading && !group) {
    return (
      <Screen scroll={false}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingCopy}>Loading split details...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={group?.subscription_name || "Split details"}
      subtitle={`${group?.mode_label || "Group"} - ${group?.status_label || group?.status || ""}`}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>Overview</Text>
        <KeyValue
          label="Price per slot"
          value={formatCurrency(group?.price_per_slot || 0)}
          tone="primary"
        />
        <KeyValue
          label="Slots"
          value={`${group?.filled_slots || 0}/${group?.total_slots || 0} filled`}
        />
        <KeyValue label="Start" value={group?.start_date || "-"} />
        <KeyValue label="End" value={group?.end_date || "-"} />
        <KeyValue
          label="Owner revenue"
          value={formatCurrency(group?.owner_revenue || 0)}
          tone="primary"
        />
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Host actions</Text>
        <AppButton
          title={inviteLoading ? "Generating..." : "Generate 72h invite link"}
          onPress={() => void handleGenerateInvite()}
          variant="secondary"
          loading={inviteLoading}
        />
        <AppButton
          title="Back to my splits"
          onPress={() => navigation.navigate("MySplits")}
          variant="secondary"
        />
      </SectionCard>

      {inviteLinks.length ? (
        <SectionCard>
          <Text style={styles.sectionTitle}>Active invite links</Text>
          {inviteLinks.slice(0, 3).map((inviteLink) => (
            <View key={inviteLink.id} style={styles.inviteCard}>
              <Text style={styles.inviteUrl}>{inviteLink.invite_url}</Text>
              <Text style={styles.inviteMeta}>
                {inviteLink.use_count || 0} uses - expires{" "}
                {inviteLink.expires_at ? formatShortDate(inviteLink.expires_at) : "later"}
              </Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      {group?.mode === "sharing" && group?.credentials ? (
        <SectionCard>
          <Text style={styles.sectionTitle}>Access setup</Text>
          <Text style={styles.supportingCopy}>{group.credentials.message}</Text>
        </SectionCard>
      ) : null}

      {group?.mode === "group_buy" ? (
        <SectionCard>
          <Text style={styles.sectionTitle}>Buy-together state</Text>
          <KeyValue label="Held amount" value={formatCurrency(group?.held_amount || 0)} />
          <KeyValue label="Released amount" value={formatCurrency(group?.released_amount || 0)} />
          <KeyValue
            label="Confirmations left"
            value={String(group?.remaining_confirmations || 0)}
          />
          <Text style={styles.supportingCopy}>
            {group?.purchase_proof?.available
              ? `Proof submitted ${formatRelativeTime(group.purchase_proof.submitted_at)}`
              : "Purchase proof has not been submitted yet."}
          </Text>
        </SectionCard>
      ) : null}

      <SectionCard>
        <Text style={styles.sectionTitle}>Members</Text>
        {members.length ? (
          members.map((member) => <MemberRow key={member.id} member={member} />)
        ) : (
          <Text style={styles.supportingCopy}>No members have joined this split yet.</Text>
        )}
      </SectionCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  loadingCopy: {
    color: colors.textMuted,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  keyValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  keyValueLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  keyValueValue: {
    flex: 1,
    textAlign: "right",
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  keyValuePrimary: {
    color: colors.primary,
  },
  inviteCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: 6,
    backgroundColor: colors.surfaceMuted,
  },
  inviteUrl: {
    color: colors.night,
    fontSize: 13,
    fontWeight: "700",
  },
  inviteMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  supportingCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 6,
  },
  memberCopy: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  memberMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  memberAmount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
