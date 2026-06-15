import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import SubscriptionLogo from "../components/SubscriptionLogo";
import AvatarStack from "../components/AvatarStack";
import EmptyState from "../components/EmptyState";
import PullToRefreshIndicator from "../components/PullToRefreshIndicator";
import {
  SkeletonCard,
  SkeletonList,
  SkeletonTextGroup,
} from "../components/SkeletonFactory";
import Tabs from "../components/Tabs";
import Tooltip from "../components/Tooltip";
import {
  ChatIcon,
  CheckCircleIcon,
  ClockIcon,
  SearchIcon,
  StarIcon,
} from "../components/UiIcons";
import usePullToRefresh from "../hooks/usePullToRefresh";
import useRevealOnScroll from "../hooks/useRevealOnScroll";
import useWebSocket from "../hooks/useWebSocket";

const PINNED_CHATS_STORAGE_KEY = "sv-pinned-chats-v1";
const CHAT_BADGE_REFRESH_REASONS = new Set(["chat_message", "chat_read", "initial", "refresh"]);

function pulseDevice() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(12);
  }
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

function getStatusBucket(status) {
  if (status === "active") {
    return { className: "is-active", label: "Active" };
  }
  if (["proof_submitted", "awaiting_purchase", "forming", "collecting", "purchasing"].includes(status)) {
    return { className: "is-pending", label: "In progress" };
  }
  if (["closed", "refunded", "refunding"].includes(status)) {
    return { className: "is-closed", label: "Closed" };
  }
  if (status === "disputed") {
    return { className: "is-alert", label: "Needs attention" };
  }
  return { className: "is-neutral", label: "Open" };
}

function getModeTone(mode) {
  return mode === "group_buy" ? "is-buy" : "is-sharing";
}

