import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import { Bell, ClipboardList, Compass, MessageSquare, WalletCards, Users } from "../../components/Icons";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, radius, spacing } from "../../theme/tokens";
import { formatCurrency, formatRelativeTime, getGreetingLabel } from "../../utils/formatters";

function MetricPill({ label, value, tone = "primary" }) {
  return (
    <View style={[styles.metricPill, tone === "warm" ? styles.metricPillWarm : null]}>
      <Text style={[styles.metricValue, tone === "warm" ? styles.metricValueWarm : null]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ActionTile({ label, icon: Icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionTile, pressed ? styles.actionTilePressed : null]}>
      <View style={styles.actionIcon}>
        <Icon color={colors.primary} size={24} strokeWidth={2.2} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const { api, user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [profile, setProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const [dashboardResponse, profileResponse] = await Promise.all([
        api.get("dashboard/"),
        api.get("profile/"),
      ]);
      setDashboard(dashboardResponse.data || null);
      setProfile(profileResponse.data || null);
      setError("");
    } catch {
      setError("We could not load your dashboard right now.");
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => dashboard?.groups || [], [dashboard?.groups]);
  const notifications = useMemo(() => dashboard?.notifications || [], [dashboard?.notifications]);
  const displayName =
    profile?.first_name?.trim() || user?.first_name?.trim() || user?.username || "there";

  return (
    <Screen
      title={`${getGreetingLabel()}, ${displayName}`}
      subtitle="A simpler mobile view of your wallet, groups, and next steps."
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <SectionCard style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Wallet snapshot</Text>
        <Text style={styles.heroBalance}>{formatCurrency(profile?.wallet_balance || 0)}</Text>
        <Text style={styles.heroCopy}>
          Spendable balance across cash and referral bonus credit.
        </Text>

        <View style={styles.metricRow}>
          <MetricPill label="Cash" value={formatCurrency(profile?.wallet_cash_balance || 0)} />
          <MetricPill
            label="Bonus"
            value={formatCurrency(profile?.wallet_bonus_balance || 0)}
            tone="warm"
          />
        </View>
      </SectionCard>

      <View style={styles.actionGrid}>
        <ActionTile
          label="Browse"
          onPress={() => navigation.navigate("MarketplaceTab")}
          icon={Compass}
        />
        <ActionTile
          label="Create split"
          onPress={() => navigation.navigate("CreateSplit")}
          icon={Users}
        />
        <ActionTile
          label="My splits"
          onPress={() => navigation.navigate("MySplits")}
          icon={ClipboardList}
        />
        <ActionTile
          label="Joined"
          onPress={() => navigation.navigate("JoinedGroups")}
          icon={Users}
        />
        <ActionTile
          label="Wallet"
          onPress={() => navigation.navigate("WalletTab")}
          icon={WalletCards}
        />
        <ActionTile
          label="Updates"
          onPress={() => navigation.navigate("Notifications")}
          icon={Bell}
        />
        <ActionTile
          label="Chats"
          onPress={() => navigation.navigate("Chats")}
          icon={MessageSquare}
        />
      </View>

      <SectionCard>
        <Text style={styles.sectionTitle}>Active overview</Text>
        <View style={styles.summaryGrid}>
          <MetricPill label="Joined" value={String(profile?.groups_joined || 0)} />
          <MetricPill label="Hosting" value={String(profile?.groups_created || 0)} />
          <MetricPill label="Notifications" value={String(notifications.length)} />
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Recent group activity</Text>
        {groups.length ? (
          groups.slice(0, 4).map((group) => (
            <View key={group.id} style={styles.rowItem}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{group.subscription_name}</Text>
                <Text style={styles.rowMeta}>
                  {group.mode_label} - {group.status_label}
                </Text>
              </View>
              <Text style={styles.rowAmount}>
                {formatCurrency(group.charged_amount || 0)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyCopy}>
            No joined groups yet. The marketplace is ready when you are.
          </Text>
        )}
      </SectionCard>

      <SectionCard>
        <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Latest notifications</Text>
          <View style={styles.sectionHeaderRight}>
            <Bell color={colors.primary} size={18} strokeWidth={2.1} />
            <Text style={styles.sectionLink} onPress={() => navigation.navigate("Notifications")}>
              Open inbox
            </Text>
          </View>
        </View>
        {notifications.length ? (
          notifications.slice(0, 4).map((notification) => (
            <View key={notification.id} style={styles.notificationItem}>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
              <Text style={styles.notificationTime}>
                {formatRelativeTime(notification.created_at)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyCopy}>
            Nothing urgent. Your notifications will land here.
          </Text>
        )}
      </SectionCard>

      <SectionCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Messages</Text>
          <View style={styles.sectionHeaderRight}>
            <MessageSquare color={colors.primary} size={18} strokeWidth={2.1} />
            <Text style={styles.sectionLink} onPress={() => navigation.navigate("Chats")}>
              Open chats
            </Text>
          </View>
        </View>
        <Text style={styles.emptyCopy}>
          Open your hosted and joined group threads from the new mobile chat inbox.
        </Text>
      </SectionCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.night,
    borderColor: colors.night,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroBalance: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "800",
  },
  heroCopy: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    lineHeight: 21,
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  metricPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: spacing.md,
  },
  metricPillWarm: {
    backgroundColor: "rgba(234,88,12,0.14)",
  },
  metricValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  metricValueWarm: {
    color: "#fbbf24",
  },
  metricLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    marginTop: 4,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionTile: {
    width: "48%",
    minHeight: 104,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  actionTilePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dff7f2",
  },
  actionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 6,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  rowAmount: {
    color: colors.night,
    fontSize: 14,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  notificationItem: {
    gap: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notificationMessage: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  notificationTime: {
    color: colors.textMuted,
    fontSize: 12,
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
