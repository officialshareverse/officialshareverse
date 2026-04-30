import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import AppTextField from "../../components/AppTextField";
import { MessageSquare } from "../../components/Icons";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";
import { formatCurrency, formatRelativeTime } from "../../utils/formatters";
import { getActionError } from "../../utils/mySplits";

function KeyValue({ label, value, tone = "default" }) {
  return (
    <View style={styles.keyValueRow}>
      <Text style={styles.keyValueLabel}>{label}</Text>
      <Text style={[styles.keyValueValue, tone === "primary" ? styles.keyValuePrimary : null]}>{value}</Text>
    </View>
  );
}

function RatingChip({ value, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.ratingChip, active ? styles.ratingChipActive : null]}>
      <Text style={[styles.ratingChipText, active ? styles.ratingChipTextActive : null]}>{value} star</Text>
    </Pressable>
  );
}

function getStatusMessage(group) {
  if (!group) {
    return "";
  }

  if (group.has_reported_access_issue) {
    return "You reported an access issue. Payout stays paused until the host fixes access or refunds the split.";
  }

  if (group.access_confirmation_required) {
    return group.mode === "group_buy"
      ? "The host uploaded purchase proof. Confirm access once you are set up, or report an issue if something is missing."
      : "The host should share subscription access with you privately. Confirm once you receive it.";
  }

  if (group.has_confirmed_access) {
    return "Your confirmation is recorded. This group is fully active on your account.";
  }

  if (group.mode === "group_buy" && group.status === "proof_submitted") {
    return "The group is still collecting confirmations from members before payout is released.";
  }

  return group.pricing_note || "This group is live in your joined activity.";
}

