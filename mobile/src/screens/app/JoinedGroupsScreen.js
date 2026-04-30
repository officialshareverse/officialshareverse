import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "../../auth/AuthProvider";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, radius, shadows, spacing } from "../../theme/tokens";
import { formatCurrency, formatRelativeTime } from "../../utils/formatters";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs action" },
  { key: "sharing", label: "Sharing" },
  { key: "group_buy", label: "Buy together" },
];

function StatCard({ label, value, tone = "primary" }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, tone === "warm" ? styles.statValueWarm : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getActionHint(group) {
  if (group.access_confirmation_required) {
    return group.mode === "group_buy"
      ? "Confirm access or report an issue before payout is released."
      : "Confirm access once the host shares the subscription details.";
  }

  if (group.can_report_access_issue) {
    return "You can report an access issue if the host has not completed setup.";
  }

  if (group.has_reported_access_issue) {
    return "Issue reported. Payout is paused while the host resolves it or refunds the split.";
  }

  if (group.mode === "group_buy" && group.status === "proof_submitted") {
    return "Proof is uploaded. Waiting for the rest of the group to confirm access.";
  }

  return group.pricing_note || `${group.mode_label} group with ${group.owner_name}.`;
}

function JoinedGroupCard({ group, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>{group.mode_label || group.mode}</Text>
        </View>
        <Text style={styles.statusText}>{group.status_label || group.status}</Text>
      </View>

      <Text style={styles.cardTitle}>{group.subscription_name}</Text>
      <Text style={styles.cardMeta}>Hosted by @{group.owner_name || "shareverse"}</Text>

      <View style={styles.metricRow}>
        <Text style={styles.metricText}>You paid {formatCurrency(group.charged_amount || 0)}</Text>
        {group.unread_chat_count ? (
          <Text style={styles.metricPill}>{group.unread_chat_count} new chat</Text>
        ) : null}
      </View>

      {(group.mode === "group_buy" && (group.confirmed_members || group.remaining_confirmations || group.reported_issues)) ? (
        <Text style={styles.confirmationMeta}>
          Confirmed {group.confirmed_members || 0}
          {group.remaining_confirmations ? ` | Remaining ${group.remaining_confirmations}` : ""}
          {group.reported_issues ? ` | Issues ${group.reported_issues}` : ""}
        </Text>
      ) : null}

      <Text style={styles.cardHint}>{getActionHint(group)}</Text>

      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>
          {group.has_confirmed_access ? "Access confirmed" : group.has_reported_access_issue ? "Issue reported" : "Open for details"}
        </Text>
        <Text style={styles.cardFooterTime}>{formatRelativeTime(group.created_at)}</Text>
      </View>
    </Pressable>
  );
}

export default function JoinedGroupsScreen({ navigation }) {
  const { api } = useAuth();
  const [groups, setGroups] = useState([]);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await api.get("dashboard/");
      const nextGroups = Array.isArray(response.data?.groups) ? response.data.groups : [];
      setGroups(nextGroups);
      setError("");
    } catch {
      setError("We could not load your joined groups right now.");
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const stats = useMemo(() => {
    const total = groups.length;
    const needsAction = groups.filter(
      (group) => group.access_confirmation_required || group.can_report_access_issue || group.has_reported_access_issue
    ).length;
    const active = groups.filter((group) => group.status === "active").length;
    return { total, needsAction, active };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    if (filter === "all") {
      return groups;
    }

    if (filter === "needs_action") {
      return groups.filter(
        (group) => group.access_confirmation_required || group.can_report_access_issue || group.has_reported_access_issue
      );
    }

    return groups.filter((group) => group.mode === filter);
  }, [filter, groups]);

  return (
    <Screen
      title="Joined groups"
      subtitle="Track the groups you joined, confirm access, report issues, and rate the host."
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>Member summary</Text>
        <View style={styles.statsRow}>
          <StatCard label="Total" value={String(stats.total)} />
          <StatCard label="Active" value={String(stats.active)} />
          <StatCard label="Needs action" value={String(stats.needsAction)} tone="warm" />
        </View>
      </SectionCard>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Text
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
            >
              {item.label}
            </Text>
          );
        })}
      </View>

      {filteredGroups.length ? (
        filteredGroups.map((group) => (
          <JoinedGroupCard
            key={group.id}
            group={group}
            onPress={() => navigation.navigate("JoinedGroupDetail", { groupId: group.id, group })}
          />
        ))
      ) : (
        <SectionCard>
          <Text style={styles.emptyTitle}>No groups in this view yet.</Text>
          <Text style={styles.emptyCopy}>
            Joined groups from the ShareVerse marketplace will show up here with member actions.
          </Text>
        </SectionCard>
      )}

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
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: spacing.md,
  },
  statValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  statValueWarm: {
    color: colors.secondary,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textMuted,
    paddingHorizontal: 14,
    paddingVertical: 9,
    overflow: "hidden",
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: "#ffffff",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  modeBadge: {
    backgroundColor: "#dff7f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modeBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
    textAlign: "right",
  },
  cardTitle: {
    color: colors.night,
    fontSize: 20,
    fontWeight: "800",
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  metricText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  metricPill: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "#dff7f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  confirmationMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  cardHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  cardFooterText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  cardFooterTime: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyTitle: {
    color: colors.night,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