function getAvatarToken(name) {
  return String(name || "ShareVerse")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function ChatsInbox() {
  const navigate = useNavigate();
  const [chatInbox, setChatInbox] = useState({ chats: [], total_chats: 0, total_unread_count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const previousUnreadCountRef = useRef(null);
  const isMountedRef = useRef(true);
  const [pinnedChatIds, setPinnedChatIds] = useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const storedValue = window.localStorage.getItem(PINNED_CHATS_STORAGE_KEY);
      const parsed = storedValue ? JSON.parse(storedValue) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useRevealOnScroll();

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

      const nextInbox = response.data || { chats: [], total_chats: 0, total_unread_count: 0 };
      const nextUnreadCount = Number(nextInbox.total_unread_count) || 0;
      const previousUnreadCount = previousUnreadCountRef.current;

      if (previousUnreadCount !== null && nextUnreadCount > previousUnreadCount) {
        pulseDevice();
      }

      previousUnreadCountRef.current = nextUnreadCount;
      setChatInbox(nextInbox);
      setError("");
    } catch (err) {
      console.error(err);
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
  }, [fetchInbox]);

  const handleBadgeSocketMessage = useCallback((event) => {
    if (event?.type !== "badge_update") {
      return;
    }

    const nextUnreadCount = Number(event.unread_chats);
    if (
      CHAT_BADGE_REFRESH_REASONS.has(event.reason)
      || (!Number.isNaN(nextUnreadCount) && nextUnreadCount !== previousUnreadCountRef.current)
    ) {
      void fetchInbox(false);
    }
  }, [fetchInbox]);

  const { status: badgeSocketStatus } = useWebSocket("ws/badges/", {
    onMessage: handleBadgeSocketMessage,
  });

  useEffect(() => {
    if (badgeSocketStatus === "connected") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void fetchInbox(false);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [badgeSocketStatus, fetchInbox]);

  const stats = useMemo(() => {
    const chats = chatInbox.chats || [];
    return {
      total: chatInbox.total_chats || 0,
      unreadMessages: chatInbox.total_unread_count || 0,
      unreadThreads: chats.filter((chat) => chat.unread_chat_count > 0).length,
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
              ? chat.unread_chat_count > 0
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
          chat.group.status_label,
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

  const togglePinnedChat = (groupId) => {
    setPinnedChatIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    );
  };

  const pullToRefresh = usePullToRefresh({
    onRefresh: () => fetchInbox(false),
    disabled: loading,
  });

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-6xl space-y-6">
          <SkeletonCard>
            <SkeletonTextGroup eyebrowWidth="w-16" titleWidth="w-80" />
          </SkeletonCard>
          <SkeletonCard>
            <SkeletonList count={4} itemClassName="h-32 rounded-[length:var(--sv-radius-card)]" />
          </SkeletonCard>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page" {...pullToRefresh.bind}>
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <PullToRefreshIndicator
          progress={pullToRefresh.progress}
          isRefreshing={pullToRefresh.isRefreshing}
          loadingLabel="Refreshing chats..."
        />

        <section className="flex flex-wrap items-center justify-between gap-4 pb-2 sm:pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Chats
          </h1>
        </section>



        <section className={isMobile ? "sv-reveal mt-2 mb-20" : "sv-card sv-reveal"}>
          {!isMobile ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Inbox</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Your conversations</h2>
                </div>

                <label className="sv-chat-search">
                  <SearchIcon className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search groups, hosts, or messages"
                    className="sv-chat-search-input"
                  />
                </label>
              </div>

              <Tabs
                tabs={[
                  { value: "all", label: "All chats", count: stats.total },
                  { value: "unread", label: "Unread", count: stats.unreadThreads },
                  { value: "pinned", label: "Pinned", count: stats.pinned },
                  { value: "hosted", label: "Hosted", count: stats.hosted },
                ]}
                value={filter}
                onChange={setFilter}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3 px-4">
              <label className="flex items-center gap-2 rounded-full bg-slate-100/80 px-4 py-2.5 text-slate-600 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500 dark:bg-slate-800/80 dark:text-slate-300 dark:focus-within:bg-slate-800">
                <SearchIcon className="h-4.5 w-4.5 shrink-0" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search chats..."
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
                />
              </label>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sv-hide-scrollbar" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {[
                  { value: "all", label: "All" },
                  { value: "unread", label: "Unread", count: stats.unreadThreads },
                  { value: "pinned", label: "Pinned" },
                  { value: "hosted", label: "Hosted" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setFilter(tab.value)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                      filter === tab.value
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 ? (
                      <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${filter === tab.value ? "bg-white/20" : "bg-emerald-100 text-emerald-700"}`}>
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error ? (
            <div className="mt-5 mx-4 sm:mx-0 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className={isMobile ? "mt-2 divide-y divide-slate-100 dark:divide-slate-800" : "mt-5 space-y-4"}>
            {visibleChats.length === 0 ? (
              <div className={isMobile ? "px-4 pt-10" : ""}>
                <EmptyState
                  icon={ChatIcon}
                  title="Nothing matches this chat view yet."
                  description="Try another filter or clear the search to bring back the rest of your conversations."
                />
              </div>
            ) : (
              visibleChats.map((chat) => (
                <ChatCard
                  key={chat.group.id}
                  chat={chat}
                  pinned={pinnedChatIds.includes(chat.group.id)}
                  onTogglePinned={() => togglePinnedChat(chat.group.id)}
                  onOpen={() => navigate(`/groups/${chat.group.id}/chat`)}
                  compact={isMobile}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ChatCard({ chat, pinned, onTogglePinned, onOpen, compact = false }) {
  const statusMeta = getStatusBucket(chat.group.status);
  const tone = getModeTone(chat.group.mode);
  const typingLabel = formatTypingLabel(chat.active_typing_users);
  const hasTyping = Boolean(typingLabel);
  const onlineCount = Math.max(0, Number(chat.online_participant_count) || 0);

  return (
    <article className={compact ? "relative flex items-center bg-white dark:bg-slate-900 transition active:bg-slate-50 dark:active:bg-slate-800" : `sv-chat-card ${chat.unread_chat_count > 0 ? "is-unread" : ""}`}>
      {compact ? (
        <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none">
          <div className="relative shrink-0">
            <SubscriptionLogo name={chat.group.subscription_name} size={52} style={{ borderRadius: "50%" }} />
            {onlineCount > 0 && !hasTyping ? (
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
            ) : null}
          </div>
          
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-[16px] font-semibold text-slate-900 dark:text-white">
                {chat.group.subscription_name}
              </h3>
              <span className={`shrink-0 text-xs ${chat.unread_chat_count > 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                {hasTyping ? "Now" : formatRelativeTime(chat.last_activity_at)}
              </span>
            </div>
            
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                {hasTyping ? (
                  <p className="truncate text-[14px] font-medium text-emerald-600 dark:text-emerald-400">
                    {typingLabel}
                  </p>
                ) : chat.last_message ? (
                  <p className={`truncate text-[14px] ${chat.unread_chat_count > 0 ? "font-medium text-slate-800 dark:text-slate-200" : "text-slate-500"}`}>
                    <span className="mr-1 inline-flex text-slate-400">{chat.last_message.is_own ? "You:" : `${chat.last_message.sender_username.split(" ")[0]}:`}</span>
                    {chat.last_message.message}
                  </p>
                ) : (
                  <p className="truncate text-[14px] italic text-slate-400">No messages yet</p>
                )}
              </div>
              
              <div className="flex shrink-0 items-center gap-1.5">
                {pinned ? (
                  <StarIcon className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                ) : null}
                {chat.unread_chat_count > 0 ? (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
                    {chat.unread_chat_count}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </button>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`sv-chat-group-avatar ${tone} ${onlineCount > 0 ? "has-online" : ""}`} style={{ background: 'none', boxShadow: 'none' }}>
                <SubscriptionLogo name={chat.group.subscription_name} size={48} style={{ borderRadius: 20 }} />
                <span className={`sv-chat-group-avatar-dot ${hasTyping || onlineCount > 0 ? "is-online" : ""}`} />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{chat.group.subscription_name}</h3>
                  <span className={`sv-chat-status-pill ${statusMeta.className}`}>{statusMeta.label}</span>
                  <span className="sv-chat-mode-pill">{chat.group.mode_label}</span>
                  {pinned ? <span className="sv-chat-pinned-pill">Pinned</span> : null}
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  {`${chat.is_owner ? "Hosted by you" : `Hosted by ${chat.group.owner_name}`} | ${chat.participant_count} participant${chat.participant_count === 1 ? "" : "s"}`}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {hasTyping ? <span className="sv-chat-typing-pill">{typingLabel}</span> : null}
                  {!hasTyping && onlineCount > 0 ? (
                    <span className="sv-chat-live-pill">
                      {onlineCount} active now
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="sv-chat-time">{formatRelativeTime(chat.last_activity_at)}</span>
              <Tooltip content={pinned ? "Unpin chat" : "Pin chat"}>
                <button
                  type="button"
                  onClick={onTogglePinned}
                  className={`sv-chat-pin ${pinned ? "is-active" : ""}`}
                  aria-label={pinned ? "Unpin chat" : "Pin chat"}
                >
                  <StarIcon className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <AvatarStack
              className="sv-chat-avatar-stack"
              chipClassName="sv-chat-avatar-chip"
              items={(chat.participant_preview || []).map((participant) => {
                const presenceMeta = getPresenceMeta(participant.presence);
                return {
                  id: `${chat.group.id}-${participant.username}`,
                  initials: participant.initials || getAvatarToken(participant.username),
                  label: participant.username,
                  title: `${participant.username} - ${presenceMeta.label}`,
                  className: presenceMeta.className,
                  indicatorClassName: presenceMeta.className,
                };
              })}
            />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {chat.message_count} message{chat.message_count === 1 ? "" : "s"}
            </span>
            {chat.unread_chat_count > 0 ? (
              <span className="sv-chat-unread-badge">
                {chat.unread_chat_count} unread
              </span>
            ) : (
              <span className="sv-chat-read-badge">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Read
              </span>
            )}
          </div>

          <button type="button" onClick={onOpen} className="sv-chat-card-body">
            {hasTyping ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    <span className="sv-chat-inline-dot is-online" />
                    Live right now
                  </p>
                  <span className="text-xs text-slate-400">{formatRelativeTime(chat.last_activity_at)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-7 text-emerald-700">{typingLabel}</p>
              </>
            ) : chat.last_message ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {chat.last_message.is_own ? "You" : chat.last_message.sender_username}
                  </p>
                  <span className="text-xs text-slate-400">{formatRelativeTime(chat.last_message.created_at)}</span>
                </div>
                <p className={`mt-2 text-sm leading-7 ${chat.unread_chat_count > 0 ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                  {chat.last_message.message}
                </p>
              </>
            ) : (
              <>
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <ClockIcon className="h-3.5 w-3.5" />
                  No messages yet
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">Open this chat to start coordinating with the group.</p>
              </>
            )}
          </button>
        </>
      )}
    </article>
  );
}
