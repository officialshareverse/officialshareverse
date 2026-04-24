import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import API from "../api/axios";
import Drawer from "../components/Drawer";
import { CheckCircleIcon, ClockIcon } from "../components/UiIcons";
import useWebSocket from "../hooks/useWebSocket";

function formatRelativeTime(value) {
  if (!value) {
    return "Just now";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Just now";
  }

  const deltaMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 7) {
    return `${deltaDays}d ago`;
  }

  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatTypingLabel(usernames) {
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return "";
  }

  if (usernames.length === 1) {
    return `${usernames[0]} is typing...`;
  }

  if (usernames.length === 2) {
    return `${usernames[0]} and ${usernames[1]} are typing...`;
  }

  return `${usernames[0]} and ${usernames.length - 1} others are typing...`;
}

function getPresenceMeta(presence) {
  const status = presence?.status || "offline";
  if (presence?.is_typing) {
    return { className: "is-typing", label: "Typing now" };
  }
  if (status === "online") {
    return { className: "is-online", label: "Online" };
  }
  if (status === "recent") {
    return { className: "is-recent", label: "Active recently" };
  }
  return { className: "is-offline", label: "Offline" };
}

function getAvatarToken(name) {
  return String(name || "ShareVerse")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function mergeChatMessage(messages, nextMessage) {
  const currentMessages = Array.isArray(messages) ? messages : [];
  if (!nextMessage?.id) {
    return currentMessages;
  }
  if (currentMessages.some((item) => item.id === nextMessage.id)) {
    return currentMessages;
  }
  return [...currentMessages, nextMessage].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

function updateChatPresenceState(currentChat, username, nextPresence) {
  if (!currentChat || !Array.isArray(currentChat.participants)) {
    return currentChat;
  }

  const nextParticipants = currentChat.participants.map((participant) =>
    participant.username === username
      ? {
          ...participant,
          presence: {
            ...(participant.presence || {}),
            ...nextPresence,
          },
        }
      : participant
  );

  const activeTypingUsers = nextParticipants
    .filter((participant) => participant.presence?.is_typing && !participant.is_self)
    .map((participant) => participant.username);

  const onlineParticipantCount = nextParticipants.filter(
    (participant) => participant.presence?.is_online
  ).length;

  return {
    ...currentChat,
    participants: nextParticipants,
    active_typing_users: activeTypingUsers,
    has_someone_typing: activeTypingUsers.length > 0,
    online_participant_count: onlineParticipantCount,
  };
}

function ParticipantsSection({ participants }) {
  return (
    <section className="sv-card">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Members</p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">Participants</h2>
      <div className="mt-4 space-y-3">
        {participants.map((participant) => {
          const presenceMeta = getPresenceMeta(participant.presence);

          return (
            <div key={`${participant.role}-${participant.username}`} className="sv-group-chat-participant">
              <div className="flex items-center gap-3">
                <span className={`sv-group-chat-participant-avatar ${presenceMeta.className}`}>
                  {participant.initials || getAvatarToken(participant.username)}
                  <span className={`sv-chat-avatar-chip-dot ${presenceMeta.className}`} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {participant.username}
                    {participant.is_self ? " (you)" : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {presenceMeta.label}
                    {participant.presence?.last_seen_at
                      ? ` - seen ${formatRelativeTime(participant.presence.last_seen_at)}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  {participant.role}
                </span>
                {participant.presence?.is_typing ? (
                  <span className="sv-chat-typing-pill">Typing</span>
                ) : participant.presence?.is_online ? (
                  <span className="sv-chat-live-pill">Live</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QuickReadSection() {
  return (
    <section className="sv-card">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Quick read</p>
      <div className="mt-3 space-y-3">
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <span className="mt-0.5 text-emerald-600">
            <CheckCircleIcon className="h-4.5 w-4.5" />
          </span>
          <p className="text-sm leading-6 text-slate-600">
            Use the live strip to spot when the host or members are active before sending a follow-up.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <span className="mt-0.5 text-slate-500">
            <ClockIcon className="h-4.5 w-4.5" />
          </span>
          <p className="text-sm leading-6 text-slate-600">
            Typing indicators expire quickly, so they stay helpful without getting stuck on old activity.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function GroupChat() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const threadEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const [chat, setChat] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const handleWebSocketMessage = useCallback((event) => {
    if (!event?.type) {
      return;
    }

    if (event.type === "chat_message") {
      setChat((current) => {
        if (!current) {
          return current;
        }

        let nextChat = {
          ...current,
          messages: mergeChatMessage(current.messages, event),
        };

        if (event.sender_username) {
          nextChat = updateChatPresenceState(nextChat, event.sender_username, {
            is_typing: false,
          });
        }

        return nextChat;
      });
      return;
    }

    if (event.type === "typing_update" && event.username) {
      setChat((current) =>
        updateChatPresenceState(current, event.username, {
          is_typing: Boolean(event.is_typing),
        })
      );
      return;
    }

    if ((event.type === "user_joined" || event.type === "user_left") && event.username) {
      setChat((current) => updateChatPresenceState(current, event.username, event.presence || {}));
    }
  }, []);

  const { status: webSocketStatus, sendMessage: sendWebSocketMessage } = useWebSocket(
    `ws/chat/${groupId}/`,
    {
      enabled: Boolean(groupId),
      onMessage: handleWebSocketMessage,
    }
  );

  const fetchChat = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const response = await API.get(`groups/${groupId}/chat/`);
      setChat(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load group chat.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [groupId]);

  const syncPresence = useCallback(async (isTyping) => {
    try {
      if (webSocketStatus === "connected" && sendWebSocketMessage({ type: "typing", is_typing: isTyping })) {
        isTypingRef.current = isTyping;
        return;
      }

      await API.patch(`groups/${groupId}/chat/`, { is_typing: isTyping });
      isTypingRef.current = isTyping;
    } catch (err) {
      console.error("Failed to sync group chat presence:", err);
    }
  }, [groupId, sendWebSocketMessage, webSocketStatus]);

  useEffect(() => {
    void fetchChat(true);
  }, [fetchChat]);

  useEffect(() => {
    if (webSocketStatus === "connected") {
      sendWebSocketMessage({ type: "mark_read" });
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void fetchChat(false);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchChat, sendWebSocketMessage, webSocketStatus]);

  useEffect(() => {
    return () => {
      window.clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) {
        if (webSocketStatus === "connected") {
          sendWebSocketMessage({ type: "typing", is_typing: false });
        } else {
          void API.patch(`groups/${groupId}/chat/`, { is_typing: false }).catch(() => {});
        }
      }
    };
  }, [groupId, sendWebSocketMessage, webSocketStatus]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (event) => setIsMobile(event.matches);
    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileDrawerOpen(false);
    }
  }, [isMobile]);

  const handleMessageChange = (nextValue) => {
    setMessage(nextValue);
    window.clearTimeout(typingTimerRef.current);

    if (!nextValue.trim()) {
      if (isTypingRef.current) {
        void syncPresence(false);
      }
      return;
    }

    if (!isTypingRef.current) {
      void syncPresence(true);
    }

    typingTimerRef.current = window.setTimeout(() => {
      void syncPresence(false);
    }, 2200);
  };

  const sendMessage = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    try {
      setSending(true);
      window.clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) {
        void syncPresence(false);
      }

      if (webSocketStatus === "connected" && sendWebSocketMessage({ type: "chat_message", message: trimmedMessage })) {
        setMessage("");
        setError("");
      } else {
        const response = await API.post(`groups/${groupId}/chat/`, {
          message: trimmedMessage,
        });

        setChat((current) => {
          const existingMessages = current?.messages || [];
          const nextMessage = response.data.chat_message;
          const nextMessages = existingMessages.some((item) => item.id === nextMessage.id)
            ? existingMessages
            : [...existingMessages, nextMessage];

          return {
            ...(current || {}),
            messages: nextMessages,
            active_typing_users: [],
            has_someone_typing: false,
          };
        });
        setMessage("");
        setError("");
        void fetchChat(false);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to send chat message.");
    } finally {
      setSending(false);
    }
  };

  const messages = useMemo(() => chat?.messages || [], [chat?.messages]);
  const participants = useMemo(() => chat?.participants || [], [chat?.participants]);
  const group = chat?.group || {};

  const otherTypingUsers = useMemo(
    () => participants
      .filter((participant) => participant.presence?.is_typing && !participant.is_self)
      .map((participant) => participant.username),
    [participants]
  );
  const typingLabel = formatTypingLabel(otherTypingUsers);
  const onlineParticipants = useMemo(
    () => participants.filter((participant) => participant.presence?.is_online && !participant.is_self),
    [participants]
  );
  const connectionMeta = useMemo(() => {
    if (webSocketStatus === "connected") {
      return { dot: "bg-emerald-500", label: "Live updates on" };
    }
    if (webSocketStatus === "connecting") {
      return { dot: "bg-amber-500", label: "Connecting live updates" };
    }
    return { dot: "bg-rose-500", label: "Polling fallback active" };
  }, [webSocketStatus]);
  const mobileDrawerSummary = typingLabel
    || (onlineParticipants.length > 0
      ? `${onlineParticipants.length} active right now`
      : `${participants.length} participant${participants.length === 1 ? "" : "s"} in this chat`);

  useEffect(() => {
    if (webSocketStatus !== "connected" || messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage?.is_own) {
      sendWebSocketMessage({ type: "mark_read" });
    }
  }, [messages, sendWebSocketMessage, webSocketStatus]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages]);

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          Loading group chat...
        </div>
      </div>
    );
  }

  if (error && !chat) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-5xl rounded-3xl border border-rose-200 bg-white p-8 text-center text-rose-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => navigate("/my-shared")}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to My Splits
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      {isMobile ? (
        <Drawer
          open={isMobileDrawerOpen}
          onClose={() => setIsMobileDrawerOpen(false)}
          eyebrow="Chat details"
          title="People in this split"
          description="Open the participant list when you need context, then jump back to the conversation."
        >
          <div className="sv-group-chat-drawer-stack">
            <ParticipantsSection participants={participants} />
            <QuickReadSection />
          </div>
        </Drawer>
      ) : null}

      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <section className="sv-dark-hero sv-group-chat-hero">
          <div className="sv-group-chat-hero-top flex flex-wrap items-start justify-between gap-4">
            <div className="sv-group-chat-hero-copy">
              <p className="sv-eyebrow-on-dark">Group chat</p>
              <h1 className="sv-display-on-dark mt-3 max-w-4xl">{group.subscription_name}</h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                {isMobile
                  ? "Send a quick update, check who is live, and keep the split moving."
                  : "See who is active, catch live typing signals, and keep the group coordinated without refreshing the whole page manually."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/chats")}
              className="sv-btn-ghost-dark"
            >
              Back to Chats
            </button>
          </div>

          <div className="sv-group-chat-meta mt-5 text-sm text-slate-200">
            <span className="sv-group-chat-meta-chip">{group.mode_label}</span>
            <span className="sv-group-chat-meta-chip">{group.status_label}</span>
            <span className="sv-group-chat-meta-chip">Host: {group.owner_name}</span>
            <span className="sv-group-chat-meta-chip">
              <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${connectionMeta.dot}`} />
              {connectionMeta.label}
            </span>
            {typingLabel ? <span className="sv-chat-typing-pill">{typingLabel}</span> : null}
            {!typingLabel && onlineParticipants.length > 0 ? (
              <span className="sv-chat-live-pill">{onlineParticipants.length} active now</span>
            ) : null}
          </div>
        </section>

        {isMobile ? (
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="sv-group-chat-mobile-trigger"
          >
            <span className="sv-chat-mobile-trigger-copy">
              <strong>{participants.length} people in this split</strong>
              <span>{mobileDrawerSummary}</span>
            </span>
            <span className="sv-group-chat-mobile-trigger-badge">Open</span>
          </button>
        ) : null}

        <section className="grid gap-4 sm:gap-6 lg:grid-cols-[0.7fr_0.3fr]">
          <div className="sv-card sv-group-chat-thread-card">
            <div className="sv-group-chat-thread-header flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Conversation</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">{isMobile ? "Chat" : "Messages"}</h2>
              </div>
              <button
                type="button"
                onClick={() => fetchChat(false)}
                className={`rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 transition hover:bg-slate-50 ${
                  isMobile ? "px-3 py-2 text-xs" : "px-4 py-2 text-sm"
                }`}
              >
                {isMobile ? "Reload" : "Refresh"}
              </button>
            </div>

            {typingLabel || onlineParticipants.length > 0 ? (
              <div className="sv-group-chat-live-strip">
                {typingLabel ? (
                  <span className="sv-chat-typing-pill">{typingLabel}</span>
                ) : (
                  <span className="sv-chat-live-pill">
                    {onlineParticipants.length} participant{onlineParticipants.length === 1 ? "" : "s"} active now
                  </span>
                )}
              </div>
            ) : null}

            <div className="sv-group-chat-thread mt-5 space-y-4">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No messages yet. Start the conversation with your group.
                </div>
              ) : (
                messages.map((item) => (
                  <div key={item.id} className={`flex ${item.is_own ? "justify-end" : "justify-start"}`}>
                    <div className={`sv-group-chat-message ${item.is_own ? "is-own" : ""}`}>
                      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${item.is_own ? "text-emerald-100" : "text-slate-500"}`}>
                        {item.sender_username}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.message}</p>
                      <p className={`mt-3 text-xs ${item.is_own ? "text-emerald-100" : "text-slate-400"}`}>
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={threadEndRef} />
            </div>

            <div className="sv-group-chat-composer">
              {error ? (
                <p className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
              ) : null}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{isMobile ? "Message" : "Type a message"}</span>
                <textarea
                  value={message}
                  onChange={(event) => handleMessageChange(event.target.value)}
                  onBlur={() => {
                    window.clearTimeout(typingTimerRef.current);
                    if (isTypingRef.current) {
                      void syncPresence(false);
                    }
                  }}
                  rows={isMobile ? 3 : 4}
                  className="sv-group-chat-textarea"
                  placeholder="Write to your group here..."
                />
              </label>

              <div className="sv-group-chat-composer-footer mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {message.trim()
                    ? "Typing presence fades automatically after a short pause."
                    : isMobile
                      ? "Share the next step, reminder, or access update."
                      : "Share join updates, renewal reminders, and access follow-ups here."}
                </p>
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={sending}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {sending ? "Sending..." : "Send message"}
                </button>
              </div>
            </div>
          </div>

          <aside className="hidden space-y-6 lg:block">
            <ParticipantsSection participants={participants} />
            <QuickReadSection />
          </aside>
        </section>
      </div>
    </div>
  );
}
