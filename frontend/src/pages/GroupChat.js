import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import API from "../api/axios";
import Drawer from "../components/Drawer";
import { CheckCircleIcon, ClockIcon } from "../components/UiIcons";
import useIsMobile from "../hooks/useIsMobile";
import { formatRelativeTime, getInitials } from "../utils/format";

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
    return { className: "is-typing", label: "Typing now", dotClassName: "bg-emerald-500" };
  }
  if (status === "online") {
    return { className: "is-online", label: "Online", dotClassName: "bg-emerald-500" };
  }
  if (status === "recent") {
    return { className: "is-recent", label: "Active recently", dotClassName: "bg-amber-400" };
  }
  return { className: "is-offline", label: "Offline", dotClassName: "bg-slate-300" };
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
                  {participant.initials || getInitials(participant.username)}
                  <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${presenceMeta.dotClassName}`} />
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
                  <StatusPill tone="teal">Typing</StatusPill>
                ) : participant.presence?.is_online ? (
                  <StatusPill tone="emerald">Live</StatusPill>
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
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const isMobile = useIsMobile();
  const [chat, setChat] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

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
      await API.patch(`groups/${groupId}/chat/`, { is_typing: isTyping });
      isTypingRef.current = isTyping;
    } catch (err) {
      console.error("Failed to sync group chat presence:", err);
    }
  }, [groupId]);

  useEffect(() => {
    void fetchChat(true);

    const intervalId = window.setInterval(() => {
      void fetchChat(false);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchChat]);

  useEffect(() => {
    return () => {
      window.clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) {
        void API.patch(`groups/${groupId}/chat/`, { is_typing: false }).catch(() => {});
      }
    };
  }, [groupId]);

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
  const mobileDrawerSummary = typingLabel
    || (onlineParticipants.length > 0
      ? `${onlineParticipants.length} active right now`
      : `${participants.length} participant${participants.length === 1 ? "" : "s"} in this chat`);

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
            {typingLabel ? <StatusPill tone="teal">{typingLabel}</StatusPill> : null}
            {!typingLabel && onlineParticipants.length > 0 ? (
              <StatusPill tone="emerald">{onlineParticipants.length} active now</StatusPill>
            ) : null}
          </div>
        </section>

        {isMobile ? (
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="sv-group-chat-mobile-trigger"
          >
            <span className="grid min-w-0 gap-1">
              <strong>{participants.length} people in this split</strong>
              <span className="text-xs text-slate-500">{mobileDrawerSummary}</span>
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
                <StatusPill tone="teal">{typingLabel}</StatusPill>
              ) : (
                <StatusPill tone="emerald">
                  {onlineParticipants.length} participant{onlineParticipants.length === 1 ? "" : "s"} active now
                </StatusPill>
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

function StatusPill({ children, tone = "teal" }) {
  const toneClassName =
    tone === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-teal-100 text-teal-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${toneClassName}`}>
      {children}
    </span>
  );
}
