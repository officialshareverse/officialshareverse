import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import { MessageSquare, UserRound } from "../../components/Icons";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";
import { formatRelativeTime, getInitials } from "../../utils/formatters";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "hosted", label: "Hosted" },
  { key: "joined", label: "Joined" },
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

function formatTypingState(activeTypingUsers) {
  const usernames = (Array.isArray(activeTypingUsers) ? activeTypingUsers : [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.username))
    .filter(Boolean);

  if (!usernames.length) {
    return "";
  }
  if (usernames.length === 1) {
    return `${usernames[0]} is typing...`;
  }
  return `${usernames[0]} and ${usernames.length - 1} more are typing...`;
}

export default function ChatsScreen({ navigation }) {
  const { api } = useAuth();
  const [chatData, setChatData] = useState({ total_chats: 0, total_unread_count: 0, chats: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await api.get("group-chats/");
      setChatData({
        total_chats: Number(response.data?.total_chats || 0),
        total_unread_count: Number(response.data?.total_unread_count || 0),
        chats: Array.isArray(response.data?.chats) ? response.data.chats : [],
      });
      setError("");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "We could not load your chats right now.");
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredChats = useMemo(() => {
    return chatData.chats.filter((chat) => {
      if (filter === "all") {
        return true;
      }
      if (filter === "unread") {
        return Number(chat.unread_chat_count || 0) > 0;
      }
      if (filter === "hosted") {
        return Boolean(chat.is_owner);
      }
      if (filter === "joined") {
        return !chat.is_owner;
      }
      return true;
    });
  }, [chatData.chats, filter]);

  const hostedCount = useMemo(
    () => chatData.chats.filter((chat) => chat.is_owner).length,
    [chatData.chats]
  );

  return (
    <Screen
      title="Chats"
      subtitle="Open group threads, catch unread replies, and jump back into the latest discussion."
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <SectionCard>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.sectionTitle}>Chat overview</Text>
            <Text style={styles.sectionCopy}>
              Hosted and joined group conversations stay in one place on mobile.
            </Text>
          </View>
          <MessageSquare color={colors.primary} size={20} strokeWidth={2.1} />
        </View>

        <View style={styles.metricGrid}>
          <SummaryMetric label="Total" value={String(chatData.total_chats || 0)} />
          <SummaryMetric
            label="Unread"
            value={String(chatData.total_unread_count || 0)}
            tone="highlight"
          />
          <SummaryMetric label="Hosted" value={String(hostedCount)} />
        </View>
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
        <Text style={styles.sectionTitle}>Your conversations</Text>
        {filteredChats.length ? (
          filteredChats.map((chat) => {
            const group = chat.group || {};
            const typingState = formatTypingState(chat.active_typing_users);
            const lastMessage = chat.last_message;
            const title = group.subscription_name || group.subscription?.name || "ShareVerse group";
            return (
              <Pressable
                key={group.id}
                onPress={() =>
                  navigation.navigate("GroupChat", {
                    groupId: group.id,
                    groupPreview: group,
                  })
                }
                style={styles.chatCard}
              >
                <View style={styles.chatTopRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(title)}</Text>
                  </View>
                  <View style={styles.chatCopy}>
                    <View style={styles.chatTitleRow}>
                      <Text style={styles.chatTitle}>{title}</Text>
                      {Number(chat.unread_chat_count || 0) > 0 ? (
                        <View style={styles.unreadPill}>
                          <Text style={styles.unreadPillText}>{chat.unread_chat_count}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.chatMeta}>
                      {chat.is_owner ? "Hosted by you" : `Hosted by @${group.owner_username || "shareverse"}`}
                    </Text>
                  </View>
                </View>

                {typingState ? <Text style={styles.typingState}>{typingState}</Text> : null}

                <View style={styles.messageRow}>
                  <Text style={styles.messagePreview} numberOfLines={2}>
                    {lastMessage?.message || "No messages yet. Start the conversation from mobile."}
                  </Text>
                  <Text style={styles.messageTime}>
                    {formatRelativeTime(lastMessage?.created_at || chat.last_activity_at)}
                  </Text>
                </View>

                <View style={styles.chatFooter}>
                  <Text style={styles.participantMeta}>
                    {chat.online_participant_count || 0} online · {chat.participant_count || 0} in this chat
                  </Text>
                  <View style={styles.rolePill}>
                    <UserRound color={colors.primary} size={14} strokeWidth={2.1} />
                    <Text style={styles.rolePillText}>{chat.is_owner ? "Host" : "Member"}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.emptyCopy}>No chats match this view right now.</Text>
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
    backgroundColor: "#efe8ff",
  },
  metricValue: {
    color: colors.night,
    fontSize: 20,
    fontWeight: "800",
  },
  metricValueHighlight: {
    color: "#6d28d9",
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
    backgroundColor: colors.night,
    borderColor: colors.night,
  },
  filterLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  filterLabelActive: {
    color: "#ffffff",
  },
  chatCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 10,
  },
  chatTopRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.night,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  chatCopy: {
    flex: 1,
    gap: 3,
  },
  chatTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chatTitle: {
    flex: 1,
    color: colors.night,
    fontSize: 16,
    fontWeight: "800",
  },
  unreadPill: {
    minWidth: 24,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  unreadPillText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  chatMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  typingState: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  messageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  messagePreview: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  messageTime: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chatFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  participantMeta: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rolePillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
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