export default function JoinedGroupDetailScreen({ route, navigation }) {
  const { api } = useAuth();
  const groupId = route.params?.groupId;
  const initialGroup = route.params?.group || null;
  const [group, setGroup] = useState(initialGroup);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(!initialGroup);
  const [actionState, setActionState] = useState("");
  const [revealingCredentials, setRevealingCredentials] = useState(false);
  const [revealedCredentials, setRevealedCredentials] = useState(null);
  const [issueDetails, setIssueDetails] = useState("");
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!groupId) {
      setError("Missing group id.");
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const response = await api.get("dashboard/");
      const nextGroups = Array.isArray(response.data?.groups) ? response.data.groups : [];
      const nextGroup = nextGroups.find((item) => item.id === groupId) || null;
      setGroup(nextGroup);
      if (!nextGroup) {
        setError("We could not find this joined group anymore.");
      } else {
        setError("");
      }
    } catch {
      setError("We could not load this group right now.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [api, groupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleRevealCredentials = async () => {
    if (!group) {
      return;
    }

    try {
      setRevealingCredentials(true);
      const tokenResponse = await api.post("credentials/request-reveal/", { group_id: group.id });
      const revealResponse = await api.post("credentials/reveal/", {
        reveal_token: tokenResponse.data?.reveal_token,
      });
      setRevealedCredentials(revealResponse.data || null);
      setError("");
      Alert.alert("Credentials revealed", "The latest login details are now visible on this screen.");
    } catch (requestError) {
      const message = getActionError(
        requestError?.response?.data,
        "We could not reveal the current credentials right now."
      );
      setError(message);
      Alert.alert("Reveal failed", message);
    } finally {
      setRevealingCredentials(false);
    }
  };

  const handleConfirmAccess = () => {
    if (!group) {
      return;
    }

    Alert.alert(
      "Confirm access?",
      "Only confirm once the host has fully set you up. This can release held payout for the host.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm access",
          onPress: async () => {
            try {
              setActionState("confirm");
              const response = await api.post(`groups/${group.id}/confirm-access/`);
              setError("");
              await load();
              Alert.alert("Access confirmed", response.data?.message || "Access was confirmed successfully.");
            } catch (requestError) {
              const message = getActionError(
                requestError?.response?.data,
                "We could not confirm access right now."
              );
              setError(message);
              Alert.alert("Confirmation failed", message);
            } finally {
              setActionState("");
            }
          },
        },
      ]
    );
  };

  const handleReportIssue = async () => {
    if (!group) {
      return;
    }

    const details = issueDetails.trim();
    if (!details) {
      setError("Add a short note before reporting an access issue.");
      return;
    }

    try {
      setActionState("issue");
      const response = await api.post(`groups/${group.id}/report-access-issue/`, {
        details,
      });
      setIssueDetails("");
      setError("");
      await load();
      Alert.alert("Issue reported", response.data?.message || "The issue was reported successfully.");
    } catch (requestError) {
      const message = getActionError(
        requestError?.response?.data,
        "We could not report the issue right now."
      );
      setError(message);
      Alert.alert("Report failed", message);
    } finally {
      setActionState("");
    }
  };

  const handleSubmitRating = async () => {
    if (!group) {
      return;
    }

    try {
      setActionState("rating");
      const response = await api.post(`groups/${group.id}/reviews/`, {
        reviewed_user_id: group.owner_id,
        rating,
        comment: ratingComment.trim(),
      });
      setGroup((current) =>
        current
          ? {
              ...current,
              owner_rating: response.data?.reviewed_user || current.owner_rating,
            }
          : current
      );
      setRatingComment("");
      setError("");
      Alert.alert("Rating saved", response.data?.message || "Your feedback was submitted.");
    } catch (requestError) {
      const message = getActionError(
        requestError?.response?.data,
        "We could not save your rating right now."
      );
      setError(message);
      Alert.alert("Rating failed", message);
    } finally {
      setActionState("");
    }
  };

  const ratingSummary = useMemo(() => group?.owner_rating || null, [group?.owner_rating]);

  if (loading && !group) {
    return (
      <Screen scroll={false}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingCopy}>Loading joined group...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={group?.subscription_name || "Joined group"}
      subtitle={group ? `${group.mode_label} hosted by @${group.owner_name}` : "Joined group details"}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>Overview</Text>
        <KeyValue label="Status" value={group?.status_label || group?.status || "-"} tone="primary" />
        <KeyValue label="You paid" value={formatCurrency(group?.charged_amount || 0)} />
        <KeyValue label="Contribution" value={formatCurrency(group?.contribution_amount || 0)} />
        <KeyValue label="Platform fee" value={formatCurrency(group?.platform_fee_amount || 0)} />
        {group?.mode === "group_buy" ? (
          <KeyValue
            label="Confirmations"
            value={`${group?.confirmed_members || 0} confirmed${group?.remaining_confirmations ? `, ${group.remaining_confirmations} left` : ""}`}
          />
        ) : null}
      </SectionCard>

      <SectionCard style={styles.statusCard}>
        <Text style={styles.sectionTitle}>What happens next</Text>
        <Text style={styles.supportingCopy}>{getStatusMessage(group)}</Text>
        {group?.reported_issues ? (
          <Text style={styles.helperPill}>Reported issues across the group: {group.reported_issues}</Text>
        ) : null}
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Actions</Text>
        <AppButton
          title="Open group chat"
          onPress={() => navigation.navigate("GroupChat", { groupId })}
          variant="secondary"
          icon={MessageSquare}
        />
        {group?.credentials?.requires_one_time_reveal ? (
          <AppButton
            title={revealingCredentials ? "Revealing..." : "Reveal credentials once"}
            onPress={() => void handleRevealCredentials()}
            variant="secondary"
            loading={revealingCredentials}
          />
        ) : null}
        {group?.access_confirmation_required ? (
          <AppButton
            title={actionState === "confirm" ? "Confirming..." : "Confirm access"}
            onPress={handleConfirmAccess}
            loading={actionState === "confirm"}
          />
        ) : null}
      </SectionCard>

      {group?.credentials ? (
        <SectionCard>
          <Text style={styles.sectionTitle}>Access notes</Text>
          <Text style={styles.supportingCopy}>{group.credentials.message}</Text>
        </SectionCard>
      ) : null}

      {revealedCredentials ? (
        <SectionCard>
          <Text style={styles.sectionTitle}>Current credentials</Text>
          <View style={styles.credentialCard}>
            <Text style={styles.credentialLabel}>Login</Text>
            <Text style={styles.credentialValue}>{revealedCredentials.login_identifier || "-"}</Text>
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

      {group?.can_report_access_issue || group?.has_reported_access_issue || group?.status === "disputed" ? (
        <SectionCard>
          <Text style={styles.sectionTitle}>Report an access issue</Text>
          <Text style={styles.supportingCopy}>
            Use this only if the host has not completed setup or the account access is broken.
          </Text>
          <AppTextField
            label="Issue note"
            value={issueDetails}
            onChangeText={setIssueDetails}
            placeholder="Explain what is missing or not working."
            multiline
            helper={
              group?.has_reported_access_issue
                ? "You already reported an issue. Add a fresh note only if support asks you to re-submit."
                : "A short note is enough. The host and payout flow will be updated automatically."
            }
          />
          {group?.can_report_access_issue ? (
            <AppButton
              title={actionState === "issue" ? "Reporting..." : "Report issue"}
              onPress={() => void handleReportIssue()}
              variant="secondary"
              loading={actionState === "issue"}
            />
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard>
        <Text style={styles.sectionTitle}>Rate the host</Text>
        <Text style={styles.supportingCopy}>
          Leave quick feedback after the group experience. You can update it later if needed.
        </Text>
        {ratingSummary ? (
          <Text style={styles.supportingCopy}>
            Current host rating: {Number(ratingSummary.average_rating || 0).toFixed(1)} from{" "}
            {ratingSummary.review_count || 0} review{ratingSummary.review_count === 1 ? "" : "s"}.
          </Text>
        ) : null}
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <RatingChip key={value} value={value} active={rating === value} onPress={() => setRating(value)} />
          ))}
        </View>
        <AppTextField
          label="Comment"
          value={ratingComment}
          onChangeText={setRatingComment}
          placeholder="Optional note about the host or split experience."
          multiline
        />
        <AppButton
          title={actionState === "rating" ? "Saving..." : "Save rating"}
          onPress={() => void handleSubmitRating()}
          variant="secondary"
          loading={actionState === "rating"}
        />
      </SectionCard>

      {group ? (
        <SectionCard>
          <Text style={styles.sectionTitle}>Activity</Text>
          <Text style={styles.supportingCopy}>Joined {formatRelativeTime(group.created_at)}</Text>
          {group.pricing_note ? <Text style={styles.supportingCopy}>{group.pricing_note}</Text> : null}
        </SectionCard>
      ) : null}

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
  statusCard: {
    backgroundColor: "#eefaf7",
  },
  supportingCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  helperPill: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "#dff7f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    alignSelf: "flex-start",
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
  ratingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  ratingChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ratingChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ratingChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  ratingChipTextActive: {
    color: "#ffffff",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
