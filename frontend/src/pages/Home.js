import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import { getPaginatedItems } from "../api/pagination";
import SubscriptionLogo from "../components/SubscriptionLogo";
import BrandMark from "../components/BrandMark";
import {
  SkeletonBlock,
  SkeletonHero,
  SkeletonList,
} from "../components/SkeletonFactory";
import {
  CompassIcon,
  LayersIcon,
  PlusIcon,
  WalletIcon,
} from "../components/UiIcons";
import ThemeToggle from "../components/ThemeToggle";

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return `Rs ${numeric.toFixed(2)}`;
}



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

function getGreetingMeta() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return { text: "Good morning" };
  }
  if (hour < 17) {
    return { text: "Good afternoon" };
  }
  return { text: "Good evening" };
}

function getRecentSplitStatusMeta(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("active") || normalized.includes("open") || normalized.includes("confirmed")) {
    return { label: formatGroupType(status), dotTone: "bg-emerald-500" };
  }
  if (normalized.includes("forming") || normalized.includes("pending") || normalized.includes("proof") || normalized.includes("review") || normalized.includes("waiting")) {
    return { label: formatGroupType(status), dotTone: "bg-amber-500" };
  }
  if (normalized.includes("closed") || normalized.includes("cancelled") || normalized.includes("completed")) {
    return { label: formatGroupType(status), dotTone: "bg-slate-400" };
  }
  return { label: formatGroupType(status), dotTone: "bg-slate-300" };
}

