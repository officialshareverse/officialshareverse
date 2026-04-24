import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import EmptyState from "../components/EmptyState";
import {
  SkeletonCard,
  SkeletonList,
  SkeletonMetricGrid,
  SkeletonTextGroup,
} from "../components/SkeletonFactory";
import {
  ChatIcon,
  CheckCircleIcon,
  ClockIcon,
  SearchIcon,
  StarIcon,
} from "../components/UiIcons";
import useIsMobile from "../hooks/useIsMobile";
import { formatRelativeTime, getInitials } from "../utils/format";

const PINNED_CHATS_STORAGE_KEY = "sv-pinned-chats-v1";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "pinned", label: "Pinned" },
  { value: "hosted", label: "Hosted" },
];

function getStatusLabel(status) {
  if (status === "active") return "Active";
  if (["proof_submitted", "awaiting_purchase", "forming", "collecting", "purchasing"].includes(status)) {
    return "In progress";
  }
  if (["closed", "refunded", "refunding"].includes(status)) {
    return "Closed";
  }
  if (status === "disputed") {
    return "Needs attention";
  }
  return "Open";
}

function getModeTone(mode) {
  if (mode === "group_buy") {
    return "bg-violet-100 text-violet-700";
  }
  return "bg-teal-100 text-teal-700";
}

