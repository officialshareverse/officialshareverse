import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import { Bell, CheckCircle2 } from "../../components/Icons";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";
import { formatRelativeTime } from "../../utils/formatters";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "groups", label: "Groups" },
  { key: "wallet", label: "Wallet" },
  { key: "system", label: "System" },
  { key: "unread", label: "Unread" },
];

function SummaryMetric({ label, value, tone = "default" }) {
  return (
    <View style={[styles.metricCard, tone === "highlight" ? styles.metricCardHighlight : null]}>
      <Text style={[styles.metricValue, tone === "highlight" ? styles.metricValueHighlight : null]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const { api } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [workingId, setWorkingId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await api.get("notifications/");
      setNotifications(Array.isArray(response.data) ? response.data : []);
      setError("");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "We could not load notifications right now.");
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () =>
      notifications.reduce(
        (acc, notification) => {
          acc.all += 1;
          if (!notification.is_read) {
            acc.unread += 1;
          }
          if (notification.category === "groups") {
            acc.groups += 1;
          } else if (notification.category === "wallet") {
            acc.wallet += 1;
          } else {
            acc.system += 1;
          }
          return acc;
        },
        { all: 0, unread: 0, groups: 0, wallet: 0, system: 0 }
      ),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (filter === "all") {
        return true;
      }
      if (filter === "unread") {
        return !notification.is_read;
      }
      return notification.category === filter;
    });
  }, [filter, notifications]);

  const markNotificationRead = async (notificationId) => {
    try {
      setWorkingId(notificationId);
      const response = await api.post(`notifications/${notificationId}/read/`);
      const nextNotification = response.data?.notification;
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? nextNotification || { ...notification, is_read: true }
            : notification
        )
      );
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "We could not update this notification.");
    } finally {
      setWorkingId(null);
    }
  };

  const markAllRead = async () => {
    try {
      setWorkingId("all");
      await api.post("notifications/mark-all-read/");
      setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
      setError("");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "We could not mark every notification as read.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <Screen
      title="Notifications"
      subtitle="Group updates, wallet activity, and system messages in one mobile inbox."
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <SectionCard>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.sectionTitle}>Inbox snapshot</Text>
            <Text style={styles.sectionCopy}>
              Keep an eye on unread updates and clear them once you’re caught up.
            </Text>
          </View>
          <Bell color={colors.primary} size={20} strokeWidth={2.1} />
        </View>

        <View style={styles.metricGrid}>
          <SummaryMetric label="All" value={String(counts.all)} />
          <SummaryMetric label="Unread" value={String(counts.unread)} tone="highlight" />
          <SummaryMetric label="Groups" value={String(counts.groups)} />
        </View>

        <AppButton
          title={workingId === "all" ? "Marking all read..." : "Mark all read"}
          onPress={() => void markAllRead()}
          loading={workingId === "all"}
          disabled={counts.unread === 0}
          variant="secondary"
          icon={CheckCircle2}
        />
      </SectionCard>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterLabel, active ? styles.filterLabelActive : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionCard>
        <Text style={styles.sectionTitle}>Latest updates</Text>
        {filteredNotifications.length ? (
          filteredNotifications.map((notification) => (
            <Pressable
              key={notification.id}
              onPress={() => {
                if (!notification.is_read) {
                  void markNotificationRead(notification.id);
                }
              }}
              style={[
                styles.notificationCard,
                notification.is_read ? styles.notificationRead : styles.notificationUnread,
              ]}
            >
              <View style={styles.notificationHeader}>
                <View style={styles.notificationBadgeRow}>
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>
                      {notification.category_label || notification.category || "Update"}
                    </Text>
                  </View>
                  {!notification.is_read ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.notificationTime}>{formatRelativeTime(notification.created_at)}</Text>
              </View>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
              {notification.context_title ? (
                <Text style={styles.notificationContext}>{notification.context_title}</Text>
              ) : null}
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyCopy}>
            Nothing matches this notification view right now.
          </Text>
        )}
      </SectionCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  sectionCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: spacing.md,
  },
  metricCardHighlight: {
    backgroundColor: "#dff7f2",
  },
  metricValue: {
    color: colors.night,
    fontSize: 20,
    fontWeight: "800",
  },
  metricValueHighlight: {
    color: colors.primary,
  },
  metricLabel: {
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
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  filterLabelActive: {
    color: "#ffffff",
  },
  notificationCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
    gap: 10,
  },
  notificationUnread: {
    borderColor: "#cfece7",
    backgroundColor: "#f5fbfa",
  },
  notificationRead: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  notificationBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryPill: {
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  notificationTime: {
    color: colors.textMuted,
    fontSize: 12,
  },
  notificationMessage: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  notificationContext: {
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
