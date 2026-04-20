import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import CountUp from "../components/CountUp";
import Drawer from "../components/Drawer";
import EmptyState from "../components/EmptyState";
import PullToRefreshIndicator from "../components/PullToRefreshIndicator";
import {
  SkeletonCard,
  SkeletonList,
  SkeletonMetricGrid,
  SkeletonTextGroup,
} from "../components/SkeletonFactory";
import Tabs from "../components/Tabs";
import { useToast } from "../components/ToastProvider";
import {
  BellIcon,
  ChatIcon,
  CheckCircleIcon,
  ClockIcon,
  HomeIcon,
  LoadingSpinner,
  ShieldIcon,
  StarIcon,
  WalletIcon,
} from "../components/UiIcons";
import usePullToRefresh from "../hooks/usePullToRefresh";
import useRevealOnScroll from "../hooks/useRevealOnScroll";

const SOUND_TOGGLE_STORAGE_KEY = "sv-notification-sound-enabled";
const HAPTICS_TOGGLE_STORAGE_KEY = "sv-notification-haptics-enabled";

function SummaryCard({ label, value, tone = "text-slate-900", className = "" }) {
  return (
    <div className={`sv-stat-card ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">{label}</p>
      <p className={`mt-2 text-xl font-bold sm:mt-3 sm:text-2xl ${tone}`}>
        <CountUp value={value} />
      </p>
    </div>
  );
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

function getDayBucketLabel(value) {
  const date = new Date(value);
  const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yesterdayKey = todayKey - 86400000;

  if (dayKey >= todayKey) {
    return "Today";
  }
  if (dayKey >= yesterdayKey) {
    return "Yesterday";
  }
  return "Earlier";
}

function playNotificationChime() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.14);
  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.2);
  oscillator.onended = () => {
    void context.close();
  };
}

function pulseDevice() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(16);
  }
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function bundleNotifications(notifications) {
  const singles = [];
  const bundles = new Map();

  notifications.forEach((notification) => {
    if (!notification.is_read && notification.kind === "chat" && notification.context_title) {
      const bundleKey = `chat-${notification.context_title.toLowerCase()}`;
      const existing = bundles.get(bundleKey);
      if (existing) {
        existing.count += 1;
        existing.notificationIds.push(notification.id);
        existing.latestCreatedAt =
          new Date(notification.created_at).getTime() > new Date(existing.latestCreatedAt).getTime()
            ? notification.created_at
            : existing.latestCreatedAt;
        existing.messages = [notification.message, ...existing.messages].slice(0, 2);
      } else {
        bundles.set(bundleKey, {
          type: "bundle",
          id: bundleKey,
          category: notification.category,
          category_label: notification.category_label,
          tone: notification.tone,
          context_title: notification.context_title,
          latestCreatedAt: notification.created_at,
          count: 1,
          notificationIds: [notification.id],
          messages: [notification.message],
        });
      }
      return;
    }

    singles.push({
      type: "single",
      id: `notification-${notification.id}`,
      notification,
      latestCreatedAt: notification.created_at,
    });
  });

  return [...singles, ...Array.from(bundles.values())].sort(
    (left, right) => new Date(right.latestCreatedAt).getTime() - new Date(left.latestCreatedAt).getTime()
  );
}

function buildSections(items) {
  return items.reduce((acc, item) => {
    const label = getDayBucketLabel(item.latestCreatedAt);
    const existing = acc.find((section) => section.label === label);
    if (existing) {
      existing.items.push(item);
      return acc;
    }
    acc.push({ label, items: [item] });
    return acc;
  }, []);
}

function getNotificationIcon(iconName) {
  if (iconName === "chat") return ChatIcon;
  if (iconName === "wallet") return WalletIcon;
  if (iconName === "shield") return ShieldIcon;
  if (iconName === "star") return StarIcon;
  return BellIcon;
}

export default function NotificationsInbox() {
  const navigate = useNavigate();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const [filter, setFilter] = useState("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const storedValue = window.localStorage.getItem(SOUND_TOGGLE_STORAGE_KEY);
    return storedValue !== "0";
  });
  const [hapticsEnabled, setHapticsEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const storedValue = window.localStorage.getItem(HAPTICS_TOGGLE_STORAGE_KEY);
    return storedValue !== "0";
  });
  const previousUnreadCountRef = useRef(null);
  const isMountedRef = useRef(true);

  useRevealOnScroll();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    window.localStorage.setItem(SOUND_TOGGLE_STORAGE_KEY, soundEnabled ? "1" : "0");
  }, [soundEnabled]);

  useEffect(() => {
    window.localStorage.setItem(HAPTICS_TOGGLE_STORAGE_KEY, hapticsEnabled ? "1" : "0");
  }, [hapticsEnabled]);

  const fetchNotifications = useCallback(async (showLoader = false) => {
    try {
      if (showLoader && isMountedRef.current) {
        setLoading(true);
      }

      const response = await API.get("notifications/");
      if (!isMountedRef.current) {
        return;
      }

      const nextNotifications = Array.isArray(response.data) ? response.data : [];
      const nextUnreadCount = nextNotifications.filter((notification) => !notification.is_read).length;
      const previousUnreadCount = previousUnreadCountRef.current;

      if (previousUnreadCount !== null && nextUnreadCount > previousUnreadCount) {
        if (soundEnabled) {
          playNotificationChime();
        }
        if (hapticsEnabled) {
          pulseDevice();
        }
      }

      previousUnreadCountRef.current = nextUnreadCount;
      setNotifications(nextNotifications);
      setError("");
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError(err.response?.data?.error || "We could not load notifications right now.");
      }
    } finally {
      if (showLoader && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [hapticsEnabled, soundEnabled]);

  useEffect(() => {
    void fetchNotifications(true);
    const intervalId = window.setInterval(() => {
      void fetchNotifications(false);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchNotifications]);

  const counts = useMemo(() => {
    return notifications.reduce(
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
    );
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const matchesCategory = filter === "all" ? true : notification.category === filter;
      const matchesUnread = showUnreadOnly ? !notification.is_read : true;
      return matchesCategory && matchesUnread;
    });
  }, [filter, notifications, showUnreadOnly]);

  const bundledItems = useMemo(() => bundleNotifications(filteredNotifications), [filteredNotifications]);
  const sections = useMemo(() => buildSections(bundledItems), [bundledItems]);
  const categoryTabs = [
    { value: "all", label: "All", count: counts.all },
    { value: "groups", label: "Groups", count: counts.groups },
    { value: "wallet", label: "Wallet", count: counts.wallet },
    { value: "system", label: "System", count: counts.system },
  ];
  const activeFilterLabel =
    filter === "all" ? "All updates" : filter.charAt(0).toUpperCase() + filter.slice(1);

  const markAsRead = async (notificationId) => {
    try {
      setWorkingId(`single-${notificationId}`);
      const response = await API.post(`notifications/${notificationId}/read/`);
      const nextNotification = response.data?.notification;
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? nextNotification || { ...item, is_read: true } : item
        )
      );
      previousUnreadCountRef.current = Math.max(0, (previousUnreadCountRef.current ?? 1) - 1);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to mark this notification as read.", {
        title: "Could not update notification",
      });
    } finally {
      setWorkingId(null);
    }
  };

  const markBundleRead = async (notificationIds, bundleId) => {
    try {
      setWorkingId(bundleId);
      await Promise.all(notificationIds.map((notificationId) => API.post(`notifications/${notificationId}/read/`)));
      setNotifications((current) =>
        current.map((item) =>
          notificationIds.includes(item.id) ? { ...item, is_read: true } : item
        )
      );
      previousUnreadCountRef.current = Math.max(
        0,
        (previousUnreadCountRef.current ?? notificationIds.length) - notificationIds.length
      );
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to mark this bundle as read.", {
        title: "Could not update bundle",
      });
    } finally {
      setWorkingId(null);
    }
  };

  const markAllRead = useCallback(async () => {
    try {
      setMarkingAll(true);
      await API.post("notifications/mark-all-read/");
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      previousUnreadCountRef.current = 0;
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to mark all notifications as read.", {
        title: "Could not update inbox",
      });
    } finally {
      setMarkingAll(false);
    }
  }, [toast]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.altKey && event.shiftKey && event.key.toLowerCase() === "r")) {
        return;
      }

      if (isEditableTarget(event.target) || markingAll || counts.unread === 0) {
        return;
      }

      event.preventDefault();
      void markAllRead();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [counts.unread, markAllRead, markingAll]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: () => fetchNotifications(false),
    disabled: loading,
  });

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-6xl space-y-6">
          <SkeletonCard>
            <SkeletonTextGroup eyebrowWidth="w-28" titleWidth="w-96" />
          </SkeletonCard>
          <SkeletonMetricGrid count={4} className="grid gap-2 grid-cols-2 sm:grid-cols-4 sm:gap-4" />
          <SkeletonCard>
            <SkeletonList count={4} itemClassName="h-24 rounded-[22px]" />
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
          loadingLabel="Refreshing notifications..."
        />

        <section className="sv-dark-hero">
          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
            <div>
              <p className="sv-eyebrow-on-dark">Notifications</p>
              <h1 className="sv-display-on-dark mt-2 max-w-4xl sm:mt-3">
                {isMobile ? "Stay on top of the updates that matter." : "Smart inbox for groups, wallet, and system updates"}
              </h1>
              <p className="mt-3 max-w-3xl text-[13px] leading-6 text-slate-200 sm:mt-4 sm:text-base sm:leading-8">
                {isMobile
                  ? "Use one simple control panel to filter unread updates and keep the list easy to scan."
                  : "Filter by category, keep repeated chat alerts bundled, and control whether new unread activity plays a chime."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!isMobile ? (
                <button type="button" onClick={() => setSoundEnabled((current) => !current)} className="sv-btn-ghost-dark">
                  <BellIcon className="h-4 w-4" />
                  {soundEnabled ? "Sound on" : "Sound off"}
                </button>
              ) : null}
              <button type="button" onClick={() => navigate("/home")} className="sv-btn-ghost-dark">
                Back to Home
              </button>
            </div>
          </div>
        </section>

        {!isMobile ? (
          <section className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
            <SummaryCard label="All updates" value={counts.all} className="col-span-2 md:col-span-1" />
            <SummaryCard label="Unread" value={counts.unread} tone={counts.unread > 0 ? "text-emerald-700" : "text-slate-900"} />
            <SummaryCard label="Groups" value={counts.groups} tone="text-violet-700" />
            <SummaryCard label="Wallet + System" value={counts.wallet + counts.system} tone="text-sky-700" />
          </section>
        ) : null}

        <section className="sv-card sv-reveal">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Inbox</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">{isMobile ? "Your updates" : "Categorized updates"}</h2>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                className="sv-notification-mobile-trigger sm:hidden"
              >
                <span className="sv-notification-mobile-trigger-copy">
                  <span>Filters &amp; actions</span>
                  <strong>{showUnreadOnly ? `${activeFilterLabel} - Unread` : activeFilterLabel}</strong>
                </span>
                <BellIcon className="h-4 w-4" />
              </button>

              <div className="hidden sm:flex sv-inbox-toolbar">
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(true)}
                  className="sv-notification-toggle"
                >
                  <BellIcon className="h-4 w-4" />
                  Preferences
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnreadOnly((current) => !current)}
                  className={`sv-notification-toggle ${showUnreadOnly ? "is-active" : ""}`}
                >
                  <ClockIcon className="h-4 w-4" />
                  {showUnreadOnly ? "Unread only" : "Show unread only"}
                </button>
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={markingAll || counts.unread === 0}
                  className="sv-btn-secondary"
                >
                  {markingAll ? <><LoadingSpinner />Marking...</> : <><CheckCircleIcon className="h-4 w-4" />Mark all read</>}
                </button>
              </div>
            </div>

            <div className="hidden sm:block">
              <Tabs tabs={categoryTabs} value={filter} onChange={setFilter} />
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 space-y-5">
            {sections.length === 0 ? (
              <EmptyState
                icon={BellIcon}
                title="Nothing matches this inbox view right now."
                description="Try another category or turn off the unread-only filter to see older updates."
              />
            ) : (
              sections.map((section) => (
                <div key={section.label}>
                  <p className="sv-notification-section-label">{section.label}</p>
                  <div className="mt-3 space-y-3">
                    {section.items.map((item) =>
                      item.type === "bundle" ? (
                        <NotificationBundleCard
                          key={item.id}
                          item={item}
                          working={workingId === item.id}
                          onMarkRead={() => markBundleRead(item.notificationIds, item.id)}
                          compact={isMobile}
                        />
                      ) : (
                        <NotificationCard
                          key={item.id}
                          notification={item.notification}
                          working={workingId === `single-${item.notification.id}`}
                          onMarkRead={() => markAsRead(item.notification.id)}
                          compact={isMobile}
                        />
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <Drawer
        open={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        eyebrow="Inbox controls"
        title="Tune this notification view"
        description="Switch categories, focus on unread updates, and manage your inbox without leaving the page."
        footer={(
          <div className="space-y-3">
            <p className="sv-drawer-footnote">Desktop shortcut: <strong>Alt + Shift + R</strong> marks everything read.</p>
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(false)}
              className="sv-btn-secondary w-full justify-center"
            >
              Done
            </button>
          </div>
        )}
      >
        <Tabs tabs={categoryTabs} value={filter} onChange={setFilter} className="sv-drawer-tabs" />

        <div className="sv-drawer-stack">
          <MobileDrawerAction
            icon={ClockIcon}
            label={showUnreadOnly ? "Showing unread only" : "Show unread only"}
            description="Focus on the items that still need your attention."
            meta={showUnreadOnly ? "Active" : "Off"}
            active={showUnreadOnly}
            onClick={() => setShowUnreadOnly((current) => !current)}
          />

          <MobileDrawerAction
            icon={BellIcon}
            label={soundEnabled ? "Notification sound is on" : "Notification sound is off"}
            description="Play a quick chime when fresh unread updates arrive."
            meta={soundEnabled ? "Enabled" : "Muted"}
            active={soundEnabled}
            onClick={() => setSoundEnabled((current) => !current)}
          />

          <MobileDrawerAction
            icon={StarIcon}
            label={hapticsEnabled ? "Haptics are on" : "Haptics are off"}
            description="Use a subtle device vibration for new unread alerts on supported devices."
            meta={hapticsEnabled ? "Enabled" : "Muted"}
            active={hapticsEnabled}
            onClick={() => setHapticsEnabled((current) => !current)}
          />

          <MobileDrawerAction
            icon={CheckCircleIcon}
            label="Mark all as read"
            description="Clear the unread queue once you are caught up."
            meta={counts.unread > 0 ? `${counts.unread} unread` : "All caught up"}
            disabled={markingAll || counts.unread === 0}
            onClick={markAllRead}
          />

          <MobileDrawerAction
            icon={HomeIcon}
            label="Back to Home"
            description="Jump out of the inbox and return to your dashboard."
            onClick={() => {
              setIsMobileDrawerOpen(false);
              navigate("/home");
            }}
          />
        </div>
      </Drawer>
    </div>
  );
}

function NotificationCard({ notification, working, onMarkRead, compact = false }) {
  const Icon = getNotificationIcon(notification.icon);

  return (
    <article className={`sv-notification-card ${notification.is_read ? "is-read" : "is-unread"} ${notification.tone || ""}`}>
      <div className={`sv-notification-icon ${notification.tone || ""}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="sv-notification-pill">{notification.category_label}</span>
          {!compact && notification.context_title ? <span className="sv-notification-pill is-context">{notification.context_title}</span> : null}
          <span className="sv-notification-time">{formatRelativeTime(notification.created_at)}</span>
        </div>
        <p className={`mt-3 text-sm leading-7 text-slate-700 ${compact ? "sv-notification-message-compact" : ""}`}>{notification.message}</p>
      </div>

      {!notification.is_read ? (
        <button type="button" onClick={onMarkRead} disabled={working} className="sv-btn-secondary">
          {working ? <><LoadingSpinner />Saving...</> : <><CheckCircleIcon className="h-4 w-4" />{compact ? "Read" : "Mark read"}</>}
        </button>
      ) : (
        <span className="sv-notification-read-pill">
          <CheckCircleIcon className="h-4 w-4" />
          Read
        </span>
      )}
    </article>
  );
}

function NotificationBundleCard({ item, working, onMarkRead, compact = false }) {
  return (
    <article className="sv-notification-card is-unread chat-bundle">
      <div className="sv-notification-icon chat">
        <ChatIcon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="sv-notification-pill">{item.category_label}</span>
          {!compact ? <span className="sv-notification-pill is-context">{item.context_title}</span> : null}
          <span className="sv-notification-time">{formatRelativeTime(item.latestCreatedAt)}</span>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">{item.count} unread chat update{item.count === 1 ? "" : "s"} bundled together</p>
        <div className="sv-notification-bundle-list mt-3">
          {(compact ? item.messages.slice(0, 2) : item.messages).map((message) => (
            <p key={`${item.id}-${message}`} className="text-sm leading-7 text-slate-600">
              {message}
            </p>
          ))}
        </div>
      </div>

      <button type="button" onClick={onMarkRead} disabled={working} className="sv-btn-secondary">
        {working ? <><LoadingSpinner />Saving...</> : <><CheckCircleIcon className="h-4 w-4" />{compact ? "Read" : "Mark bundle read"}</>}
      </button>
    </article>
  );
}

function MobileDrawerAction({
  icon: Icon,
  label,
  description,
  meta,
  onClick,
  disabled = false,
  active = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`sv-drawer-action ${active ? "is-active" : ""}`.trim()}
    >
      <span className="sv-drawer-action-icon">
        <Icon className="h-4.5 w-4.5" />
      </span>

      <span className="sv-drawer-action-copy">
        <strong>{label}</strong>
        {description ? <span>{description}</span> : null}
      </span>

      {meta ? <span className="sv-drawer-action-meta">{meta}</span> : null}
    </button>
  );
}