export default function Home({ themeMode, toggleTheme }) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [profileSnapshot, setProfileSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState("");
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchHomeData = async () => {
      try {
        const profilePromise = API.get("profile/").catch(() => null);
        const [groupsRes, dashboardRes, profileRes] = await Promise.all([
          API.get("groups/", { params: { page_size: 8 } }),
          API.get("dashboard/"),
          profilePromise,
        ]);
        if (!isMounted) {
          return;
        }
        setGroups(getPaginatedItems(groupsRes.data));
        setDashboard(dashboardRes.data || null);
        setProfileSnapshot(profileRes?.data || null);
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
    void fetchHomeData();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentUserId = dashboard?.current_user?.id || null;
  const onboardingIntroVersion = "v1";
  const onboardingGuideVersion = "v3";
  const onboardingIntroStorageKey = currentUserId
    ? `sv-home-intro-seen-${onboardingIntroVersion}-${currentUserId}`
    : "";
  const onboardingStorageKey = currentUserId
    ? `sv-home-guide-seen-${onboardingGuideVersion}-${currentUserId}`
    : "";

  const greetingMeta = getGreetingMeta();
  const currentUserFirstName =
    profileSnapshot?.first_name?.trim() || dashboard?.current_user?.username || "there";

  const totalGuideSlides = 3;
  const marketplaceGroups = groups.slice(0, 4);
  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const hasSeenIntro = window.localStorage.getItem(onboardingIntroStorageKey) === "1";
    const hasSeenGuide = window.localStorage.getItem(onboardingStorageKey) === "1";

    if (!hasSeenIntro) {
      setIntroStep(0);
      setShowIntro(true);
      setShowGuide(false);
      return;
    }

    setShowIntro(false);
    if (!hasSeenGuide) {
      setShowGuide(true);
    }
  }, [
    currentUserId,
    onboardingIntroStorageKey,
    onboardingStorageKey,
  ]);







  const introSlides = [
    {
      eyebrow: "Split the cost",
      title: "Rs 649 per month can become Rs 162 each.",
      body: "A host opens paid slots for a plan they already manage, members join, and everyone sees the same price before paying.",
      visual: "split",
    },
    {
      eyebrow: "Coordinate in one place",
      title: "Wallet, chat, confirmations, and updates stay together.",
      body: "ShareVerse keeps the money flow, group messages, and access confirmations in the same workspace so nobody has to chase context.",
      visual: "hub",
    },
    {
      eyebrow: "Choose your path",
      title: "Share a plan, join a live group, or start a buy-together.",
      body: "Use sharing when you already have the plan. Use buy-together when members commit first and the creator buys later.",
      visual: "paths",
    },
  ];

  const onboardingSteps = [
    {
      step: "01",
      title: "Add Rs 100 to your wallet",
      body: "Wallet balance lets you join paid groups without repeating checkout for every split.",
      cta: "Open Wallet",
      onClick: () => navigate("/wallet"),
      visual: "wallet",
    },
    {
      step: "02",
      title: "Browse a group that interests you",
      body: "Explore live listings, compare open slots and prices, then open a card to review details before joining.",
      cta: "Explore Groups",
      onClick: () => navigate("/groups"),
      visual: "browse",
    },
    {
      step: "03",
      title: "Or create your first split",
      body: "Start a sharing group for a plan you already manage, or collect commitments first with buy-together.",
      cta: "Create Split",
      onClick: () => navigate("/create"),
      visual: "create",
    },
  ];

  const markGuideSeen = () => {
    if (onboardingStorageKey) {
      window.localStorage.setItem(onboardingStorageKey, "1");
    }
  };

  const markIntroSeen = () => {
    if (onboardingIntroStorageKey) {
      window.localStorage.setItem(onboardingIntroStorageKey, "1");
    }
  };

  const dismissIntro = () => {
    markIntroSeen();
    markGuideSeen();
    setShowIntro(false);
    setShowGuide(false);
  };

  const continueIntro = () => {
    if (introStep < introSlides.length - 1) {
      setIntroStep((current) => Math.min(introSlides.length - 1, current + 1));
      return;
    }

    markIntroSeen();
    setShowIntro(false);
    setGuideStep(0);
    setShowGuide(true);
  };

  const startIntroAction = (path) => {
    markIntroSeen();
    markGuideSeen();
    setShowIntro(false);
    setShowGuide(false);
    navigate(path);
  };

  const dismissGuide = () => {
    markGuideSeen();
    setShowGuide(false);
  };



  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
          <SkeletonHero />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-32 rounded-[var(--sv-radius-card)]" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(260px,0.92fr)]">
            <SkeletonBlock className="h-56 rounded-[var(--sv-radius-card)]" />
            <SkeletonBlock className="h-56 rounded-[var(--sv-radius-card)]" />
          </div>
          <SkeletonList
            count={4}
            className="grid gap-4 lg:grid-cols-2"
            itemClassName="h-48 rounded-[var(--sv-radius-card)]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      {showIntro ? (
        <div className="sv-modal-backdrop">
          <div className="sv-guide-modal">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="sv-eyebrow">What is ShareVerse?</p>
                <h2 className="mt-2 text-xl font-bold leading-tight text-slate-950 sm:text-2xl">
                  {introSlides[introStep].title}
                </h2>
              </div>
              <button
                type="button"
                onClick={dismissIntro}
                aria-label="Skip introduction"
                className="min-h-[44px] px-1 py-2 text-[13px] font-semibold text-slate-500 transition hover:text-slate-800 sm:text-sm"
              >
                Skip
              </button>
            </div>

            <div className="mt-3 text-center text-[12px] font-medium text-slate-500 sm:mt-4 sm:text-sm">
              Panel {introStep + 1} of {introSlides.length}
            </div>
            <div className="sv-guide-dots">
              {introSlides.map((slide, index) => (
                <span
                  key={slide.eyebrow}
                  className={`sv-guide-dot ${index === introStep ? "sv-guide-dot-active" : ""}`}
                />
              ))}
            </div>

            <article className="sv-guide-step sv-intro-step sv-animate-rise">
              <ShareVerseIntroVisual type={introSlides[introStep].visual} />
              <div>
                <p className="sv-eyebrow">{introSlides[introStep].eyebrow}</p>
                <p className="mt-3 max-w-xl text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                  {introSlides[introStep].body}
                </p>
                {introStep === introSlides.length - 1 ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => startIntroAction("/create")}
                      className="sv-guide-map-item"
                    >
                      <span className="block text-[13px] font-semibold text-slate-950 sm:text-sm">
                        Share a plan
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Open paid slots
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startIntroAction("/groups")}
                      className="sv-guide-map-item"
                    >
                      <span className="block text-[13px] font-semibold text-slate-950 sm:text-sm">
                        Join a group
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Browse live splits
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startIntroAction("/create")}
                      className="sv-guide-map-item"
                    >
                      <span className="block text-[13px] font-semibold text-slate-950 sm:text-sm">
                        Buy together
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Commit first
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </article>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] leading-6 text-slate-500 sm:text-sm">
                A short walkthrough follows after this intro.
              </p>
              <button
                type="button"
                onClick={continueIntro}
                className="sv-btn-primary w-full justify-center sm:w-auto"
              >
                {introStep < introSlides.length - 1 ? "Next panel" : "Continue to walkthrough"}
              </button>
            </div>
          </div>
        </div>
      ) : showGuide ? (
        <div className="sv-modal-backdrop">
          <div className="sv-guide-modal">
            <div className="flex items-center justify-between gap-3">
              <p className="sv-eyebrow">3-step walkthrough</p>
              <button
                type="button"
                onClick={dismissGuide}
                aria-label="Skip guide"
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
              {guideStep < onboardingSteps.length ? (
                <article className="sv-guide-step sv-walkthrough-step sv-animate-rise">
                  <WalkthroughVisual type={onboardingSteps[guideStep].visual} />
                  <div>
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[12px] font-bold text-white sm:h-11 sm:w-11 sm:text-sm">
                        {onboardingSteps[guideStep].step}
                      </span>
                      <h3 className="text-[14px] font-semibold leading-snug text-slate-950 sm:text-lg">
                        {onboardingSteps[guideStep].title}
                      </h3>
                    </div>
                    <p className="mt-4 max-w-xl text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                      {onboardingSteps[guideStep].body}
                    </p>
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => {
                          dismissGuide();
                          onboardingSteps[guideStep].onClick();
                        }}
                        className="sv-btn-secondary w-full justify-center text-[13px] sm:w-auto sm:text-sm"
                      >
                        {onboardingSteps[guideStep].cta}
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}
            </div>
            <div className="sv-guide-nav">
              {guideStep === 0 ? (
                <span aria-hidden="true" className="min-h-[44px] w-24 shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={() => setGuideStep((current) => Math.max(0, current - 1))}
                  aria-label="Previous step"
                  className="sv-btn-secondary min-w-[96px]"
                >
                  Back
                </button>
              )}

              {guideStep < totalGuideSlides - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setGuideStep((current) =>
                      Math.min(totalGuideSlides - 1, current + 1)
                    )
                  }
                  aria-label="Next step"
                  className="sv-btn-primary min-w-[96px]"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dismissGuide}
                  className="sv-btn-primary min-w-[96px]"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="sv-home-shell">
          {/* ── HERO SECTION ── */}
          <section className="sv-home-hero sv-animate-rise">
            <div className="sv-home-hero-bg" aria-hidden="true">
              <img
                src="/shareverse-hero-characters.jpg"
                alt=""
                className="sv-home-hero-img"
                draggable="false"
              />
              <div className="sv-home-hero-gradient" />
            </div>

            <div className="sv-home-hero-content">
              <div className="sv-home-hero-top sv-stagger-1">
                <BrandMark sizeClass="h-10 w-10 sm:h-14 sm:w-14" roundedClass="rounded-xl sm:rounded-2xl shadow-lg" />
                <div className="sm:hidden">
                  {typeof toggleTheme === "function" && (
                    <ThemeToggle themeMode={themeMode} onToggle={toggleTheme} compact />
                  )}
                </div>
              </div>

              <div className="sv-home-hero-text sv-stagger-2">
                <p className="sv-home-greeting">{greetingMeta.text}</p>
                <h1 className="sv-home-name">{currentUserFirstName}.</h1>
                <p className="sv-home-tagline">
                  Split subscriptions, save money, and manage it all together.
                </p>
              </div>
            </div>
          </section>

          {/* ── QUICK ACTIONS ── */}
          <section className="sv-home-actions sv-stagger-3">
            <button
              type="button"
              onClick={() => navigate("/create")}
              className="sv-home-action-primary"
            >
              <PlusIcon className="h-5 w-5" />
              Create Split
            </button>
            <div className="sv-home-action-row">
              <button
                type="button"
                onClick={() => navigate("/my-shared")}
                className="sv-home-action-pill"
              >
                <LayersIcon className="h-4.5 w-4.5" />
                My Splits
              </button>
              <button
                type="button"
                onClick={() => navigate("/wallet")}
                className="sv-home-action-pill"
              >
                <WalletIcon className="h-4.5 w-4.5" />
                Wallet
              </button>
              <button
                type="button"
                onClick={() => navigate("/groups")}
                className="sv-home-action-pill"
              >
                <CompassIcon className="h-4.5 w-4.5" />
                Explore
              </button>
            </div>
          </section>

          {/* ── FRESH ACTIVITY ── */}
          <section className="sv-home-activity sv-stagger-4">
            <div className="sv-home-section-header">
              <div>
                <h2 className="sv-home-section-title">Fresh Activity</h2>
                <p className="sv-home-section-sub">New splits on ShareVerse</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/groups")}
                className="sv-home-see-all"
              >
                See all &rarr;
              </button>
            </div>

            {marketplaceGroups.length > 0 ? (
              <div className="sv-home-cards-scroll">
                {marketplaceGroups.map((group) => (
                  <RecentSplitCard
                    key={group.id}
                    group={group}
                    onClick={() => navigate("/groups")}
                  />
                ))}
              </div>
            ) : (
              <div className="sv-home-empty">
                <CompassIcon className="h-11 w-11 text-slate-400 dark:text-slate-500" />
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">No splits yet</h3>
                <p className="mt-1.5 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                  Create the first one or check back after more groups go live.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/create")}
                  className="sv-home-action-primary mt-5"
                  style={{ maxWidth: 220 }}
                >
                  <PlusIcon className="h-4.5 w-4.5" />
                  Create Split
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}



