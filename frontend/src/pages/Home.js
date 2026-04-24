import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonList,
} from "../components/SkeletonFactory";
import {
  BellIcon,
  CompassIcon,
  LayersIcon,
  PlusIcon,
  WalletIcon,
} from "../components/UiIcons";
import { formatCurrency, formatRelativeTime } from "../utils/format";

function formatGroupType(value) {
  if (!value) {
    return "Split";
  }
  if (value === "group_buy" || value === "buy_together") {
    return "Buy together";
  }
  if (value === "sharing") {
    return "Sharing";
  }
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function Home() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [groups, setGroups] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchHomeData() {
      try {
        const profilePromise = API.get("profile/").catch(() => null);
        const [groupsResponse, dashboardResponse, profileResponse] = await Promise.all([
          API.get("groups/"),
          API.get("dashboard/"),
          profilePromise,
        ]);

        if (!isMounted) {
          return;
        }

        setGroups(Array.isArray(groupsResponse.data) ? groupsResponse.data.slice(0, 4) : []);
        setDashboard(dashboardResponse.data || null);
        setProfile(profileResponse?.data || null);
        setError("");
      } catch (fetchError) {
        console.error("Home load error:", fetchError);
        if (isMounted) {
          setError("We could not load the dashboard right now, but your main actions are still available.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  const ownerSummary = dashboard?.owner_summary || {};
  const notifications = Array.isArray(dashboard?.notifications) ? dashboard.notifications : [];
  const memberships = Array.isArray(dashboard?.groups) ? dashboard.groups : [];
  const unreadNotifications = notifications.filter((item) => !item.is_read).length;
  const hostingCount = Number(ownerSummary.total_groups_created || 0);
  const walletBalance = Number(dashboard?.wallet_balance || 0);
  const activeGroups = Number(dashboard?.active_groups || 0);
  const currentUserName =
    profile?.first_name?.trim() || dashboard?.current_user?.username || "there";
  const membershipNeedsAttention = memberships.filter(
    (group) => group.access_confirmation_required || group.has_reported_access_issue
  ).length;
  const primaryAction = useMemo(() => {
    if (Number(ownerSummary.buy_together_waiting || 0) > 0) {
      return {
        title: "Buy-together groups need your next step",
        body: "Open My Splits to upload proof, confirm the purchase, or respond before the flow stalls.",
        cta: "Open My Splits",
        onClick: () => navigate("/my-shared"),
      };
    }

    if (membershipNeedsAttention > 0) {
      return {
        title: "A joined split is waiting for you",
        body: "Review confirmations or issue reports before the group gets blocked.",
        cta: "Review My Splits",
        onClick: () => navigate("/my-shared"),
      };
    }

    if (groups.length > 0) {
      return {
        title: "Explore open splits",
        body: "Browse live plans, compare price and availability, and join the ones that fit.",
        cta: "Explore Splits",
        onClick: () => navigate("/groups"),
      };
    }

    return {
      title: "Create your first split",
      body: "Start with a provider-permitted plan, membership, course, or software tool.",
      cta: "Create Split",
      onClick: () => navigate("/create"),
    };
  }, [groups.length, membershipNeedsAttention, navigate, ownerSummary.buy_together_waiting]);

  const stats = [
    {
      label: "Wallet balance",
      value: formatCurrency(walletBalance),
      icon: WalletIcon,
      onClick: () => navigate("/wallet"),
    },
    {
      label: "Active groups",
      value: String(activeGroups),
      icon: LayersIcon,
      onClick: () => navigate("/my-shared"),
    },
    {
      label: "Hosting now",
      value: String(hostingCount),
      icon: PlusIcon,
      onClick: () => navigate("/my-shared"),
    },
    {
      label: "Unread updates",
      value: String(unreadNotifications),
      icon: BellIcon,
      onClick: () => navigate("/notifications"),
    },
  ];

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-6xl space-y-4">
          <SkeletonCard>
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="mt-3 h-8 w-64" />
          </SkeletonCard>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} className="space-y-3">
                <SkeletonBlock className="h-10 w-10 rounded-xl" />
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="h-7 w-20" />
              </SkeletonCard>
            ))}
          </div>
          <SkeletonCard className="space-y-3">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-3/4" />
            <SkeletonBlock className="h-11 w-40 rounded-xl" />
          </SkeletonCard>
          <SkeletonList count={4} itemClassName="h-20 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl space-y-4">
        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        <section className="sv-card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            Good {getTimeGreeting()}, {currentUserName}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            See your balance, open groups, and next step without the extra clutter.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="sv-card text-left transition hover:border-slate-300 hover:shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <item.icon className="h-4 w-4" />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{item.value}</p>
            </button>
          ))}
        </section>

        <section className="sv-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Next step
              </p>
              <h2 className="text-lg font-semibold text-slate-950">{primaryAction.title}</h2>
              <p className="text-sm leading-6 text-slate-600">{primaryAction.body}</p>
            </div>
            <button type="button" onClick={primaryAction.onClick} className="sv-btn-primary">
              {primaryAction.cta}
            </button>
          </div>
        </section>

        <section className="sv-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Recent splits
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">Latest open listings</h2>
            </div>
            <button type="button" onClick={() => navigate("/groups")} className="sv-btn-secondary">
              <CompassIcon className="h-4 w-4" />
              Explore
            </button>
          </div>

          {groups.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-200">
              {groups.map((group) => (
                <article
                  key={group.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-950">
                      {group.subscription_name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatGroupType(group.mode)} • {getRemainingSlots(group)} slots left •{" "}
                      {formatRelativeTime(group.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-950">
                      {formatCurrency(group.join_price || group.price_per_slot)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate("/groups")}
                      className="sv-btn-secondary"
                    >
                      View
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-600">
              No open splits yet. Create the first one or check back later.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function getRemainingSlots(group) {
  const remaining = Number(
    group.remaining_slots ??
      Number(group.total_slots || 0) - Number(group.filled_slots || 0)
  );

  return Math.max(remaining || 0, 0);
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "morning";
  }
  if (hour < 17) {
    return "afternoon";
  }
  return "evening";
}
