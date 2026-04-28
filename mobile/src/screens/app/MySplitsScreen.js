import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, radius, shadows, spacing } from "../../theme/tokens";
import { formatCurrency, formatRelativeTime } from "../../utils/formatters";

function SmallStat({ label, value, tone = "primary" }) {
  return (
    <View style={styles.smallStat}>
      <Text style={[styles.smallStatValue, tone === "warm" ? styles.smallStatValueWarm : null]}>
        {value}
      </Text>
      <Text style={styles.smallStatLabel}>{label}</Text>
    </View>
  );
}

function SplitCard({ group, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>{group.mode_label || group.mode}</Text>
        </View>
        <Text style={styles.statusText}>{group.status_label || group.status}</Text>
      </View>

      <Text style={styles.cardTitle}>{group.subscription_name}</Text>
      <Text style={styles.cardMeta}>
        {group.filled_slots || 0}/{group.total_slots || 0} slots filled -{" "}
        {formatCurrency(group.price_per_slot || 0)} per slot
      </Text>

      {group.next_action ? <Text style={styles.nextAction}>{group.next_action}</Text> : null}

      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>
          Revenue {formatCurrency(group.owner_revenue || 0)}
        </Text>
        <Text style={styles.cardFooterTime}>{formatRelativeTime(group.created_at)}</Text>
      </View>
    </Pressable>
  );
}

export default function MySplitsScreen({ navigation }) {
  const { api } = useAuth();
  const [groups, setGroups] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await api.get("my-groups/");
      setGroups(Array.isArray(response.data) ? response.data : []);
      setError("");
    } catch {
      setError("We could not load your hosted splits right now.");
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
    const totalGroups = groups.length;
    const openGroups = groups.filter(
      (group) => !["closed", "refunded", "failed"].includes(group.status)
    ).length;
    const remainingSlots = groups.reduce(
      (sum, group) => sum + Number(group.remaining_slots || 0),
      0
    );
    return { totalGroups, openGroups, remainingSlots };
  }, [groups]);

  return (
    <Screen
      title="My splits"
      subtitle="Track the groups you are hosting and open each one for member details."
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>Hosting summary</Text>
        <View style={styles.statsRow}>
          <SmallStat label="Total" value={String(stats.totalGroups)} />
          <SmallStat label="Open" value={String(stats.openGroups)} />
          <SmallStat label="Slots left" value={String(stats.remainingSlots)} tone="warm" />
        </View>
        <AppButton
          title="Create another split"
          onPress={() => navigation.navigate("CreateSplit")}
          variant="secondary"
        />
      </SectionCard>

      {groups.length ? (
        groups.map((group) => (
          <SplitCard
            key={group.id}
            group={group}
            onPress={() => navigation.navigate("MySplitDetail", { groupId: group.id })}
          />
        ))
      ) : (
        <SectionCard>
          <Text style={styles.emptyTitle}>No hosted splits yet.</Text>
          <Text style={styles.emptyCopy}>
            Create your first sharing or buy-together plan to start inviting members.
          </Text>
          <AppButton title="Create split" onPress={() => navigation.navigate("CreateSplit")} />
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
  smallStat: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: spacing.md,
  },
  smallStatValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  smallStatValueWarm: {
    color: colors.secondary,
  },
  smallStatLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#dff7f2",
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
    lineHeight: 20,
  },
  nextAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  cardFooterText: {
    color: colors.text,
    fontSize: 13,
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