function ShareVerseIntroVisual({ type }) {
  return (
    <div className={`sv-intro-visual is-${type}`} aria-hidden="true">
      {type === "split" ? (
        <>
          <div className="sv-intro-price-card">
            <span>Netflix</span>
            <strong>Rs 649/mo</strong>
          </div>
          <div className="sv-intro-split-row">
            {[1, 2, 3, 4].map((item) => (
              <span key={item}>Rs 162</span>
            ))}
          </div>
        </>
      ) : type === "hub" ? (
        <>
          <div className="sv-intro-hub-node is-main">SV</div>
          <div className="sv-intro-hub-node">Wallet</div>
          <div className="sv-intro-hub-node">Chat</div>
          <div className="sv-intro-hub-node">Access</div>
        </>
      ) : (
        <div className="sv-intro-paths">
          <span>Share</span>
          <span>Join</span>
          <span>Buy together</span>
        </div>
      )}
    </div>
  );
}

function WalkthroughVisual({ type }) {
  return (
    <div className={`sv-walkthrough-visual is-${type}`} aria-hidden="true">
      {type === "wallet" ? (
        <>
          <WalletIcon className="h-7 w-7" />
          <span>Rs 100</span>
        </>
      ) : type === "browse" ? (
        <>
          <CompassIcon className="h-7 w-7" />
          <span>Live groups</span>
        </>
      ) : (
        <>
          <PlusIcon className="h-7 w-7" />
          <span>First split</span>
        </>
      )}
    </div>
  );
}




