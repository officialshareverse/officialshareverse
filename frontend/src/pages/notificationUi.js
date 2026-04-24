import { formatRelativeTime } from "../utils/format";
import {
  BellIcon,
  ChatIcon,
  CheckCircleIcon,
  LoadingSpinner,
  ShieldIcon,
  StarIcon,
  WalletIcon,
} from "../components/UiIcons";

function getNotificationIcon(iconName) {
  if (iconName === "chat") return ChatIcon;
  if (iconName === "wallet") return WalletIcon;
  if (iconName === "shield") return ShieldIcon;
  if (iconName === "star") return StarIcon;
  return BellIcon;
}

export function NotificationMetricCard({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export function NotificationRow({ notification, working, onMarkRead }) {
  const Icon = getNotificationIcon(notification.icon);

  return (
    <article
      className={`rounded-md border p-4 shadow-sm ${
        notification.is_read ? "border-slate-200 bg-white" : "border-emerald-200 bg-emerald-50/50"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <Icon className="h-4 w-4" />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {notification.category_label}
              </span>
              {notification.context_title ? (
                <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">
                  {notification.context_title}
                </span>
              ) : null}
              <span className="text-xs text-slate-400">{formatRelativeTime(notification.created_at)}</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-700">{notification.message}</p>
          </div>
        </div>

        {!notification.is_read ? (
          <button type="button" onClick={onMarkRead} disabled={working} className="sv-btn-secondary">
            {working ? (
              <>
                <LoadingSpinner />
                Saving...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4" />
                Mark read
              </>
            )}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Read
          </span>
        )}
      </div>
    </article>
  );
}

export function NotificationBundleRow({ item, working, onMarkRead }) {
  return (
    <article className="rounded-md border border-violet-200 bg-violet-50/60 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700">
            <ChatIcon className="h-4 w-4" />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {item.category_label}
              </span>
              <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">
                {item.context_title}
              </span>
              <span className="text-xs text-slate-400">{formatRelativeTime(item.latestCreatedAt)}</span>
            </div>

            <p className="mt-2 text-sm font-semibold text-slate-900">
              {item.count} unread chat update{item.count === 1 ? "" : "s"} bundled together
            </p>

            <div className="mt-3 space-y-1">
              {item.messages.map((message) => (
                <p key={`${item.id}-${message}`} className="text-sm leading-7 text-slate-600">
                  {message}
                </p>
              ))}
            </div>
          </div>
        </div>

        <button type="button" onClick={onMarkRead} disabled={working} className="sv-btn-secondary">
          {working ? (
            <>
              <LoadingSpinner />
              Saving...
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-4 w-4" />
              Mark read
            </>
          )}
        </button>
      </div>
    </article>
  );
}
