import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import { BellIcon, CheckCircleIcon, ClockIcon, LoadingSpinner } from "../components/UiIcons";
import useRevealOnScroll from "../hooks/useRevealOnScroll";

function SummaryCard({ label, value, tone = "text-slate-900", className = "" }) {
  return (
    <div className={`sv-stat-card ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">{label}</p>
      <p className={`mt-2 text-xl font-bold sm:mt-3 sm:text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

function formatNotificationTime(value) {
  return new Date(value).toLocaleString();
}

export default function NotificationsInbox() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [workingId, setWorkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  useRevealOnScroll();

  useEffect(() => {
    let isMounted = true;

    const fetchNotifications = async (showLoader = false) => {
      try {
        if (showLoader && isMounted) {
          setLoading(true);
        }
        const response = await API.get("notifications/");
        if (!isMounted) {
          return;
        }
        setNotifications(Array.isArray(response.data) ? response.data : []);
        setError("");
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError(err.response?.data?.error || "We could not load notifications right now.");
        }
      } finally {
        if (showLoader && isMounted) {
          setLoading(false);
        }
      }
    };

    fetchNotifications(true);
    const intervalId = window.setInterval(() => fetchNotifications(false), 10000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const visibleNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((notification) => !notification.is_read);
    }
    return notifications;
  }, [filter, notifications]);

  const markAsRead = async (notificationId) => {
    try {
      setWorkingId(notificationId);
      const response = await API.post(`notifications/${notificationId}/read/`);
      const nextNotification = response.data?.notification;
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? nextNotification || { ...item, is_read: true } : item))
      );
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to mark this notification as read.");
    } finally {
      setWorkingId(null);
    }
  };

  const markAllRead = async () => {
    try {
      setMarkingAll(true);
      await API.post("notifications/mark-all-read/");
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to mark all notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="sv-skeleton-card space-y-4">
            <div className="sv-skeleton h-4 w-28" />
            <div className="sv-skeleton h-14 w-96 rounded-[22px]" />
            <div className="sv-skeleton h-4 w-2/3" />
          </section>
          <section className="grid gap-2 grid-cols-3 sm:gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="sv-skeleton-card space-y-4">
                <div className="sv-skeleton h-3 w-24" />
                <div className="sv-skeleton h-8 w-20 rounded-[16px]" />
              </div>
            ))}
          </section>
          <section className="sv-skeleton-card space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="sv-skeleton h-24 w-full rounded-[22px]" />
            ))}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <section className="sv-dark-hero">
          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
            <div>
              <p className="sv-eyebrow-on-dark">Notifications</p>
              <h1 className="sv-display-on-dark mt-2 max-w-4xl sm:mt-3">
                Stay on top of the next action
              </h1>
              <p className="mt-3 max-w-3xl text-[13px] leading-6 text-slate-200 sm:mt-4 sm:text-base sm:leading-8">
                See group updates, confirmations, chat activity, and payout reminders in one inbox.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="sv-btn-ghost-dark"
            >
              Back to Home
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3">
          <SummaryCard label="All notifications" value={notifications.length} className="col-span-2 md:col-span-1" />
          <SummaryCard
            label="Unread"
            value={unreadCount}
            tone={unreadCount > 0 ? "text-emerald-700" : "text-slate-900"}
          />
          <SummaryCard
            label="Read"
            value={notifications.length - unreadCount}
            tone="text-sky-700"
          />
        </section>

        <section className="sv-card sv-reveal">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Inbox</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Recent updates</h2>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 min-[420px]:w-auto sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-full px-3 py-2 text-[13px] font-semibold transition sm:px-4 sm:text-sm ${
                  filter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`rounded-full px-3 py-2 text-[13px] font-semibold transition sm:px-4 sm:text-sm ${
                  filter === "unread" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Unread
              </button>
              <button
                type="button"
                onClick={markAllRead}
                disabled={markingAll || unreadCount === 0}
                className="col-span-2 rounded-full border border-slate-300 px-3 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 sm:col-span-1 sm:px-4 sm:text-sm"
              >
                {markingAll ? <><LoadingSpinner />Marking...</> : <><CheckCircleIcon className="h-4 w-4" />Mark all read</>}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            {visibleNotifications.length === 0 ? (
              <div className="sv-empty-state">
                <div className="sv-empty-icon">
                  <BellIcon className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {filter === "unread" ? "No unread notifications right now." : "No notifications yet."}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Confirmation prompts, wallet events, and group updates will appear here.
                </p>
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-[20px] border p-3.5 transition sm:rounded-3xl sm:p-5 ${
                    notification.is_read
                      ? "border-slate-200 bg-white"
                      : "border-emerald-200 bg-emerald-50/40"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] sm:px-3 sm:py-1 sm:text-xs sm:tracking-[0.18em] ${
                            notification.is_read
                              ? "bg-slate-100 text-slate-600"
                              : "bg-emerald-600 text-white sv-status-pulse"
                          }`}
                        >
                          {notification.is_read ? "Read" : "Unread"}
                        </span>
                        <span className="text-xs text-slate-400">{formatNotificationTime(notification.created_at)}</span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-700">{notification.message}</p>
                    </div>

                    {!notification.is_read ? (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification.id)}
                        disabled={workingId === notification.id}
                        className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {workingId === notification.id ? <><LoadingSpinner />Saving...</> : <><ClockIcon className="h-4 w-4" />Mark read</>}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
