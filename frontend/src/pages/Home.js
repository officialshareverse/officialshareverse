import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import BrandMark from "../components/BrandMark";

const streamingServicesImage = `${process.env.PUBLIC_URL}/streaming-services-collage.png`;

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return `Rs ${numeric.toFixed(2)}`;
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
        title: "One of your buy-together groups is ready to move.",
        body: "Open My Groups to upload proof, coordinate access, or take the next action with your members.",
        cta: "Open My Groups",
        onClick: () => navigate("/my-shared"),
      };
    }

    if (membershipNeedsAttention > 0) {
      return {
        label: "Needs attention",
        title: "A joined group is waiting for your response.",
        body: "Review confirmations or issue updates so your membership keeps moving smoothly.",
        cta: "Review My Groups",
        onClick: () => navigate("/my-shared"),
      };
    }

    if (groups.length > 0) {
      return {
        label: "Explore",
        title: "You already have active groups you can browse.",
        body: "See open sharing and buy-together groups before deciding where you want to participate next.",
        cta: "Browse Groups",
        onClick: () => navigate("/groups"),
      };
    }

    return {
      label: "Get started",
      title: "Create your first group on ShareVerse.",
      body: "Start with a digital plan you already manage or open a new buy-together group from scratch.",
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
      <div className="mx-auto max-w-5xl space-y-6">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        <section className="sv-dark-hero">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <BrandMark glow sizeClass="h-12 w-12" roundedClass="rounded-[18px]" />
                <span className="sv-chip-dark">Home</span>
                <span className="sv-chip-dark">Top-ups live</span>
              </div>

              <h1 className="sv-display-on-dark mt-5 max-w-4xl">
                Split the cost of digital plans in one cleaner, more visual place.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base md:leading-8">
                ShareVerse keeps your subscriptions, memberships, courses, and software groups organized
                with shared-cost tracking, chat, updates, and participation all in one workflow.
              </p>

              <div className="mt-7 grid gap-3 sm:inline-flex sm:flex-wrap">
                <PrimaryButton onClick={() => navigate("/groups")}>Browse groups</PrimaryButton>
                <SecondaryButton onClick={() => navigate("/create")}>Create group</SecondaryButton>
                <SecondaryButton onClick={() => navigate("/my-shared")}>My groups</SecondaryButton>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -left-3 top-3 hidden rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white md:block sv-animate-float">
                Shared-cost dashboard
              </div>
              <div className="absolute -right-3 bottom-8 hidden rounded-full border border-emerald-200/20 bg-emerald-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100 md:block sv-animate-float-soft">
                One place for groups
              </div>

              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/10 p-3 shadow-[0_28px_70px_rgba(15,23,42,0.22)] backdrop-blur">
                <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/95 p-2">
                  <img
                    src={streamingServicesImage}
                    alt="Popular streaming and digital subscription services shown in colorful circles."
                    className="sv-animate-float-soft w-full rounded-[18px] object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sv-grid-stats">
          {stats.map((item, index) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={item.value}
              className={index === 1 ? "sv-animate-float-soft" : index === 3 ? "sv-animate-float" : ""}
            />
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(250px,0.92fr)]">
          <section className="sv-card">
            <p className="sv-eyebrow">{primaryCard.label}</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">{primaryCard.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{primaryCard.body}</p>
            <div className="mt-5">
              <PrimaryButton onClick={primaryCard.onClick}>{primaryCard.cta}</PrimaryButton>
            </div>
          </section>

          <aside className="sv-card">
            <p className="sv-eyebrow">Quick focus</p>
            <h2 className="sv-title mt-2">What ShareVerse is best at</h2>
            <div className="mt-5 space-y-3">
              {[
                "Coordinating subscription groups",
                "Keeping contribution flow visible",
                "Tracking members and updates cleanly",
              ].map((item) => (
                <div key={item} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </aside>
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

function StatCard({ label, value, className = "" }) {
  return (
    <article className={`sv-stat-card ${className}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}
