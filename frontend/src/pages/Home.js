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

export default function Home() {
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
              <SkeletonBlock key={index} className="h-32 rounded-[length:var(--sv-radius-card)]" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(260px,0.92fr)]">
            <SkeletonBlock className="h-56 rounded-[length:var(--sv-radius-card)]" />
            <SkeletonBlock className="h-56 rounded-[length:var(--sv-radius-card)]" />
          </div>
          <SkeletonList
            count={4}
            className="grid gap-4 lg:grid-cols-2"
            itemClassName="h-48 rounded-[length:var(--sv-radius-card)]"
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
        <div className="mx-auto max-w-5xl space-y-12 sm:space-y-16 px-4 py-8 sm:px-6 lg:px-8">
          {/* HERO SECTION */}
          <section className="relative overflow-hidden rounded-[32px] border border-white/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 p-8 shadow-sm backdrop-blur-2xl sm:p-12 sv-animate-rise">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-100 dark:from-emerald-900/30 to-teal-50 dark:to-teal-900/30 opacity-50 blur-3xl"></div>
            
            <div className="relative z-10 flex flex-col gap-6">
              <BrandMark sizeClass="h-12 w-12 sm:h-14 sm:w-14" roundedClass="rounded-2xl shadow-sm" />
              
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  {greetingMeta.text}
                </p>
                <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                  {currentUserFirstName}.
                </h1>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                  Manage your shared subscriptions, track wallet balances, and explore new groups—all from your command center.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => navigate("/create")}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-white px-6 py-3.5 text-sm font-semibold text-white dark:text-slate-900 shadow-md transition-all hover:scale-105 hover:bg-slate-800 dark:hover:bg-slate-100 hover:shadow-lg active:scale-95"
                >
                  <PlusIcon className="h-5 w-5" />
                  Create Split
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/splits")}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-6 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200 backdrop-blur-md transition-all hover:scale-105 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm active:scale-95"
                >
                  <LayersIcon className="h-5 w-5" />
                  My Splits
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/wallet")}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-6 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200 backdrop-blur-md transition-all hover:scale-105 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm active:scale-95"
                >
                  <WalletIcon className="h-5 w-5" />
                  Wallet
                </button>
              </div>
            </div>
          </section>

          {/* RECENT SPLITS */}
          <section className="space-y-6 sv-animate-rise sv-delay-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Fresh Activity</h2>
                <p className="mt-1 text-sm text-slate-500">Discover new splits just added to ShareVerse.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/groups")}
                className="hidden items-center gap-2 text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-700 sm:inline-flex"
              >
                Explore all &rarr;
              </button>
            </div>

            {marketplaceGroups.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
                {marketplaceGroups.map((group) => (
                  <RecentSplitCard
                    key={group.id}
                    group={group}
                    onClick={() => navigate("/groups")}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                <CompassIcon className="h-12 w-12 text-slate-400" />
                <h3 className="mt-4 text-lg font-bold text-slate-900">No splits are visible yet</h3>
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  Create the first one or check back after more groups go live.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/create")}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:scale-105 hover:bg-slate-800 active:scale-95"
                >
                  <PlusIcon className="h-4.5 w-4.5" />
                  Create Split
                </button>
              </div>
            )}
            
            <button
              type="button"
              onClick={() => navigate("/groups")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-6 py-3.5 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-200 active:scale-95 sm:hidden"
            >
              Explore all &rarr;
            </button>
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
    <article className="rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Join price</p>
          <p className="mt-1 text-base font-semibold text-slate-950">
            {formatCurrency(joinPrice)}
          </p>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Updated</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {formatRelativeTime(group.created_at)}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
          <span>
            {group.filled_slots} of {group.total_slots} filled
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <span
            className={`block h-full rounded-full ${
              group.mode === "group_buy" ? "bg-slate-500" : "bg-slate-900"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Host</p>
          <p className="mt-1 text-base font-semibold text-slate-950">
            {group.owner_name || "ShareVerse host"}
          </p>
        </div>
        <button type="button" onClick={onClick} className="sv-btn-secondary">
          Explore
        </button>
      </div>
    </article>
  );
}
