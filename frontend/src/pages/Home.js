import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";

const streamingServicesImage = `${process.env.PUBLIC_URL}/streaming-services-collage.png`;

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return `Rs ${numeric.toFixed(2)}`;
}

function getModeLabel(mode) {
  return mode === "group_buy" ? "Buy together" : "Sharing";
}

export default function Home() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      try {
        const [groupsRes, dashboardRes] = await Promise.all([
          API.get("groups/"),
          API.get("dashboard/"),
        ]);

        if (!isMounted) {
          return;
        }

        setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
        setDashboard(dashboardRes.data || null);
      } catch (err) {
        console.error("Home load error:", err);
        if (isMounted) {
          setError("We could not load everything right now, but you can still use the platform.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  const ownerSummary = dashboard?.owner_summary || {};
  const notifications = Array.isArray(dashboard?.notifications) ? dashboard.notifications : [];
  const memberships = Array.isArray(dashboard?.groups) ? dashboard.groups : [];
  const unreadNotifications = notifications.filter((item) => !item.is_read).length;
  const membershipNeedsAttention = memberships.filter(
    (group) => group.access_confirmation_required || group.has_reported_access_issue
  ).length;

  const primaryCard = useMemo(() => {
    if (ownerSummary.buy_together_waiting > 0) {
      return {
        label: "Next step",
        title: "One of your buy-together groups is ready.",
        body: "Open My Groups to upload proof, coordinate access, or move the group forward.",
        cta: "Open My Groups",
        onClick: () => navigate("/my-shared"),
      };
    }

    if (membershipNeedsAttention > 0) {
      return {
        label: "Needs attention",
        title: "One of your joined groups needs a response.",
        body: "Review confirmations or issue updates from your memberships.",
        cta: "Review My Groups",
        onClick: () => navigate("/my-shared"),
      };
    }

    if (groups.length > 0) {
      return {
        label: "Explore",
        title: "There are active groups you can join right now.",
        body: "Browse open sharing and buy-together groups before deciding where to participate.",
        cta: "Browse Groups",
        onClick: () => navigate("/groups"),
      };
    }

    return {
      label: "Get started",
      title: "Create your first group on ShareVerse.",
      body: "Start with a digital plan you already manage or open a new buy-together group.",
      cta: "Create Group",
      onClick: () => navigate("/create"),
    };
  }, [groups.length, membershipNeedsAttention, navigate, ownerSummary.buy_together_waiting]);

  const stats = [
    { label: "Wallet balance", value: formatCurrency(dashboard?.wallet_balance) },
    { label: "Groups joined", value: dashboard?.groups_joined || 0 },
    { label: "Groups created", value: ownerSummary.total_groups_created || 0 },
    { label: "Unread updates", value: unreadNotifications },
  ];

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center text-slate-600 shadow-sm">
          Loading home...
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-4xl space-y-6">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        <section className="sv-card-solid">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
            <div className="text-center md:text-left">
              <p className="sv-eyebrow">Home</p>
              <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-950 md:text-5xl">
                Split the cost of digital plans in one simple place.
              </h1>
              <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:mx-0">
                ShareVerse helps people organize shared costs for subscriptions, courses, memberships,
                and software with clear group activity, chat, updates, and participation tracking.
              </p>

              <div className="mt-7 grid gap-3 sm:inline-flex sm:flex-wrap sm:justify-center md:justify-start">
                <PrimaryButton onClick={() => navigate("/groups")}>Browse groups</PrimaryButton>
                <SecondaryButton onClick={() => navigate("/create")}>Create group</SecondaryButton>
                <SecondaryButton onClick={() => navigate("/my-shared")}>My groups</SecondaryButton>
              </div>
            </div>

            <div className="mx-auto w-full max-w-md">
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7fafc_100%)] p-2 shadow-[0_20px_50px_rgba(15,23,42,0.08)] md:rounded-[28px] md:p-3">
                <img
                  src={streamingServicesImage}
                  alt="Popular streaming and digital subscription services shown in colorful circles."
                  className="w-full rounded-[18px] object-cover md:rounded-[22px]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="sv-grid-stats">
          {stats.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} />
          ))}
        </section>

        <section className="sv-card">
          <p className="sv-eyebrow">{primaryCard.label}</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">{primaryCard.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{primaryCard.body}</p>
          <div className="mt-5">
            <PrimaryButton onClick={primaryCard.onClick}>{primaryCard.cta}</PrimaryButton>
          </div>
        </section>

        <section className="sv-card">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <p className="sv-eyebrow">Open groups</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">A small preview of what is active now</h2>
            </div>
            <SecondaryButton onClick={() => navigate("/groups")}>Browse all groups</SecondaryButton>
          </div>

          {groups.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
              No open groups are live right now. You can create the first one from the Create Group page.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {groups.slice(0, 3).map((group) => (
                <PreviewRow
                  key={group.id}
                  subscriptionName={group.subscription_name}
                  ownerName={group.owner_name}
                  modeLabel={getModeLabel(group.mode)}
                  joinPrice={group.join_price}
                  pricePerSlot={group.price_per_slot}
                  isProrated={group.is_prorated}
                  seats={`${group.filled_slots}/${group.total_slots}`}
                  statusLabel={group.status_label}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick }) {
  return (
    <button onClick={onClick} className="sv-btn-primary w-full sm:w-auto">
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }) {
  return (
    <button onClick={onClick} className="sv-btn-secondary w-full sm:w-auto">
      {children}
    </button>
  );
}

function StatCard({ label, value }) {
  return (
    <article className="sv-stat-card">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}

function PreviewRow({
  subscriptionName,
  ownerName,
  modeLabel,
  joinPrice,
  pricePerSlot,
  isProrated,
  seats,
  statusLabel,
}) {
  const priceToShow = isProrated ? joinPrice : pricePerSlot;

  return (
    <article className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white/78 px-5 py-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-950">{subscriptionName}</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {modeLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">Hosted by {ownerName}</p>
      </div>

      <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3 md:text-right">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Price</p>
          <p className="mt-1 font-semibold text-slate-950">{formatCurrency(priceToShow)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Seats</p>
          <p className="mt-1 font-semibold text-slate-950">{seats}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Stage</p>
          <p className="mt-1 font-semibold text-slate-950">{statusLabel}</p>
        </div>
      </div>
    </article>
  );
}