function getStatusTone(status) {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (["closed", "refunded", "refunding"].includes(status)) return "bg-slate-100 text-slate-600";
  if (status === "disputed") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

function MetricCard({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default function ChatsInbox() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isMountedRef = useRef(true);
  const [chatInbox, setChatInbox] = useState({ chats: [], total_chats: 0, total_unread_count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [pinnedChatIds, setPinnedChatIds] = useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(PINNED_CHATS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PINNED_CHATS_STORAGE_KEY, JSON.stringify(pinnedChatIds));
  }, [pinnedChatIds]);

  const fetchInbox = useCallback(async (showLoader = false) => {
    try {
      if (showLoader && isMountedRef.current) {
        setLoading(true);
      }

      const response = await API.get("group-chats/");
      if (!isMountedRef.current) {
        return;
      }

      setChatInbox(response.data || { chats: [], total_chats: 0, total_unread_count: 0 });
      setError("");
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.response?.data?.error || "We could not load your chats right now.");
      }
    } finally {
      if (showLoader && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchInbox(true);
    const intervalId = window.setInterval(() => {
      void fetchInbox(false);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchInbox]);

  const stats = useMemo(() => {
    const chats = chatInbox.chats || [];
    return {
      total: chatInbox.total_chats || 0,
      unreadMessages: chatInbox.total_unread_count || 0,
      unreadThreads: chats.filter((chat) => Number(chat.unread_chat_count) > 0).length,
      pinned: chats.filter((chat) => pinnedChatIds.includes(chat.group.id)).length,
      hosted: chats.filter((chat) => chat.is_owner).length,
    };
  }, [chatInbox, pinnedChatIds]);

  const visibleChats = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...(chatInbox.chats || [])]
      .filter((chat) => {
        const matchesFilter =
          filter === "all"
            ? true
            : filter === "unread"
              ? Number(chat.unread_chat_count) > 0
              : filter === "pinned"
                ? pinnedChatIds.includes(chat.group.id)
                : chat.is_owner;

        if (!matchesFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = [
          chat.group.subscription_name,
          chat.group.owner_name,
          chat.group.mode_label,
          chat.last_message?.message,
          chat.last_message?.sender_username,
          ...(chat.participant_preview || []).map((participant) => participant.username),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const leftPinned = pinnedChatIds.includes(left.group.id) ? 1 : 0;
        const rightPinned = pinnedChatIds.includes(right.group.id) ? 1 : 0;
        if (leftPinned !== rightPinned) {
          return rightPinned - leftPinned;
        }
        return new Date(right.last_activity_at).getTime() - new Date(left.last_activity_at).getTime();
      });
  }, [chatInbox.chats, filter, pinnedChatIds, searchTerm]);

  function togglePinnedChat(groupId) {
    setPinnedChatIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    );
  }

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-6xl space-y-4">
          <SkeletonCard>
            <SkeletonTextGroup eyebrowWidth="w-16" titleWidth="w-72" />
          </SkeletonCard>
          <SkeletonMetricGrid count={4} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" />
          <SkeletonCard>
            <SkeletonList count={4} itemClassName="h-28 rounded-xl" />
          </SkeletonCard>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Chats</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">
                {isMobile ? "Your conversations" : "Keep important group chats easy to find"}
              </h1>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Search threads, pin the ones that matter, and jump back into the right split fast.
              </p>
            </div>

            <button type="button" onClick={() => navigate("/my-shared")} className="sv-btn-secondary">
              Back to My Splits
            </button>
          </div>
        </section>

        {!isMobile ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total chats" value={stats.total} />
            <MetricCard label="Unread messages" value={stats.unreadMessages} tone="text-emerald-700" />
            <MetricCard label="Pinned" value={stats.pinned} tone="text-amber-700" />
            <MetricCard label="Hosted by you" value={stats.hosted} tone="text-violet-700" />
          </section>
        ) : null}

        <section className="sv-card">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="flex min-h-[44px] w-full items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 md:max-w-sm">
                <SearchIcon className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search groups, hosts, or messages"
                  className="w-full border-0 bg-transparent py-2.5 text-sm text-slate-900 outline-none"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                      filter === item.value
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
                    }`}
                  >
                    {item.label}
                    {item.value === "unread"
                      ? ` (${stats.unreadThreads})`
                      : item.value === "pinned"
                        ? ` (${stats.pinned})`
                        : item.value === "hosted"
                          ? ` (${stats.hosted})`
                          : ` (${stats.total})`}
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-3">
              {visibleChats.length === 0 ? (
                <EmptyState
                  icon={ChatIcon}
                  title="Nothing matches this view yet."
                  description="Try another filter or clear the search to bring back the rest of your conversations."
                />
              ) : (
                visibleChats.map((chat) => (
                  <ChatRow
                    key={chat.group.id}
                    chat={chat}
                    pinned={pinnedChatIds.includes(chat.group.id)}
                    onTogglePinned={() => togglePinnedChat(chat.group.id)}
                    onOpen={() => navigate(`/groups/${chat.group.id}/chat`)}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ChatRow({ chat, pinned, onTogglePinned, onOpen }) {
  const statusLabel = getStatusLabel(chat.group.status);
  const typingLabel = formatTypingLabel(chat.active_typing_users);
  const onlineCount = Math.max(0, Number(chat.online_participant_count) || 0);
  const messageLabel = typingLabel || chat.last_message?.message || "No messages yet";
  const previewPeople = (chat.participant_preview || []).slice(0, 3);

  return (
    <article
      className={`rounded-md border p-4 shadow-sm ${
        Number(chat.unread_chat_count) > 0
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">{chat.group.subscription_name}</h2>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getModeTone(chat.group.mode)}`}>
              {chat.group.mode_label}
            </span>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusTone(chat.group.status)}`}>
              {statusLabel}
            </span>
            {pinned ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                Pinned
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-slate-500">
            {chat.is_owner ? "Hosted by you" : `Hosted by ${chat.group.owner_name}`} •{" "}
            {chat.participant_count} participant{chat.participant_count === 1 ? "" : "s"} •{" "}
            {formatRelativeTime(chat.last_activity_at)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {previewPeople.map((participant) => (
              <span
                key={`${chat.group.id}-${participant.username}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
                title={participant.username}
              >
                {participant.initials || getInitials(participant.username)}
              </span>
            ))}
            {previewPeople.length === 0 ? (
              <span className="text-xs text-slate-500">No participant preview yet</span>
            ) : null}
            {Number(chat.unread_chat_count) > 0 ? (
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                {chat.unread_chat_count} unread
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Read
              </span>
            )}
            {!typingLabel && onlineCount > 0 ? (
              <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-700">
                {onlineCount} active
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onTogglePinned}
          aria-label={pinned ? "Unpin chat" : "Pin chat"}
          className={`rounded-md border p-2 transition ${
            pinned
              ? "border-amber-200 bg-amber-100 text-amber-700"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <StarIcon className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-4 block w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
      >
        {typingLabel ? (
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              Typing now
            </p>
            <p className="text-sm font-semibold text-teal-700">{typingLabel}</p>
          </div>
        ) : chat.last_message ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {chat.last_message.is_own ? "You" : chat.last_message.sender_username}
              </p>
              <span className="text-xs text-slate-400">
                {formatRelativeTime(chat.last_message.created_at)}
              </span>
            </div>
            <p
              className={`text-sm ${
                Number(chat.unread_chat_count) > 0 ? "font-semibold text-slate-900" : "text-slate-700"
              }`}
            >
              {messageLabel}
            </p>
          </div>
        ) : (
          <p className="inline-flex items-center gap-2 text-sm text-slate-500">
            <ClockIcon className="h-4 w-4" />
            No messages yet
          </p>
        )}
      </button>
    </article>
  );
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
