import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import BrandMark from "../components/BrandMark";

const streamingServicesImage = `${process.env.PUBLIC_URL}/streaming-services-collage.png`;

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return `Rs ${numeric.toFixed(2)}`;
}

function formatGroupType(value) {
  if (!value) {
    return "Split";
  }

  if (value === "buy_together") {
    return "Buy together";
  }

  if (value === "sharing") {
    return "Sharing";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

function getRecentSplitStatusTone(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("active") || normalized.includes("open") || normalized.includes("confirmed")) {
    return "text-emerald-600";
  }

  if (normalized.includes("waiting") || normalized.includes("pending") || normalized.includes("review")) {
    return "text-amber-600";
  }

  if (normalized.includes("closed") || normalized.includes("cancelled") || normalized.includes("completed")) {
    return "text-slate-500";
  }

  return "text-slate-600";
}

export default function Home() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

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
  const onboardingGuideVersion = "v2";
  const onboardingStorageKey = currentUserId ? `sv-home-guide-seen-${onboardingGuideVersion}-${currentUserId}` : "";

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
  const greeting = getGreeting();
  const currentUserFirstName = dashboard?.current_user?.first_name?.trim() || "there";
  const walletBalanceValue = Number(dashboard?.wallet_balance || 0);
  const recentGroups = groups.slice(0, 4);

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
    {
      label: "Wallet balance",
      value: formatCurrency(walletBalanceValue),
      icon: <WalletStatIcon />,
      onClick: () => navigate("/wallet"),
      valueClassName: walletBalanceValue > 0 ? "text-emerald-600" : "text-amber-600",
    },
    {
      label: "Groups joined",
      value: dashboard?.groups_joined || 0,
      icon: <UsersStatIcon />,
      onClick: () => navigate("/my-shared"),
      valueClassName: "text-slate-950",
    },
    {
      label: "Groups created",
      value: ownerSummary.total_groups_created || 0,
      icon: <FolderPlusStatIcon />,
      onClick: () => navigate("/my-shared"),
      valueClassName: "text-slate-950",
    },
    {
      label: "Unread updates",
      value: unreadNotifications,
      icon: <BellStatIcon />,
      onClick: () => navigate("/notifications"),
      valueClassName: unreadNotifications > 0 ? "text-rose-600" : "text-slate-950",
    },
  ];

  const onboardingSteps = [
    {
      step: "01",
      title: "Create a new split",
      body: "Tap 'Create split' on the home screen to set up a subscription, course, or software plan for others to join.",
      cta: "Create Split",
      onClick: () => navigate("/create"),
    },
    {
      step: "02",
      title: "Pick sharing or buy-together",
      body: "Choose 'Sharing' if you already own the plan, or 'Buy together' if the group buys it after members join.",
      cta: "Open Create Flow",
      onClick: () => navigate("/create"),
    },
    {
      step: "03",
      title: "Set the details and publish",
      body: "Name your split, choose slots, set the price per slot, review dates, and publish when ready.",
      cta: "Continue Setup",
      onClick: () => navigate("/create"),
    },
    {
      step: "04",
      title: "Manage everything in My Splits",
      body: "Check members, chat, confirmations, and actions all in one place after creating or joining a split.",
      cta: "Open My Splits",
      onClick: () => navigate("/my-shared"),
    },
    {
      step: "05",
      title: "Add money or withdraw from Wallet",
      body: "Top up via Razorpay before joining paid groups. Request withdrawals anytime; they're usually settled within 24 hours.",
      cta: "Open Wallet",
      onClick: () => navigate("/wallet"),
    },
  ];
  const totalGuideSlides = onboardingSteps.length + 2;

  const dismissGuide = () => {
    if (onboardingStorageKey) {
      window.localStorage.setItem(onboardingStorageKey, "1");
    }
    setShowGuide(false);
  };

  const openGuide = () => {
    setGuideStep(0);
    setShowGuide(true);
  };

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
          <div className="sv-skeleton h-48 rounded-[20px] sm:h-64" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="sv-skeleton h-20 rounded-[20px]" />
            <div className="sv-skeleton h-20 rounded-[20px]" />
            <div className="sv-skeleton h-20 rounded-[20px]" />
            <div className="sv-skeleton h-20 rounded-[20px]" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="sv-skeleton h-40 rounded-[20px]" />
            <div className="sv-skeleton h-40 rounded-[20px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="sv-skeleton h-28 rounded-[20px]" />
            <div className="sv-skeleton h-28 rounded-[20px]" />
            <div className="sv-skeleton h-28 rounded-[20px]" />
            <div className="sv-skeleton h-28 rounded-[20px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      {showGuide ? (
        <div className="sv-modal-backdrop">
          <div className="sv-guide-modal">
            <div className="flex items-center justify-between gap-3">
              <p className="sv-eyebrow">Quick guide</p>
              <button
                type="button"
                onClick={dismissGuide}
                className="min-h-[44px] px-1 py-2 text-[13px] font-semibold text-slate-500 transition hover:text-slate-800 sm:text-sm"
              >
                Skip
              </button>
            </div>

            <div className="mt-3 text-center text-[12px] font-medium text-slate-500 sm:mt-4 sm:text-sm">
              Step {guideStep + 1} of {totalGuideSlides}
            </div>
            <div className="sv-guide-dots">
              {Array.from({ length: totalGuideSlides }).map((_, index) => (
                <span
                  key={`guide-dot-${index}`}
                  className={`sv-guide-dot ${index === guideStep ? "sv-guide-dot-active" : ""}`}
                />
              ))}
            </div>

            <div className="mt-4 sm:mt-6">
              {guideStep === 0 ? (
                <div className="sv-guide-step sv-animate-rise">
                  <h2 className="text-xl font-bold leading-tight text-slate-950 sm:text-2xl">
                    Welcome to ShareVerse 👋
                  </h2>
                  <p className="mt-3 max-w-xl text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                    Here&apos;s a quick tour of the main sections. Tap any shortcut to jump straight there, or hit Next for a step-by-step guide.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
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
                        className="sv-guide-map-item"
                      >
                        <span className="block text-[13px] font-semibold text-slate-950 sm:text-sm">{item.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-5 text-slate-500 sm:mt-1 sm:text-xs sm:leading-6">{item.note}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : guideStep <= onboardingSteps.length ? (
                <article className="sv-guide-step sv-animate-rise">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[12px] font-bold text-white sm:h-11 sm:w-11 sm:text-sm">
                      {onboardingSteps[guideStep - 1].step}
                    </span>
                    <h3 className="text-[14px] font-semibold leading-snug text-slate-950 sm:text-lg">
                      {onboardingSteps[guideStep - 1].title}
                    </h3>
                  </div>
                  <p className="mt-4 max-w-xl text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                    {onboardingSteps[guideStep - 1].body}
                  </p>
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        dismissGuide();
                        onboardingSteps[guideStep - 1].onClick();
                      }}
                      className="sv-btn-secondary w-full justify-center text-[13px] sm:w-auto sm:text-sm"
                    >
                      {onboardingSteps[guideStep - 1].cta}
                    </button>
                  </div>
                </article>
              ) : (
                <div className="flex flex-col gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-3.5 py-3.5 sv-animate-rise sm:rounded-[24px] sm:px-4 sm:py-4">
                  <h2 className="text-xl font-bold text-emerald-950 sm:text-2xl">You&apos;re ready to go</h2>
                  <p className="max-w-xl text-[13px] leading-6 text-emerald-900 sm:text-sm sm:leading-7">
                    Need help after this? Open Support anytime and we&apos;ll help you with creating splits, joining them, top-ups, or manual withdrawal review.
                  </p>
                  <button
                    type="button"
                    onClick={dismissGuide}
                    className="sv-btn-primary w-full justify-center sm:w-auto"
                  >
                    Got it
                  </button>
                </div>
              )}
            </div>

            <div className="sv-guide-nav">
              {guideStep === 0 ? (
                <span aria-hidden="true" className="min-h-[44px] w-24 shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={() => setGuideStep((current) => Math.max(0, current - 1))}
                  className="sv-btn-secondary min-w-[96px]"
                >
                  Back
                </button>
              )}

              {guideStep < totalGuideSlides - 1 ? (
                <button
                  type="button"
                  onClick={() => setGuideStep((current) => Math.min(totalGuideSlides - 1, current + 1))}
                  className="sv-btn-primary min-w-[96px]"
                >
                  Next
                </button>
              ) : (
                <span aria-hidden="true" className="min-h-[44px] w-24 shrink-0" />
              )}
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

        <section className="sv-dark-hero sv-animate-rise">
          <div className="grid items-center gap-5 sm:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(240px,0.95fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <BrandMark glow sizeClass="h-10 w-10 sm:h-12 sm:w-12" roundedClass="rounded-[14px] sm:rounded-[18px]" />
                <span className="sv-chip-dark">Home</span>
              </div>

              <p className="sv-eyebrow-on-dark mt-4 sm:mt-5">
                {greeting}, {currentUserFirstName} 👋
              </p>
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

            <div className="relative mx-auto mt-5 w-full max-w-[12rem] sm:mt-0 sm:max-w-md">
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

        <section className="sv-grid-stats sv-animate-rise sv-delay-1">
          {stats.map((item, index) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={item.value}
              icon={item.icon}
              onClick={item.onClick}
              valueClassName={item.valueClassName}
              className={index === 1 ? "sv-animate-float-soft" : index === 3 ? "sv-animate-float" : ""}
            />
          ))}
        </section>

        <section className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(220px,0.92fr)] sv-animate-rise sv-delay-2">
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
            <h2 className="sv-title mt-1.5 sm:mt-2">Your current snapshot</h2>
            <div className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">
              {[
                { label: "Active memberships", value: memberships.length },
                { label: "Groups you manage", value: ownerSummary.total_groups_created || 0 },
                { label: "Total notifications", value: notifications.length },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex min-h-[44px] items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-slate-700 sm:rounded-[20px] sm:px-4 sm:py-3 sm:text-sm"
                >
                  <span>{item.label}</span>
                  <span className="text-base font-bold text-slate-950 sm:text-lg">{item.value}</span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="sv-animate-rise sv-delay-3">
          <div className="sv-divider" />
          <div className="mt-4 sm:mt-5">
            <p className="sv-eyebrow">Your recent splits</p>
            <h2 className="sv-title mt-1.5">Recent activity</h2>
          </div>

          {recentGroups.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recentGroups.map((group) => (
                <article key={group.id} className="sv-soft-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-slate-950 sm:text-lg">{group.name}</h3>
                      <div className="mt-2">
                        <span className="sv-chip">{formatGroupType(group.group_type)}</span>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${getRecentSplitStatusTone(group.status)}`}>
                      {formatGroupType(group.status)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className="sv-btn-secondary w-full sm:w-auto"
                    >
                      View
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="sv-soft-card mt-4">
              <h3 className="text-lg font-semibold text-slate-950">No splits yet.</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                No splits yet. Explore or create your first one!
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => navigate("/groups")}
                  className="sv-btn-secondary w-full sm:w-auto"
                >
                  Explore splits
                </button>
              </div>
            </div>
          )}
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

function StatCard({ label, value, icon, onClick, valueClassName = "text-slate-950", className = "" }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <article
      className={`sv-stat-card cursor-pointer ${className}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          {icon}
        </span>
        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-xs">{label}</p>
      </div>
      <p className={`mt-2 text-xl font-bold sm:mt-3 sm:text-2xl ${valueClassName}`}>{value}</p>
    </article>
  );
}

function WalletStatIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h7.5A1.5 1.5 0 0 1 13 4.5v7A1.5 1.5 0 0 1 11.5 13H4A1.5 1.5 0 0 1 2.5 11.5v-7Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 8h2.5v2h-2.5a1 1 0 1 1 0-2Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 5.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UsersStatIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5.5 7A2.5 2.5 0 1 0 5.5 2a2.5 2.5 0 0 0 0 5ZM11.5 8.5A2 2 0 1 0 11.5 4.5a2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 13c0-2.1 2.1-3.5 4-3.5s4 1.4 4 3.5M9 13c.2-1.4 1.6-2.5 3.2-2.5.9 0 1.7.3 2.3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FolderPlusStatIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M2.5 5A1.5 1.5 0 0 1 4 3.5h2.3l1.2 1.3H12A1.5 1.5 0 0 1 13.5 6.3v5.2A1.5 1.5 0 0 1 12 13H4a1.5 1.5 0 0 1-1.5-1.5V5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v4M6 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BellStatIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M8 2.5A3 3 0 0 0 5 5.5v1.2c0 .5-.2 1-.5 1.4L3.5 9.5V11h9V9.5l-1-1.4a2.4 2.4 0 0 1-.5-1.4V5.5A3 3 0 0 0 8 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
