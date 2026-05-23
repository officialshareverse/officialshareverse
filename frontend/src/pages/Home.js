import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import { getPaginatedItems } from "../api/pagination";
import BrandMark from "../components/BrandMark";
import {
  SkeletonBlock,
  SkeletonHero,
  SkeletonList,
} from "../components/SkeletonFactory";
import {
  BellIcon,
  CompassIcon,
  LayersIcon,
  PlusIcon,
  WalletIcon,
} from "../components/UiIcons";
import useIsMobile from "../hooks/useIsMobile";

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return `Rs ${numeric.toFixed(2)}`;
}

function formatMetricValue(value, { prefix = "", suffix = "", decimals = 0 } = {}) {
  const numeric = Number(value || 0);
  if (decimals > 0) {
    return `${prefix}${numeric.toFixed(decimals)}${suffix}`;
  }
  return `${prefix}${numeric}${suffix}`;
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
  const isMobile = useIsMobile();
  const [groups, setGroups] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [profileSnapshot, setProfileSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const ownerSummary = dashboard?.owner_summary || {};
  const notifications = useMemo(
    () => (Array.isArray(dashboard?.notifications) ? dashboard.notifications : []),
    [dashboard?.notifications]
  );
  const memberships = useMemo(
    () => (Array.isArray(dashboard?.groups) ? dashboard.groups : []),
    [dashboard?.groups]
  );
  const unreadNotifications = notifications.filter((item) => !item.is_read).length;
  const membershipNeedsAttention = memberships.filter(
    (group) => group.access_confirmation_required || group.has_reported_access_issue
  ).length;
  const greetingMeta = getGreetingMeta();
  const currentUserFirstName =
    profileSnapshot?.first_name?.trim() || dashboard?.current_user?.username || "there";
  const walletBalanceValue = Number(dashboard?.wallet_balance || 0);
  const activeGroups = Number(dashboard?.active_groups || 0);
  const totalSpent = Number(profileSnapshot?.total_spent || dashboard?.total_spent || 0);
  const profileCompletion = Number(profileSnapshot?.profile_completion || 0);
  const totalGuideSlides = 3;
  const marketplaceGroups = groups.slice(0, isMobile ? 2 : 4);
  const activeActionCount =
    membershipNeedsAttention + Number(ownerSummary.buy_together_waiting || 0);
  const heroSummary =
    totalSpent > 0
      ? `${formatCurrency(totalSpent)} has moved through your ShareVerse activity so far.`
      : activeActionCount > 0
        ? `${activeActionCount} item${activeActionCount === 1 ? "" : "s"} need your attention right now.`
        : groups.length > 0
          ? "Everything looks calm right now. You can browse new splits or open the next one."
          : "You are ready to create your first split whenever you want.";

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

  const primaryCard = useMemo(() => {
    if (ownerSummary.buy_together_waiting > 0) {
      return {
        label: "Waiting on you",
        title: "Buy-together groups need the next host action.",
        body: "Upload proof, confirm the purchase step, or update members so the whole flow keeps moving.",
        cta: "Open My Splits",
        onClick: () => navigate("/my-shared"),
        icon: <LayersIcon className="h-5 w-5" />,
        progressCurrent: Number(ownerSummary.buy_together_waiting || 0),
        progressTotal: Math.max(
          Number(ownerSummary.total_groups_created || 0),
          Number(ownerSummary.buy_together_waiting || 0),
          1
        ),
      };
    }
    if (membershipNeedsAttention > 0) {
      return {
        label: "Needs attention",
        title: "A joined split is waiting for your response.",
        body: "Review confirmations, issue reports, and unread context from My Splits before anything stalls.",
        cta: "Review My Splits",
        onClick: () => navigate("/my-shared"),
        icon: <BellIcon className="h-5 w-5" />,
        progressCurrent: membershipNeedsAttention,
        progressTotal: Math.max(memberships.length, membershipNeedsAttention, 1),
      };
    }
    if (groups.length > 0) {
      return {
        label: "Explore next",
        title: "Fresh splits are open and ready to browse.",
        body: "Scan recent listings, compare slots and pricing, and jump into the ones that fit your plan stack.",
        cta: "Explore Splits",
        onClick: () => navigate("/groups"),
        icon: <CompassIcon className="h-5 w-5" />,
        progressCurrent: Math.min(groups.length, 4),
        progressTotal: Math.max(groups.length, 4),
      };
    }
    return {
      label: "Get started",
      title: "Create your first split with a guided launch flow.",
      body: "Start with a plan you already manage or open a buy-together group and publish it in a few steps.",
      cta: "Create Split",
      onClick: () => navigate("/create"),
      icon: <PlusIcon className="h-5 w-5" />,
      progressCurrent: 1,
      progressTotal: 4,
    };
  }, [
    groups.length,
    membershipNeedsAttention,
    memberships.length,
    navigate,
    ownerSummary.buy_together_waiting,
    ownerSummary.total_groups_created,
  ]);

  const stats = useMemo(
    () => [
      {
        label: "Wallet balance",
        numericValue: walletBalanceValue,
        decimals: 2,
        prefix: "Rs ",
        icon: <WalletIcon className="h-4 w-4" />,
        onClick: () => navigate("/wallet"),
        note: walletBalanceValue > 0 ? "Ready for paid groups" : "Top up to join faster",
      },
      {
        label: "Active groups",
        numericValue: activeGroups,
        icon: <LayersIcon className="h-4 w-4" />,
        onClick: () => navigate("/my-shared"),
        note: `${memberships.length} total memberships`,
      },
      {
        label: "Hosting now",
        numericValue: Number(ownerSummary.total_groups_created || 0),
        icon: <PlusIcon className="h-4 w-4" />,
        onClick: () => navigate("/my-shared"),
        note:
          ownerSummary.buy_together_waiting > 0
            ? `${ownerSummary.buy_together_waiting} waiting on you`
            : "Your hosted split queue",
      },
      {
        label: "Unread updates",
        numericValue: unreadNotifications,
        icon: <BellIcon className="h-4 w-4" />,
        onClick: () => navigate("/notifications"),
        note: unreadNotifications > 0 ? `${activeActionCount} open actions` : "Inbox is clear",
      },
    ],
    [
      activeActionCount,
      activeGroups,
      memberships.length,
      navigate,
      ownerSummary.buy_together_waiting,
      ownerSummary.total_groups_created,
      unreadNotifications,
      walletBalanceValue,
    ]
  );

  const visibleStats = isMobile ? stats.slice(0, 2) : stats;

  const quickChecks = useMemo(
    () => [
      {
        label: "Profile",
        value: profileCompletion > 0 ? `${profileCompletion}% complete` : "Needs setup",
        note:
          profileCompletion > 0
            ? "Trust checks look better with a complete profile."
            : "Add profile basics and payout details.",
        onClick: () => navigate("/profile"),
      },
      {
        label: "Wallet",
        value: walletBalanceValue > 0 ? formatCurrency(walletBalanceValue) : "No balance",
        note:
          walletBalanceValue > 0
            ? "Available now for paid groups."
            : "Top up before joining paid groups.",
        onClick: () => navigate("/wallet"),
      },
      {
        label: "Attention",
        value: activeActionCount > 0 ? `${activeActionCount} open` : "All clear",
        note:
          activeActionCount > 0
            ? "Open My Splits or notifications to clear them."
            : "No urgent action is waiting right now.",
        onClick: () =>
          activeActionCount > 0 ? navigate("/my-shared") : navigate("/notifications"),
      },
    ],
    [activeActionCount, navigate, profileCompletion, walletBalanceValue]
  );

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

  const openGuide = () => {
    setGuideStep(0);
    setShowGuide(true);
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
      ) : null}

      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 sm:px-4 sm:py-3 sm:text-sm">
            {error}
          </div>
        ) : null}

        <section className="rounded-[length:var(--sv-radius-card-md)] border border-slate-200 bg-white p-5 shadow-sm sv-animate-rise sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_320px] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <BrandMark sizeClass="h-10 w-10 sm:h-11 sm:w-11" roundedClass="rounded-[14px] sm:rounded-[16px]" />
                <span className="sv-chip">Dashboard</span>
                {!isMobile ? <span className="sv-chip">{activeGroups} active groups</span> : null}
              </div>
              <p className="sv-eyebrow mt-5">
                {greetingMeta.text}, {currentUserFirstName}.
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
                {isMobile
                  ? "Your dashboard"
                  : "Your dashboard for savings, wallet balance, and active splits."}
              </h1>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7 md:text-base">
                See what you can join, what you host, and what needs action next.
              </p>

              <div className="mt-4 rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                {heroSummary}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <QuickActionButton
                  icon={<PlusIcon className="h-4.5 w-4.5" />}
                  title="Create split"
                  onClick={() => navigate("/create")}
                />
                <QuickActionButton
                  icon={<LayersIcon className="h-4.5 w-4.5" />}
                  title="My Splits"
                  onClick={() => navigate("/my-shared")}
                />
                <QuickActionButton
                  icon={<WalletIcon className="h-4.5 w-4.5" />}
                  title="Wallet"
                  onClick={() => navigate("/wallet")}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={openGuide} className="sv-btn-secondary">
                  Quick guide
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/groups")}
                  className="sv-btn-secondary"
                >
                  Explore splits
                </button>
              </div>
            </div>

            <aside className="rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-slate-50 p-5">
              <p className="sv-eyebrow">Overview</p>
              <div className="mt-4 grid gap-3">
                <SummaryLine label="Wallet balance" value={formatCurrency(walletBalanceValue)} />
                <SummaryLine label="Active groups" value={`${activeGroups}`} />
                <SummaryLine label="Unread updates" value={`${unreadNotifications}`} />
                <SummaryLine
                  label="Hosting now"
                  value={`${Number(ownerSummary.total_groups_created || 0)}`}
                />
              </div>
              <div className="mt-4 rounded-[18px] border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700">
                {activeActionCount > 0
                  ? `${activeActionCount} action item${activeActionCount === 1 ? "" : "s"} still need your touch.`
                  : "No urgent item is blocking you right now."}
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 sv-animate-rise sv-delay-1">
          {visibleStats.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </section>

        <section
          className={`grid gap-4 sm:gap-6 sv-animate-rise sv-delay-2 ${
            isMobile ? "" : "lg:grid-cols-[minmax(0,1.08fr)_minmax(260px,0.92fr)]"
          }`}
        >
          <section className="rounded-[length:var(--sv-radius-card-md)] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="sv-eyebrow">{primaryCard.label}</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950 sm:text-[1.75rem]">
                  {primaryCard.title}
                </h2>
                <p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                  {primaryCard.body}
                </p>
              </div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] bg-slate-100 text-slate-700">
                {primaryCard.icon}
              </span>
            </div>

            <div className="mt-5 rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3 text-[12px] font-semibold text-slate-500">
                <span>Progress snapshot</span>
                <span>
                  {primaryCard.progressCurrent} of {primaryCard.progressTotal}
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <span
                  className="block h-full rounded-full bg-slate-900 transition-all"
                  style={{
                    width: `${Math.max(
                      8,
                      Math.min(
                        100,
                        Math.round(
                          (primaryCard.progressCurrent / primaryCard.progressTotal) * 100
                        )
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={primaryCard.onClick}
                className="sv-btn-primary"
              >
                {primaryCard.cta}
              </button>
            </div>
          </section>

          <aside className="rounded-[length:var(--sv-radius-card-md)] border border-slate-200 bg-slate-50 p-5">
            <p className="sv-eyebrow">Quick checks</p>
            <div className="mt-4 space-y-3">
              {quickChecks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="w-full rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {item.value}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.note}</p>
                </button>
              ))}
            </div>
          </aside>
        </section>

        <section className="sv-animate-rise sv-delay-3">
          <div className="sv-divider" />
          <div className="mt-4 sm:mt-5">
            <p className="sv-eyebrow">Recent splits</p>
            <h2 className="sv-title mt-1.5">Fresh activity on ShareVerse</h2>
          </div>

          {marketplaceGroups.length > 0 ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {marketplaceGroups.map((group) => (
                <RecentSplitCard
                  key={group.id}
                  group={group}
                  onClick={() => navigate("/groups")}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-lg font-bold text-slate-950">No splits are visible yet.</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Create the first one or check back after more groups go live.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/create")}
                  className="sv-btn-primary"
                >
                  Create split
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/groups")}
                  className="sv-btn-secondary"
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

function QuickActionButton({ icon, title, note, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[48px] items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:shadow-sm"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        {icon}
      </span>
      <span className="min-w-0 text-left">
        <span className="block">{title}</span>
        {note ? (
          <span className="mt-0.5 block text-xs font-normal text-slate-500">{note}</span>
        ) : null}
      </span>
    </button>
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

function StatCard({
  label,
  numericValue,
  icon,
  onClick,
  note,
  prefix = "",
  suffix = "",
  decimals = 0,
}) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <article
      className="cursor-pointer rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-5"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-slate-100 text-slate-700">
            {icon}
          </span>
          <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-xs">
            {label}
          </p>
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">
        {formatMetricValue(numericValue, { prefix, suffix, decimals })}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{note}</p>
    </article>
  );
}

function SummaryLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
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
          <h3 className="mt-3 truncate text-lg font-bold text-slate-950">
            {group.subscription_name}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {group.mode_label} by {group.owner_name}
          </p>
        </div>
        <span className="sv-chip">
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
