import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";

import API from "../api/axios";
import { getPaginatedItems } from "../api/pagination";
import EmptyState from "../components/EmptyState";
import IosInstallBanner from "../components/IosInstallBanner";
import PullToRefreshIndicator from "../components/PullToRefreshIndicator";
import {
  SkeletonCard,
  SkeletonList,
  SkeletonTextGroup,
} from "../components/SkeletonFactory";
import Tabs from "../components/Tabs";
import { useToast } from "../components/ToastProvider";
import {
  BellIcon,
  ChatIcon,
  CheckCircleIcon,
  ClockIcon,
  LoadingSpinner,
  ShieldIcon,
  StarIcon,
  WalletIcon,
} from "../components/UiIcons";
import usePullToRefresh from "../hooks/usePullToRefresh";
import useRevealOnScroll from "../hooks/useRevealOnScroll";
import useWebSocket from "../hooks/useWebSocket";

const SOUND_TOGGLE_STORAGE_KEY = "sv-notification-sound-enabled";



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

function countUnreadNotifications(items) {
  return (Array.isArray(items) ? items : []).filter((notification) => !notification.is_read).length;
}

function upsertNotification(current, nextNotification) {
  if (!nextNotification?.id) {
    return Array.isArray(current) ? current : [];
  }

  const existingItems = Array.isArray(current) ? current : [];
  const nextItems = existingItems.filter((item) => item.id !== nextNotification.id);
  return [nextNotification, ...nextItems];
}

function markNotificationsRead(current, notificationIds) {
  const existingItems = Array.isArray(current) ? current : [];
  const ids = new Set(notificationIds);
  return existingItems.map((item) =>
    ids.has(item.id) ? { ...item, is_read: true } : item
  );
}

