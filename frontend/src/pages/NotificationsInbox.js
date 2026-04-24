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
import { useToast } from "../components/ToastProvider";
import {
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
  HomeIcon,
  LoadingSpinner,
  StarIcon,
} from "../components/UiIcons";
import useIsMobile from "../hooks/useIsMobile";
import {
  buildSections,
  bundleNotifications,
  CATEGORY_FILTERS,
  HAPTICS_TOGGLE_STORAGE_KEY,
  isEditableTarget,
  playNotificationChime,
  pulseDevice,
  SOUND_TOGGLE_STORAGE_KEY,
} from "./notificationUtils";
import {
  NotificationBundleRow,
  NotificationMetricCard,
  NotificationRow,
} from "./notificationUi";

export default function NotificationsInbox() {
  const navigate = useNavigate();
  const toast = useToast();
  const isMobile = useIsMobile();
  const isMountedRef = useRef(true);
  const previousUnreadCountRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(SOUND_TOGGLE_STORAGE_KEY) !== "0";
  });
  const [hapticsEnabled, setHapticsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(HAPTICS_TOGGLE_STORAGE_KEY) !== "0";
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
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
      const nextUnreadCount = nextNotifications.filter((item) => !item.is_read).length;
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
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchNotifications]);

  const counts = useMemo(() => {
    return notifications.reduce(
      (acc, notification) => {
        acc.all += 1;
        if (!notification.is_read) acc.unread += 1;
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

  const sections = useMemo(
    () => buildSections(bundleNotifications(filteredNotifications)),
    [filteredNotifications]
  );

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
      await Promise.all(
        notificationIds.map((notificationId) => API.post(`notifications/${notificationId}/read/`))
      );
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
      toast.error(err.response?.data?.error || "Failed to update this bundle.", {
        title: "Could not update notifications",
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
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [counts.unread, markAllRead, markingAll]);

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-6xl space-y-4">
          <SkeletonCard>
            <SkeletonTextGroup eyebrowWidth="w-24" titleWidth="w-80" />
          </SkeletonCard>
          <SkeletonMetricGrid count={4} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" />
          <SkeletonCard>
            <SkeletonList count={4} itemClassName="h-24 rounded-xl" />
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Notifications
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">
                {isMobile ? "Your updates" : "Keep wallet, group, and system updates in one inbox"}
              </h1>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Filter by category, focus on unread items, and clear your queue when you are caught up.
              </p>
            </div>

            <button type="button" onClick={() => navigate("/home")} className="sv-btn-secondary">
              <HomeIcon className="h-4 w-4" />
              Back to Home
            </button>
          </div>
        </section>

        {!isMobile ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <NotificationMetricCard label="All updates" value={counts.all} />
            <NotificationMetricCard label="Unread" value={counts.unread} tone="text-emerald-700" />
            <NotificationMetricCard label="Groups" value={counts.groups} tone="text-violet-700" />
            <NotificationMetricCard
              label="Wallet + system"
              value={counts.wallet + counts.system}
              tone="text-sky-700"
            />
          </section>
        ) : null}

        <section className="sv-card">
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {CATEGORY_FILTERS.map((item) => {
                  const count =
                    item.value === "groups"
                      ? counts.groups
                      : item.value === "wallet"
                        ? counts.wallet
                        : item.value === "system"
                          ? counts.system
                          : counts.all;

                  return (
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
                      {item.label} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowUnreadOnly((current) => !current)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                    showUnreadOnly
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
                  }`}
                >
                  <ClockIcon className="mr-1 inline h-4 w-4" />
                  {showUnreadOnly ? "Unread only" : "Show unread only"}
                </button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled((current) => !current)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
                >
                  <BellIcon className="mr-1 inline h-4 w-4" />
                  {soundEnabled ? "Sound on" : "Sound off"}
                </button>

                <button
                  type="button"
                  onClick={() => setHapticsEnabled((current) => !current)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
                >
                  <StarIcon className="mr-1 inline h-4 w-4" />
                  {hapticsEnabled ? "Haptics on" : "Haptics off"}
                </button>

                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={markingAll || counts.unread === 0}
                  className="sv-btn-secondary"
                >
                  {markingAll ? (
                    <>
                      <LoadingSpinner />
                      Marking...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-4 w-4" />
                      Mark all read
                    </>
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-5">
              {sections.length === 0 ? (
                <EmptyState
                  icon={BellIcon}
                  title="Nothing matches this inbox view right now."
                  description="Try another category or turn off the unread-only filter to see older updates."
                />
              ) : (
                sections.map((section) => (
                  <div key={section.label}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {section.label}
                    </p>
                    <div className="mt-3 space-y-3">
                      {section.items.map((item) =>
                        item.type === "bundle" ? (
                          <NotificationBundleRow
                            key={item.id}
                            item={item}
                            working={workingId === item.id}
                            onMarkRead={() => markBundleRead(item.notificationIds, item.id)}
                          />
                        ) : (
                          <NotificationRow
                            key={item.id}
                            notification={item.notification}
                            working={workingId === `single-${item.notification.id}`}
                            onMarkRead={() => markAsRead(item.notification.id)}
                          />
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="text-xs text-slate-500">
              Tip: press <span className="font-semibold text-slate-700">Alt + Shift + R</span> to mark
              everything read.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
