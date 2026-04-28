import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import AppTextField from "../../components/AppTextField";
import { MessageSquare, Send, Users } from "../../components/Icons";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";
import { formatRelativeTime, getInitials } from "../../utils/formatters";

function getGroupTitle(group) {
  return group?.subscription_name || group?.subscription?.name || "ShareVerse chat";
}

function getGroupSubtitle(group) {
  if (!group) {
    return "Group chat";
  }

  const statusLabel = group.status_label || group.status || "Active";
  const hostLabel = group.owner_username ? `Host @${group.owner_username}` : "ShareVerse group";
  return `${statusLabel} · ${hostLabel}`;
}

function getTypingState(activeTypingUsers) {
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

function MessageBubble({ item }) {
  return (
    <View style={[styles.messageBubble, item.is_own ? styles.messageBubbleOwn : styles.messageBubblePeer]}>
      <Text style={[styles.messageSender, item.is_own ? styles.messageSenderOwn : null]}>
        {item.is_own ? "You" : item.sender_username}
      </Text>
      <Text style={[styles.messageText, item.is_own ? styles.messageTextOwn : null]}>{item.message}</Text>
      <Text style={[styles.messageTime, item.is_own ? styles.messageTimeOwn : null]}>
        {formatRelativeTime(item.created_at)}
      </Text>
    </View>
  );
}

export default function GroupChatScreen({ route }) {
  const { api } = useAuth();
  const { groupId, groupPreview } = route.params;
  const [detail, setDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const typingStateRef = useRef(false);

  const load = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const response = await api.get(`groups/${groupId}/chat/`);
        const nextDetail = response.data || null;
        setDetail(nextDetail);
        setMessages(Array.isArray(nextDetail?.messages) ? nextDetail.messages : []);
        setError("");
      } catch (requestError) {
        setError(requestError?.response?.data?.error || "We could not load this group chat right now.");
      } finally {
        if (showLoader) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [api, groupId]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void load(false);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [load]);

  const syncTypingState = useCallback(
    async (nextState) => {
      if (typingStateRef.current === nextState) {
        return;
      }

      typingStateRef.current = nextState;
      try {
        await api.patch(`groups/${groupId}/chat/`, { is_typing: nextState });
      } catch {
        // Typing state is best-effort only.
      }
    },
    [api, groupId]
  );

  useEffect(() => {
    void syncTypingState(Boolean(draft.trim()));
  }, [draft, syncTypingState]);

  useEffect(
    () => () => {
      void syncTypingState(false);
    },
    [syncTypingState]
  );

  const handleSend = async () => {
    const message = draft.trim();
    if (!message) {
      return;
    }

    try {
      setSending(true);
      setError("");
      const response = await api.post(`groups/${groupId}/chat/`, { message });
      if (response.data?.chat_message) {
        setMessages((current) => [...current, response.data.chat_message]);
      }
      setDraft("");
      await syncTypingState(false);
      void load(false);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "We could not send this message right now.");
    } finally {
      setSending(false);
    }
  };

  const group = detail?.group || groupPreview || {};
  const participants = useMemo(() => detail?.participants || [], [detail?.participants]);
  const typingState = getTypingState(detail?.active_typing_users);

  if (loading) {
    return (
      <Screen title="Group chat" subtitle="Loading the latest conversation...">
        <SectionCard>
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingCopy}>Loading chat messages...</Text>
          </View>
        </SectionCard>
      </Screen>
    );
  }

  return (
    <Screen
      title={getGroupTitle(group)}
      subtitle={getGroupSubtitle(group)}
      scroll={false}
      contentStyle={styles.screenContent}
    >
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SectionCard>
          <View style={styles.heroRow}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarText}>{getInitials(getGroupTitle(group))}</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{getGroupTitle(group)}</Text>
              <Text style={styles.heroMeta}>
                {(detail?.online_participant_count || 0)} online · {participants.length || detail?.participant_count || 0} participants
              </Text>
            </View>
            <Users color={colors.primary} size={20} strokeWidth={2.1} />
          </View>
          {typingState ? <Text style={styles.typingState}>{typingState}</Text> : null}
        </SectionCard>

        <SectionCard style={styles.messagesCard}>
          <View style={styles.messagesHeader}>
            <Text style={styles.sectionTitle}>Conversation</Text>
            {refreshing ? <Text style={styles.refreshingText}>Refreshing...</Text> : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length ? (
              messages.map((item) => <MessageBubble key={`${item.id}-${item.created_at}`} item={item} />)
            ) : (
              <View style={styles.emptyState}>
                <MessageSquare color={colors.primary} size={22} strokeWidth={2.1} />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyCopy}>
                  Start the conversation from mobile and the rest of the group will see it on ShareVerse.
                </Text>
              </View>
            )}
          </ScrollView>
        </SectionCard>

        <SectionCard>
          <Text style={styles.sectionTitle}>Reply</Text>
          <AppTextField
            label="Message"
            value={draft}
            onChangeText={setDraft}
            placeholder="Send a quick update to the group"
            multiline
          />
          <AppButton
            title={sending ? "Sending..." : "Send message"}
            onPress={() => void handleSend()}
            loading={sending}
            icon={Send}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </SectionCard>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  flexFill: {
    flex: 1,
    gap: spacing.lg,
  },
  loadingState: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  loadingCopy: {
    color: colors.textMuted,
    fontSize: 14,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.night,
  },
  heroAvatarText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: colors.night,
    fontSize: 17,
    fontWeight: "800",
  },
  heroMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  typingState: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  messagesCard: {
    flex: 1,
  },
  messagesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.night,
    fontSize: 17,
    fontWeight: "800",
  },
  refreshingText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  messagesContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  messageBubbleOwn: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  messageBubblePeer: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
  },
  messageSender: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  messageSenderOwn: {
    color: "rgba(255,255,255,0.8)",
  },
  messageText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  messageTextOwn: {
    color: "#ffffff",
  },
  messageTime: {
    color: colors.textMuted,
    fontSize: 11,
  },
  messageTimeOwn: {
    color: "rgba(255,255,255,0.72)",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: 8,
  },
  emptyTitle: {
    color: colors.night,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