export default function NotificationsInbox() {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const storedValue = window.localStorage.getItem(SOUND_TOGGLE_STORAGE_KEY);
    return storedValue !== "0";
  });
  const previousUnreadCountRef = useRef(null);
  const isMountedRef = useRef(true);
  const soundEnabledRef = useRef(soundEnabled);
  const hapticsEnabledRef = useRef(true);
  const notificationsRef = useRef([]);

  useRevealOnScroll();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    window.localStorage.setItem(SOUND_TOGGLE_STORAGE_KEY, soundEnabled ? "1" : "0");
  }, [soundEnabled]);



  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const handleEnablePush = async () => {
    if ("Notification" in window) {
      import("../pushSubscription").then(async (module) => {
        if ("serviceWorker" in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const success = await module.subscribeToPush(reg);
            if (success) {
              toast.success("Push notifications enabled!");
            } else {
              toast.error("Could not enable push notifications.");
            }
          } catch (e) {
            console.error(e);
            toast.error("Failed to enable push.");
          }
        }
      });
    }
  };

  const fetchNotifications = useCallback(async (showLoader = false, pageToFetch = 1) => {
    try {
      if (showLoader && isMountedRef.current) {
        if (pageToFetch === 1) setLoading(true);
        else setLoadingMore(true);
      }

      const response = await API.get("notifications/", { params: { page: pageToFetch, page_size: 50 } });
      if (!isMountedRef.current) {
        return;
      }

      const nextNotifications = getPaginatedItems(response.data);
      const nextUnreadCount = nextNotifications.filter((notification) => !notification.is_read).length;
      const previousUnreadCount = previousUnreadCountRef.current;

      if (pageToFetch === 1 && previousUnreadCount !== null && nextUnreadCount > previousUnreadCount) {
        if (soundEnabledRef.current) {
          playNotificationChime();
        }
        if (hapticsEnabledRef.current) {
          pulseDevice();
        }
      }

      const newNotificationsList = pageToFetch === 1 
        ? nextNotifications 
        : [...notificationsRef.current, ...nextNotifications];

      if (pageToFetch === 1) {
        previousUnreadCountRef.current = nextUnreadCount;
      }

      notificationsRef.current = newNotificationsList;
      setNotifications(newNotificationsList);
      setHasMore(!!response.data?.next || nextNotifications.length === 50);
      setPage(pageToFetch);
      setError("");
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError(err.response?.data?.error || "We could not load notifications right now.");
      }
    } finally {
      if (showLoader && isMountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchNotifications(true);
  }, [fetchNotifications]);

  const handleNotificationSocketMessage = useCallback((event) => {
    if (!event?.type) {
      return;
    }

    if (event.type === "new_notification") {
      const { type: _type, ...nextNotification } = event;
      const currentNotifications = notificationsRef.current;
      const alreadyExists = currentNotifications.some((item) => item.id === nextNotification.id);
      const nextNotifications = upsertNotification(currentNotifications, nextNotification);

      if (!alreadyExists && !nextNotification.is_read) {
        if (soundEnabledRef.current) {
          playNotificationChime();
        }
        if (hapticsEnabledRef.current) {
          pulseDevice();
        }
        
        // Contextually prompt for web push on first real-time notification
        if ("Notification" in window && Notification.permission === "default") {
          import("../pushSubscription").then((module) => {
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.ready.then((reg) => {
                module.subscribeToPush(reg);
              });
            }
          });
        }
      }

      notificationsRef.current = nextNotifications;
      previousUnreadCountRef.current = countUnreadNotifications(nextNotifications);
      setNotifications(nextNotifications);
      setError("");
      return;
    }

    if (event.type === "notification_read" && event.notification_id) {
      const nextNotifications = markNotificationsRead(notificationsRef.current, [event.notification_id]);
      notificationsRef.current = nextNotifications;
      previousUnreadCountRef.current =
        typeof event.unread_count === "number" ? event.unread_count : countUnreadNotifications(nextNotifications);
      setNotifications(nextNotifications);
      return;
    }

    if (event.type === "notifications_cleared") {
      const nextNotifications = (notificationsRef.current || []).map((item) => ({ ...item, is_read: true }));
      notificationsRef.current = nextNotifications;
      previousUnreadCountRef.current = 0;
      setNotifications(nextNotifications);
    }
  }, []);

  const {
    status: notificationSocketStatus,
    sendMessage: sendNotificationSocketMessage,
  } = useWebSocket("ws/notifications/", {
    onMessage: handleNotificationSocketMessage,
  });

  useEffect(() => {
    if (notificationSocketStatus === "connected") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void fetchNotifications(false);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchNotifications, notificationSocketStatus]);

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

  const markAsRead = async (notificationId) => {
    try {
      setWorkingId(`single-${notificationId}`);
      if (
        notificationSocketStatus === "connected"
        && sendNotificationSocketMessage({ type: "mark_read", notification_id: notificationId })
      ) {
        const nextNotifications = markNotificationsRead(notificationsRef.current, [notificationId]);
        notificationsRef.current = nextNotifications;
        previousUnreadCountRef.current = countUnreadNotifications(nextNotifications);
        setNotifications(nextNotifications);
      } else {
        const response = await API.post(`notifications/${notificationId}/read/`);
        const nextNotification = response.data?.notification;
        const nextNotifications = (notificationsRef.current || []).map((item) =>
          item.id === notificationId ? nextNotification || { ...item, is_read: true } : item
        );
        notificationsRef.current = nextNotifications;
        previousUnreadCountRef.current = countUnreadNotifications(nextNotifications);
        setNotifications(nextNotifications);
      }
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
      const usedSocket = notificationSocketStatus === "connected"
        && notificationIds.every((notificationId) =>
          sendNotificationSocketMessage({ type: "mark_read", notification_id: notificationId })
        );

      if (!usedSocket) {
        await Promise.all(notificationIds.map((notificationId) => API.post(`notifications/${notificationId}/read/`)));
      }

      const nextNotifications = markNotificationsRead(notificationsRef.current, notificationIds);
      notificationsRef.current = nextNotifications;
      previousUnreadCountRef.current = countUnreadNotifications(nextNotifications);
      setNotifications(nextNotifications);
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
      const usedSocket = notificationSocketStatus === "connected"
        && sendNotificationSocketMessage({ type: "mark_all_read" });

      if (!usedSocket) {
        await API.post("notifications/mark-all-read/");
      }

      const nextNotifications = (notificationsRef.current || []).map((item) => ({ ...item, is_read: true }));
      notificationsRef.current = nextNotifications;
      previousUnreadCountRef.current = 0;
      setNotifications(nextNotifications);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to mark all notifications as read.", {
        title: "Could not update inbox",
      });
    } finally {
      setMarkingAll(false);
    }
  }, [notificationSocketStatus, sendNotificationSocketMessage, toast]);

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
          <SkeletonCard>
            <SkeletonList count={4} itemClassName="h-24 rounded-[length:var(--sv-radius-card)]" />
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

        <section className="flex flex-wrap items-center justify-between gap-4 pb-2 sm:pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Notifications
          </h1>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleEnablePush} className="sv-btn-secondary">
              <BellIcon className="h-4 w-4" />
              Enable Push
            </button>
            {!isMobile ? (
              <button type="button" onClick={() => setSoundEnabled((current) => !current)} className="sv-btn-secondary">
                <BellIcon className="h-4 w-4" />
                {soundEnabled ? "Sound on" : "Sound off"}
              </button>
            ) : null}
          </div>
        </section>



        <section className={isMobile ? "space-y-4 px-2 pb-8" : "sv-card sv-reveal"}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Inbox</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">{isMobile ? "Your updates" : "Categorized updates"}</h2>
              </div>
            </div>

            <IosInstallBanner />

            <div className="flex flex-wrap items-end justify-between gap-4">

              {isMobile ? (
                <div className="flex gap-2">
                  <button onClick={() => setShowUnreadOnly(!showUnreadOnly)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${showUnreadOnly ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>
                    <ClockIcon className="h-3.5 w-3.5" />
                    Unread
                  </button>
                  <button onClick={markAllRead} disabled={markingAll || counts.unread === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 active:scale-95 transition-transform disabled:opacity-50">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Read all
                  </button>
                </div>
              ) : null}

              <div className="hidden sm:flex sv-inbox-toolbar">
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

            {isMobile ? (
              <div className="flex gap-2 overflow-x-auto pb-2 sv-no-scrollbar">
                {categoryTabs.map(tab => (
                  <button 
                    key={tab.value}
                    onClick={() => setFilter(tab.value)}
                    className={`shrink-0 px-4 py-2 rounded-2xl border text-[13px] font-bold transition-all ${filter === tab.value ? "border-teal-500 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="hidden sm:block">
                <Tabs tabs={categoryTabs} value={filter} onChange={setFilter} />
              </div>
            )}
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

          {hasMore && !loading && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => fetchNotifications(true, page + 1)}
                disabled={loadingMore}
                className="sv-btn-secondary"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </section>
      </div>


    </div>
  );
}

function NotificationCard({ notification, working, onMarkRead, compact = false }) {
  const Icon = getNotificationIcon(notification.icon);

  if (compact) {
    return (
      <article className={`bg-white rounded-[24px] border ${notification.is_read ? 'border-slate-100 shadow-sm opacity-75' : 'border-teal-100 shadow-sm bg-teal-50/30'} p-4 flex gap-3.5 relative transition-all`}>
        <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center border ${notification.is_read ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{notification.category_label}</span>
            <span className="text-[10px] font-semibold text-slate-400">{formatRelativeTime(notification.created_at)}</span>
          </div>
          <p className={`text-[13px] leading-snug ${notification.is_read ? 'text-slate-600 font-medium' : 'text-slate-900 font-bold'}`}>
            {notification.message}
          </p>
        </div>
        {!notification.is_read && (
          <button onClick={onMarkRead} disabled={working} className="shrink-0 h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 active:scale-95 transition-transform">
            {working ? <LoadingSpinner className="h-3 w-3" /> : <CheckCircleIcon className="h-4 w-4" />}
          </button>
        )}
      </article>
    );
  }

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
        <p className={`mt-3 text-sm leading-7 text-slate-700`}>{notification.message}</p>
      </div>

      {!notification.is_read ? (
        <button type="button" onClick={onMarkRead} disabled={working} className="sv-btn-secondary">
          {working ? <><LoadingSpinner />Saving...</> : <><CheckCircleIcon className="h-4 w-4" />Mark read</>}
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
  if (compact) {
    return (
      <article className={`bg-white rounded-[24px] border border-teal-100 shadow-sm bg-teal-50/30 p-4 flex gap-3.5 relative transition-all`}>
        <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center border bg-teal-50 text-teal-600 border-teal-100`}>
          <ChatIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{item.category_label}</span>
            <span className="text-[10px] font-semibold text-slate-400">{formatRelativeTime(item.latestCreatedAt)}</span>
          </div>
          <p className="text-[13px] leading-snug text-slate-900 font-bold mb-2">
            {item.count} unread chat update{item.count === 1 ? "" : "s"}
          </p>
          <div className="space-y-1">
            {item.messages.slice(0, 2).map((message) => (
              <p key={`${item.id}-${message}`} className="text-[12px] leading-tight text-slate-600 truncate">
                • {message}
              </p>
            ))}
          </div>
        </div>
        <button onClick={onMarkRead} disabled={working} className="shrink-0 h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 active:scale-95 transition-transform">
          {working ? <LoadingSpinner className="h-3 w-3" /> : <CheckCircleIcon className="h-4 w-4" />}
        </button>
      </article>
    );
  }

  return (
    <article className="sv-notification-card is-unread chat-bundle">
      <div className="sv-notification-icon chat">
        <ChatIcon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="sv-notification-pill">{item.category_label}</span>
          <span className="sv-notification-pill is-context">{item.context_title}</span>
          <span className="sv-notification-time">{formatRelativeTime(item.latestCreatedAt)}</span>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">{item.count} unread chat update{item.count === 1 ? "" : "s"} bundled together</p>
        <div className="sv-notification-bundle-list mt-3">
          {item.messages.map((message) => (
            <p key={`${item.id}-${message}`} className="text-sm leading-7 text-slate-600">
              {message}
            </p>
          ))}
        </div>
      </div>

      <button type="button" onClick={onMarkRead} disabled={working} className="sv-btn-secondary">
        {working ? <><LoadingSpinner />Saving...</> : <><CheckCircleIcon className="h-4 w-4" />Mark bundle read</>}
      </button>
    </article>
  );
}


