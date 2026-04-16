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
  const [showGuide, setShowGuide] = useState(false);

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

  const currentUserId = dashboard?.current_user?.id || null;
  const onboardingStorageKey = currentUserId ? `sv-home-guide-seen-${currentUserId}` : "";

  useEffect(() => {
    if (!onboardingStorageKey) {
      return;
    }

    const hasSeenGuide = window.localStorage.getItem(onboardingStorageKey) === "1";
    if (!hasSeenGuide) {
      setShowGuide(true);
    }
  }, [onboardingStorageKey]);

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
        body: "Open My Splits to upload proof, coordinate access, or take the next action with your members.",
        cta: "Open My Splits",
        onClick: () => navigate("/my-shared"),
      };
    }

    if (membershipNeedsAttention > 0) {
      return {
        label: "Needs attention",
        title: "A joined group is waiting for your response.",
        body: "Review confirmations or issue updates so your membership keeps moving smoothly.",
        cta: "Review My Splits",
        onClick: () => navigate("/my-shared"),
      };
    }

    if (groups.length > 0) {
      return {
        label: "Explore",
        title: "You already have active splits you can explore.",
        body: "See open sharing and buy-together splits before deciding where you want to participate next.",
        cta: "Explore Splits",
        onClick: () => navigate("/groups"),
      };
    }

    return {
      label: "Get started",
      title: "Create your first split on ShareVerse.",
      body: "Start with a digital plan you already manage or open a new buy-together split from scratch.",
      cta: "Create Split",
      onClick: () => navigate("/create"),
    };
  }, [groups.length, membershipNeedsAttention, navigate, ownerSummary.buy_together_waiting]);

  const stats = [
    { label: "Wallet balance", value: formatCurrency(dashboard?.wallet_balance) },
    { label: "Groups joined", value: dashboard?.groups_joined || 0 },
    { label: "Groups created", value: ownerSummary.total_groups_created || 0 },
    { label: "Unread updates", value: unreadNotifications },
  ];

  const onboardingSteps = [
    {
      step: "01",
      title: "Click `Create split` on this Home screen",
      where: "Use the Create split button in the hero section.",
      body: "Start there if you want to host a subscription, course, membership, or software plan for other users.",
      tip: "If you only want to join an existing split, click Explore splits instead.",
      cta: "Create Split",
      onClick: () => navigate("/create"),
    },
    {
      step: "02",
      title: "Choose the right group type",
      where: "Inside the create flow, pick the mode that matches your plan.",
      body: "Choose Sharing if you already manage the plan and want members to join it. Choose Buy together if you want people to join first and purchase later as a group.",
      tip: "Sharing works best for subscriptions you already control. Buy together works best when the purchase should happen only after members join.",
      cta: "Open Create Flow",
      onClick: () => navigate("/create"),
    },
    {
      step: "03",
      title: "Fill the group details carefully",
      where: "Stay on the create page and complete the form from top to bottom.",
      body: "Add the subscription or plan, choose total slots, set the price per slot, and review the dates before publishing the group.",
      tip: "Keep the title and pricing clear so members understand exactly what they are joining.",
      cta: "Continue Setup",
      onClick: () => navigate("/create"),
    },
    {
      step: "04",
      title: "Use `My splits` to manage everything",
      where: "Come back and click My Splits after your group is live or after you join one.",
      body: "That is where you review members, chat updates, confirmations, proof uploads, and the next action your group needs.",
      tip: "If you see alerts or unread updates, start with My Splits first.",
      cta: "Open My Splits",
      onClick: () => navigate("/my-shared"),
    },
    {
      step: "05",
      title: "Use `Wallet` for money actions",
      where: "Open Wallet whenever you need to add money or request a withdrawal.",
      body: "Top up your wallet with Razorpay before joining paid groups. If you ever need money out, save a destination and request a manual withdrawal review.",
      tip: "Manual withdrawals are reviewed first and usually settled within 24 hours.",
      cta: "Open Wallet",
      onClick: () => navigate("/wallet"),
    },
  ];

  const dismissGuide = () => {
    if (onboardingStorageKey) {
      window.localStorage.setItem(onboardingStorageKey, "1");
    }
    setShowGuide(false);
  };

  const openGuide = () => {
    setShowGuide(true);
  };

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-4xl space-y-3">
          <div className="sv-skeleton h-48 sm:h-64" />
          <div className="grid grid-cols-2 gap-3">
            <div className="sv-skeleton h-20" />
            <div className="sv-skeleton h-20" />
            <div className="sv-skeleton h-20" />
            <div className="sv-skeleton h-20" />
          </div>
          <div className="sv-skeleton h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      {showGuide ? (
        <div className="sv-modal-backdrop">
          <div className="sv-guide-modal">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <p className="sv-eyebrow">First-time guide</p>
                <h2 className="mt-2 text-xl font-bold leading-tight text-slate-950 sm:mt-3 sm:text-2xl md:text-[2.4rem]">
                  Here&apos;s exactly where to click first and how to create your first group.
                </h2>
                <p className="mt-3 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7 md:text-base md:leading-8">
                  This walkthrough is shown once for each account on this device so new users can follow the real button names they see on ShareVerse.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissGuide}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-4 sm:py-2 sm:text-sm"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/90 p-3 sm:mt-6 sm:rounded-[24px] sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">Quick click map</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3 md:grid-cols-4">
                {[
                  { label: "Create split", note: "Host a new plan", onClick: () => navigate("/create") },
                  { label: "Explore splits", note: "Join something open", onClick: () => navigate("/groups") },
                  { label: "My splits", note: "Manage updates", onClick: () => navigate("/my-shared") },
                  { label: "Wallet", note: "Top up or withdraw", onClick: () => navigate("/wallet") },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      dismissGuide();
                      item.onClick();
                    }}
                    className="sv-guide-map-item text-left"
                  >
                    <span className="block text-[13px] font-semibold text-slate-950 sm:text-sm">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-slate-500 sm:mt-1 sm:text-xs sm:leading-6">{item.note}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
              {onboardingSteps.map((item, index) => (
                <article
                  key={item.step}
                  className={`sv-guide-step ${index % 2 === 0 ? "sv-animate-float-soft" : "sv-animate-float"}`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[12px] font-bold text-white sm:h-11 sm:w-11 sm:text-sm">
                      {item.step}
                    </span>
                    <h3 className="text-[14px] font-semibold leading-snug text-slate-950 sm:text-lg">{item.title}</h3>
                  </div>
                  <p className="mt-3 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] font-medium text-slate-700 sm:mt-4 sm:rounded-[18px] sm:px-4 sm:py-3 sm:text-sm">
                    {item.where}
                  </p>
                  <p className="mt-3 text-[13px] leading-6 text-slate-600 sm:mt-4 sm:text-sm sm:leading-7">{item.body}</p>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500 sm:mt-3 sm:text-xs sm:leading-6">{item.tip}</p>
                  <button
                    type="button"
                    onClick={() => {
                      dismissGuide();
                      item.onClick();
                    }}
                    className="sv-btn-secondary mt-4 w-full justify-center text-[13px] sm:mt-5 sm:w-auto sm:text-sm"
                  >
                    {item.cta}
                  </button>
                </article>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-3.5 py-3.5 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:rounded-[24px] sm:px-4 sm:py-4">
              <p className="text-[13px] leading-6 text-emerald-900 sm:text-sm sm:leading-7">
                Need help after this? Open Support anytime and we&apos;ll help you with creating groups, joining groups, top-ups, or manual withdrawal review.
              </p>
              <button
                type="button"
                onClick={dismissGuide}
                className="sv-btn-primary w-full justify-center sm:w-auto"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 sm:px-4 sm:py-3 sm:text-sm">
            {error}
          </div>
        ) : null}

        <section className="sv-dark-hero">
          <div className="grid items-center gap-5 sm:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(240px,0.95fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <BrandMark glow sizeClass="h-10 w-10 sm:h-12 sm:w-12" roundedClass="rounded-[14px] sm:rounded-[18px]" />
                <span className="sv-chip-dark">Home</span>
                <span className="sv-chip-dark">Top-ups live</span>
              </div>

              <h1 className="sv-display-on-dark mt-4 max-w-4xl sm:mt-5">
                Split the cost of digital plans in one cleaner, more visual place.
              </h1>
              <p className="mt-3 max-w-3xl text-[13px] leading-6 text-slate-300 sm:mt-4 sm:text-sm sm:leading-7 md:text-base md:leading-8">
                ShareVerse keeps your subscriptions, memberships, courses, and software groups organized
                with shared-cost tracking, chat, updates, and participation all in one workflow.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-7 sm:inline-flex sm:flex-wrap sm:gap-3">
                <PrimaryButton onClick={() => navigate("/groups")}>Explore splits</PrimaryButton>
                <SecondaryButton onClick={() => navigate("/create")}>Create split</SecondaryButton>
                <SecondaryButton onClick={() => navigate("/my-shared")}>My splits</SecondaryButton>
                <SecondaryButton onClick={openGuide}>Quick guide</SecondaryButton>
              </div>
            </div>

            <div className="relative mx-auto hidden w-full max-w-[18rem] sm:block sm:max-w-md">
              <div className="absolute -left-3 top-3 hidden rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white md:block sv-animate-float">
                Shared-cost dashboard
              </div>
              <div className="absolute -right-3 bottom-8 hidden rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100 md:block sv-animate-float-soft">
                One place for groups
              </div>

              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/10 p-2.5 shadow-[0_28px_70px_rgba(15,23,42,0.22)] backdrop-blur sm:rounded-[28px] sm:p-3">
                <div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/95 p-1.5 sm:rounded-[22px] sm:p-2">
                  <img
                    src={streamingServicesImage}
                    alt="Popular streaming and digital subscription services shown in colorful circles."
                    className="sv-animate-float-soft w-full rounded-[14px] object-cover sm:rounded-[18px]"
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

        <section className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(220px,0.92fr)]">
          <section className="sv-card">
            <p className="sv-eyebrow">{primaryCard.label}</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950 sm:mt-3 sm:text-2xl">{primaryCard.title}</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-600 sm:mt-3 sm:text-sm sm:leading-7">{primaryCard.body}</p>
            <div className="mt-4 sm:mt-5">
              <PrimaryButton onClick={primaryCard.onClick}>{primaryCard.cta}</PrimaryButton>
            </div>
          </section>

          <aside className="sv-card">
            <p className="sv-eyebrow">Quick focus</p>
            <h2 className="sv-title mt-1.5 sm:mt-2">What ShareVerse is best at</h2>
            <div className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">
              {[
                "Coordinating subscription groups",
                "Keeping contribution flow visible",
                "Tracking members and updates cleanly",
              ].map((item) => (
                <div key={item} className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-slate-700 sm:rounded-[20px] sm:px-4 sm:py-3 sm:text-sm">
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
    <button onClick={onClick} className="sv-btn-primary w-full text-[13px] sm:w-auto sm:text-sm">
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }) {
  return (
    <button onClick={onClick} className="sv-btn-secondary w-full text-[13px] sm:w-auto sm:text-sm">
      {children}
    </button>
  );
}

function StatCard({ label, value, className = "" }) {
  return (
    <article className={`sv-stat-card ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-xs">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-950 sm:mt-3 sm:text-2xl">{value}</p>
    </article>
  );
}
