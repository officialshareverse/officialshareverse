import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import BrandMark from "../components/BrandMark";
import { LayersIcon, SearchIcon, WalletIcon } from "../components/UiIcons";
import useRevealOnScroll from "../hooks/useRevealOnScroll";

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

  useRevealOnScroll();

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
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="sv-dark-hero">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
              <div className="space-y-4">
                <div className="sv-skeleton h-6 w-24" />
                <div className="sv-skeleton h-14 w-full max-w-2xl rounded-[24px]" />
                <div className="sv-skeleton h-14 w-full max-w-xl rounded-[24px]" />
                <div className="sv-skeleton h-4 w-full max-w-2xl" />
                <div className="sv-skeleton h-4 w-full max-w-xl" />
                <div className="grid gap-3 min-[420px]:grid-cols-2 sm:inline-flex sm:flex-wrap">
                  <div className="sv-skeleton h-12 w-full rounded-full sm:w-48" />
                  <div className="sv-skeleton h-12 w-full rounded-full sm:w-40" />
                </div>
              </div>
              <div className="sv-skeleton-card">
                <div className="sv-skeleton h-72 w-full rounded-[22px]" />
              </div>
            </div>
          </section>

          <section className="sv-grid-stats">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="sv-skeleton-card space-y-4">
                <div className="sv-skeleton h-3 w-24" />
                <div className="sv-skeleton h-8 w-28 rounded-[14px]" />
              </div>
            ))}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      {showGuide ? (
        <div className="sv-modal-backdrop px-3 py-4 sm:px-5">
          <div className="sv-guide-modal">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="sv-eyebrow">First-time guide</p>
                <h2 className="mt-3 text-[2rem] font-bold leading-tight text-slate-950 sm:text-[2.25rem] md:text-[2.4rem]">
                  Here&apos;s exactly where to click first and how to create your first group.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base md:leading-8">
                  This walkthrough is shown once for each account on this device so new users can follow the real button names they see on ShareVerse.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissGuide}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick click map</p>
              <div className="mt-4 grid gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
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
                    <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
                    <span className="mt-1 block text-xs leading-6 text-slate-500">{item.note}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {onboardingSteps.map((item, index) => (
                <article
                  key={item.step}
                  className={`sv-guide-step ${index % 2 === 0 ? "sv-animate-float-soft" : "sv-animate-float"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                      {item.step}
                    </span>
                    <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                  </div>
                  <p className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    {item.where}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{item.body}</p>
                  <p className="mt-3 text-xs leading-6 text-slate-500">{item.tip}</p>
                  <button
                    type="button"
                    onClick={() => {
                      dismissGuide();
                      item.onClick();
                    }}
                    className="sv-btn-secondary mt-5 w-full justify-center sm:w-auto"
                  >
                    {item.cta}
                  </button>
                </article>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-sm leading-7 text-emerald-900">
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

      <div className="mx-auto max-w-5xl space-y-6">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        <section className="sv-dark-hero sv-reveal">
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

              <div className="mt-7 grid gap-3 min-[420px]:grid-cols-2 sm:inline-flex sm:flex-wrap">
                <PrimaryButton onClick={() => navigate("/groups")}>Explore splits</PrimaryButton>
                <SecondaryButton onClick={() => navigate("/create")}>Create split</SecondaryButton>
                <SecondaryButton onClick={() => navigate("/my-shared")}>My splits</SecondaryButton>
                <SecondaryButton onClick={openGuide}>Show quick guide</SecondaryButton>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[21rem] sm:max-w-md">
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

        <section className="sv-grid-stats sv-stagger">
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
          <section className="sv-card sv-reveal">
            <p className="sv-eyebrow">{primaryCard.label}</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">{primaryCard.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{primaryCard.body}</p>
            <div className="mt-5">
              <PrimaryButton onClick={primaryCard.onClick}>{primaryCard.cta}</PrimaryButton>
            </div>
          </section>

          <aside className="sv-card sv-reveal">
            <p className="sv-eyebrow">Quick focus</p>
            <h2 className="sv-title mt-2">What ShareVerse is best at</h2>
            <div className="mt-5 space-y-3">
              {[
                { icon: LayersIcon, title: "Coordinating subscription groups" },
                { icon: WalletIcon, title: "Keeping contribution flow visible" },
                { icon: SearchIcon, title: "Tracking members and updates cleanly" },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                    <item.icon className="h-4.5 w-4.5" />
                  </span>
                  {item.title}
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
      <p className="sv-count-up mt-3 text-2xl font-bold text-slate-950">
        <AnimatedValue value={value} />
      </p>
    </article>
  );
}

function AnimatedValue({ value }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const raw = String(value);
    const numericMatch = raw.match(/-?\d+(\.\d+)?/);
    if (!numericMatch) {
      setDisplayValue(raw);
      return undefined;
    }

    const target = Number(numericMatch[0]);
    if (Number.isNaN(target)) {
      setDisplayValue(raw);
      return undefined;
    }

    const prefix = raw.slice(0, numericMatch.index);
    const suffix = raw.slice((numericMatch.index || 0) + numericMatch[0].length);
    const hasDecimals = numericMatch[0].includes(".");
    const duration = 650;
    const startedAt = performance.now();
    let frameId = 0;

    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const current = target * progress;
      const next = hasDecimals ? current.toFixed(2) : Math.round(current).toString();
      setDisplayValue(`${prefix}${next}${suffix}`);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [value]);

  return displayValue;
}