function RecentSplitCard({ group, onClick }) {
  const statusMeta = getRecentSplitStatusMeta(group.status);
  const progressPercent = Math.max(
    6,
    Math.min(100, Math.round(Number(group.progress_percent || 0)))
  );
  const joinPrice = Number(group.join_price || group.price_per_slot || 0);
  const remainingSlots = Math.max(
    Number(group.remaining_slots ?? Number(group.total_slots || 0) - Number(group.filled_slots || 0)) ||
      0,
    0
  );

  return (
    <article 
      onClick={onClick}
      className="sv-premium-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 cursor-pointer group relative overflow-hidden"
    >
      <div className="absolute top-3 right-3 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200/50 backdrop-blur text-slate-700 z-10 dark:bg-slate-800/80 dark:border-slate-700/50 dark:text-slate-300">
        {group.mode === "group_buy" ? "Buy Together" : "Sharing"}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dotTone}`} />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {statusMeta.label}
            </span>
          </div>
          <div className="flex items-center gap-2.5 mt-3">
            <SubscriptionLogo name={group.subscription_name} size={32} />
            <h3 className="truncate text-lg font-bold text-slate-950">
              {group.subscription_name}
            </h3>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {group.mode_label} by {group.owner_name}
          </p>
        </div>
        <span className="sv-chip shrink-0 whitespace-nowrap">
          {remainingSlots} slot{remainingSlots === 1 ? "" : "s"} left
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="sv-stat-block rounded-2xl px-4 py-3.5">
          <p className="text-[11px] uppercase font-bold tracking-[0.15em] text-slate-500 dark:text-slate-400">Join price</p>
          <p className="mt-1.5 text-lg font-black text-slate-900 dark:text-white">
            {formatCurrency(joinPrice)}
          </p>
        </div>
        <div className="sv-stat-block rounded-2xl px-4 py-3.5">
          <p className="text-[11px] uppercase font-bold tracking-[0.15em] text-slate-500 dark:text-slate-400">Updated</p>
          <p className="mt-1.5 text-base font-bold text-slate-900 dark:text-white">
            {formatRelativeTime(group.created_at)}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 text-[13px] font-bold text-slate-600 dark:text-slate-300">
          <span>
            {group.filled_slots} of {group.total_slots} filled
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 shadow-inner">
          <span
            className={`block h-full rounded-full ${
              group.mode === "group_buy" ? "bg-slate-600 dark:bg-slate-400" : "sv-progress-glow"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase font-bold tracking-[0.15em] text-slate-500 dark:text-slate-400">Host</p>
          <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
            {group.owner_name || "ShareVerse host"}
          </p>
        </div>
        <button type="button" onClick={onClick} className="sv-btn-secondary group-hover:bg-slate-100 dark:group-hover:bg-slate-700 transition-colors">
          Explore
        </button>
      </div>
    </article>
  );
}
