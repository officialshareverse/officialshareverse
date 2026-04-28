import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, Share, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import { MessageSquare } from "../../components/Icons";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";
import { formatCurrency, formatRelativeTime, formatShortDate } from "../../utils/formatters";
import {
  canCloseSplit,
  canDeleteSplit,
  getActionError,
  getLifecycleNote,
} from "../../utils/mySplits";

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
  const [actionState, setActionState] = useState("");
  const [revealingCredentials, setRevealingCredentials] = useState(false);
  const [revealedCredentials, setRevealedCredentials] = useState(null);
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
  const latestInvite = useMemo(() => inviteLinks[0] || null, [inviteLinks]);
  const lifecycleNote = useMemo(() => getLifecycleNote(group), [group]);

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

  const confirmHostAction = (title, message, onConfirm, destructive = false) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: destructive ? "Continue" : "Confirm",
        style: destructive ? "destructive" : "default",
        onPress: () => {
          void onConfirm();
        },
      },
    ]);
  };

  const runHostAction = async (busyKey, request, fallbackMessage, options = {}) => {
    try {
      setActionState(busyKey);
      const response = await request();
      setError("");

      if (options.goBackOnSuccess) {
        Alert.alert("Done", response?.data?.message || fallbackMessage, [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]);
        return;
      }

      if (options.afterSuccess) {
        options.afterSuccess(response);
      }

      await load();
      Alert.alert("Done", response?.data?.message || fallbackMessage);
    } catch (requestError) {
      const message = getActionError(requestError?.response?.data, fallbackMessage);
      setError(message);
      Alert.alert("Could not complete action", message);
    } finally {
      setActionState("");
    }
  };

  const handleShareLatestInvite = async () => {
    if (!latestInvite?.invite_url) {
      Alert.alert("Invite link not ready", "Generate an invite link first, then share it.");
      return;
    }

    try {
      await Share.share({
        title: `${group?.subscription_name || "ShareVerse"} invite`,
        message: latestInvite.invite_url,
      });
    } catch {
      // Native share sheets can be dismissed normally.
    }
  };

  const handleRevealCredentials = async () => {
    try {
      setRevealingCredentials(true);
      const tokenResponse = await api.post("credentials/request-reveal/", {
        group_id: groupId,
      });
      const revealResponse = await api.post("credentials/reveal/", {
        reveal_token: tokenResponse.data?.reveal_token,
      });
      setRevealedCredentials(revealResponse.data || null);
      setError("");
      Alert.alert("Credentials revealed", "The current login details are now shown on this screen.");
    } catch (requestError) {
      const message = getActionError(
        requestError?.response?.data,
        "We could not reveal the credentials right now."
      );
      setError(message);
      Alert.alert("Reveal failed", message);
    } finally {
      setRevealingCredentials(false);
    }
  };

  const handleActivateGroup = () => {
    confirmHostAction(
      "Release held funds?",
      "This activates the split and releases the held member contributions.",
      async () => {
        await runHostAction(
          "activate",
          () => api.post(`my-groups/${groupId}/activate/`),
          "The split is now active."
        );
      }
    );
  };

  const handleRefundGroup = () => {
    confirmHostAction(
      "Refund held funds?",
      "This returns all held contributions to members and cannot be undone.",
      async () => {
        await runHostAction(
          "refund",
          () => api.post(`my-groups/${groupId}/refund/`),
          "Held member funds were refunded successfully."
        );
      },
      true
    );
  };

  const handleCloseGroup = () => {
    confirmHostAction(
      "Close this split?",
      "Closing stops new joins but keeps the split in your records.",
      async () => {
        await runHostAction(
          "close",
          () => api.post(`my-groups/${groupId}/close/`),
          "The split was closed successfully."
        );
      }
    );
  };

  const handleDeleteGroup = () => {
    confirmHostAction(
      "Delete this split?",
      "Only empty splits can be deleted, and this permanently removes it.",
      async () => {
        await runHostAction(
          "delete",
          () => api.delete(`my-groups/${groupId}/`),
          "The split was deleted successfully.",
          { goBackOnSuccess: true }
        );
      },
      true
    );
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

      <SectionCard style={styles.noteCard}>
        <Text style={styles.noteEyebrow}>Lifecycle note</Text>
        <Text style={styles.supportingCopy}>{lifecycleNote}</Text>
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
          title="Open split chat"
          onPress={() => navigation.navigate("GroupChat", { groupId })}
          variant="secondary"
          icon={MessageSquare}
        />
        {latestInvite?.invite_url ? (
          <AppButton
            title="Share latest invite link"
            onPress={() => void handleShareLatestInvite()}
            variant="secondary"
          />
        ) : null}
        {group?.mode === "sharing" && group?.credentials?.available ? (
          <AppButton
            title={revealingCredentials ? "Revealing..." : "Reveal credentials once"}
            onPress={() => void handleRevealCredentials()}
            variant="secondary"
            loading={revealingCredentials}
          />
        ) : null}
        {group?.can_activate ? (
          <AppButton
            title={actionState === "activate" ? "Releasing..." : "Release held funds"}
            onPress={handleActivateGroup}
            loading={actionState === "activate"}
          />
        ) : null}
        {group?.can_refund ? (
          <AppButton
            title={actionState === "refund" ? "Refunding..." : "Refund held member funds"}
            onPress={handleRefundGroup}
            variant="secondary"
            loading={actionState === "refund"}
          />
        ) : null}
        {canCloseSplit(group) ? (
          <AppButton
            title={actionState === "close" ? "Closing..." : "Close split"}
            onPress={handleCloseGroup}
            variant="secondary"
            loading={actionState === "close"}
          />
        ) : null}
        {canDeleteSplit(group) ? (
          <AppButton
            title={actionState === "delete" ? "Deleting..." : "Delete split"}
            onPress={handleDeleteGroup}
            variant="secondary"
            loading={actionState === "delete"}
          />
        ) : null}
        {group?.can_submit_proof ? (
          <Text style={styles.helperCallout}>
            Purchase proof upload still needs the web dashboard for now.
          </Text>
        ) : null}
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

      {revealedCredentials ? (
        <SectionCard>
          <Text style={styles.sectionTitle}>Current credentials</Text>
          <View style={styles.credentialCard}>
            <Text style={styles.credentialLabel}>Login</Text>
            <Text style={styles.credentialValue}>
              {revealedCredentials.login_identifier || "-"}
            </Text>
            <Text style={styles.credentialLabel}>Password</Text>
            <Text style={styles.credentialValue}>{revealedCredentials.password || "-"}</Text>
            {revealedCredentials.notes ? (
              <>
                <Text style={styles.credentialLabel}>Notes</Text>
                <Text style={styles.supportingCopy}>{revealedCredentials.notes}</Text>
              </>
            ) : null}
          </View>
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
  noteCard: {
    backgroundColor: "#eefaf7",
  },
  noteEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
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
  helperCallout: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  credentialCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: 6,
    backgroundColor: colors.surfaceMuted,
  },
  credentialLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  credentialValue: {
    color: colors.night,
    fontSize: 14,
    fontWeight: "800",
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
