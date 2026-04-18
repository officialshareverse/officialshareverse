import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
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
  ProgressRing,
  SparkIcon,
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
    return { text: "Good morning", emoji: "🌅" };
  }
  if (hour < 17) {
    return { text: "Good afternoon", emoji: "☀️" };
  }
  return { text: "Good evening", emoji: "🌙" };
}

function getRecentSplitStatusMeta(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("active") || normalized.includes("open") || normalized.includes("confirmed")) {
    return { label: formatGroupType(status), dotClassName: "is-active" };
  }
  if (normalized.includes("forming") || normalized.includes("pending") || normalized.includes("proof") || normalized.includes("review") || normalized.includes("waiting")) {
    return { label: formatGroupType(status), dotClassName: "is-pending" };
  }
  if (normalized.includes("closed") || normalized.includes("cancelled") || normalized.includes("completed")) {
    return { label: formatGroupType(status), dotClassName: "is-closed" };
  }
  return { label: formatGroupType(status), dotClassName: "is-neutral" };
}

function getInitials(value) {
  return (
    String(value || "SV")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "SV"
  );
}

function buildSparklineValues(seed, index) {
  const numericSeed = Math.max(1, Number(seed) || 1);
  return Array.from({ length: 6 }, (_, point) => {
    const baseline = 26 + point * 10;
    const variance = Math.sin((point + 1.3) * (index + 1.4)) * 8;
    const value = baseline + variance + Math.min(18, numericSeed % 19);
    return Math.max(10, Math.min(92, Math.round(value)));
  });
}

function buildSparklinePath(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "";
  }
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 100 - value;
      return `${x},${y}`;
    })
    .join(" ");
}

function buildSparklineArea(values) {
  const line = buildSparklinePath(values);
  return line ? `0,100 ${line} 100,100` : "";
}

function buildRecentAvatarTokens(group) {
  const tokens = [getInitials(group.owner_name), getInitials(group.subscription_name)];
  const extraMembers = Math.max(0, Number(group.filled_slots || group.paid_members || 0) - 1);
  if (extraMembers > 0) {
    tokens.push(`+${Math.min(extraMembers, 9)}`);
  }
  return tokens.slice(0, 3);
}

export default function Home() {
  const navigate = useNavigate();
  const focusSectionRef = useRef(null);
  const [groups, setGroups] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [profileSnapshot, setProfileSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchHomeData = async () => {
      try {
        const profilePromise = API.get("profile/").catch(() => null);
        const [groupsRes, dashboardRes, profileRes] = await Promise.all([
          API.get("groups/"),
          API.get("dashboard/"),
          profilePromise,
        ]);
        if (!isMounted) {
          return;
        }
        setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
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
  const notifications = useMemo(
    () => (Array.isArray(dashboard?.notifications) ? dashboard.notifications : []),
    [dashboard?.notifications]
  );
  const memberships = useMemo(
    () => (Array.isArray(dashboard?.groups) ? dashboard.groups : []),
    [dashboard?.groups]
  );
  const unreadNotifications = notifications.filter((item) => !item.is_read).length;
  const membershipNeedsAttention = memberships.filter((group) => group.access_confirmation_required || group.has_reported_access_issue).length;
  const greetingMeta = getGreetingMeta();
  const currentUserFirstName = profileSnapshot?.first_name?.trim() || dashboard?.current_user?.username || "there";
  const walletBalanceValue = Number(dashboard?.wallet_balance || 0);
  const activeGroups = Number(dashboard?.active_groups || 0);
  const totalSpent = Number(profileSnapshot?.total_spent || dashboard?.total_spent || 0);
  const profileCompletion = Number(profileSnapshot?.profile_completion || 0);
  const totalGuideSlides = 7;
  const marketplaceGroups = groups.slice(0, 4);
  const activeActionCount = membershipNeedsAttention + Number(ownerSummary.buy_together_waiting || 0);
  const walletReadiness = walletBalanceValue > 0 ? Math.min(100, Math.round((walletBalanceValue / 500) * 100)) : 8;
  const responseHealth = activeActionCount > 0 ? Math.max(18, 100 - activeActionCount * 18) : 100;

  const logoCloud = useMemo(() => {
    const fallbackLabels = ["Netflix", "Spotify", "Prime", "Canva", "Notion", "Adobe", "Coursera", "Figma"];
    const labels = [...memberships.map((group) => group.subscription_name), ...groups.map((group) => group.subscription_name || group.name), ...fallbackLabels].filter(Boolean);
    return Array.from(new Set(labels)).slice(0, 9).map((label, index) => ({
      id: `${label}-${index}`,
      label,
      token: getInitials(label),
      tone: ["is-teal", "is-violet", "is-gold"][index % 3],
    }));
  }, [groups, memberships]);

  const primaryCard = useMemo(() => {
    if (ownerSummary.buy_together_waiting > 0) {
      return {
        label: "Waiting on you",
        title: "Buy-together groups need the next host action.",
        body: "Upload proof, confirm the purchase step, or update members so the whole flow keeps moving.",
        cta: "Open My Splits",
        onClick: () => navigate("/my-shared"),
        accent: "is-violet",
        icon: <SparkIcon className="h-5 w-5" />,
        progressCurrent: Number(ownerSummary.buy_together_waiting || 0),
        progressTotal: Math.max(Number(ownerSummary.total_groups_created || 0), Number(ownerSummary.buy_together_waiting || 0), 1),
      };
    }
    if (membershipNeedsAttention > 0) {
      return {
        label: "Needs attention",
        title: "A joined split is waiting for your response.",
        body: "Review confirmations, issue reports, and unread context from My Splits before anything stalls.",
        cta: "Review My Splits",
        onClick: () => navigate("/my-shared"),
        accent: "is-rose",
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
        accent: "is-teal",
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
      accent: "is-gold",
      icon: <PlusIcon className="h-5 w-5" />,
      progressCurrent: 1,
      progressTotal: 4,
    };
  }, [groups.length, membershipNeedsAttention, memberships.length, navigate, ownerSummary.buy_together_waiting, ownerSummary.total_groups_created]);

  const stats = useMemo(() => [
    {
      label: "Wallet balance",
      numericValue: walletBalanceValue,
      decimals: 2,
      prefix: "Rs ",
      icon: <WalletIcon className="h-4 w-4" />,
      onClick: () => navigate("/wallet"),
      className: "is-wallet",
      note: walletBalanceValue > 0 ? "Ready for paid groups" : "Top up to join faster",
      sparkline: buildSparklineValues(walletBalanceValue, 0),
    },
    {
      label: "Active groups",
      numericValue: activeGroups,
      icon: <LayersIcon className="h-4 w-4" />,
      onClick: () => navigate("/my-shared"),
      className: "is-groups",
      note: `${memberships.length} total memberships`,
      sparkline: buildSparklineValues(activeGroups, 1),
    },
    {
      label: "Hosting now",
      numericValue: Number(ownerSummary.total_groups_created || 0),
      icon: <PlusIcon className="h-4 w-4" />,
      onClick: () => navigate("/my-shared"),
      className: "is-hosting",
      note: ownerSummary.buy_together_waiting > 0 ? `${ownerSummary.buy_together_waiting} waiting on you` : "Your hosted split queue",
      sparkline: buildSparklineValues(ownerSummary.total_groups_created || 0, 2),
    },
    {
      label: "Unread updates",
      numericValue: unreadNotifications,
      icon: <BellIcon className="h-4 w-4" />,
      onClick: () => navigate("/notifications"),
      className: "is-alerts",
      note: unreadNotifications > 0 ? `${activeActionCount} open actions` : "Inbox is clear",
      sparkline: buildSparklineValues(unreadNotifications, 3),
    },
  ], [activeActionCount, activeGroups, memberships.length, navigate, ownerSummary.buy_together_waiting, ownerSummary.total_groups_created, unreadNotifications, walletBalanceValue]);

  const focusItems = useMemo(() => [
    {
      label: "Profile completeness",
      value: profileCompletion,
      note: profileCompletion > 0 ? `${profileCompletion}% ready for trust checks` : "Add profile basics and payout details",
      onClick: () => navigate("/profile"),
      tone: "is-profile",
    },
    {
      label: "Wallet readiness",
      value: walletReadiness,
      note: walletBalanceValue > 0 ? `${formatCurrency(walletBalanceValue)} available now` : "Top up before joining paid groups",
      onClick: () => navigate("/wallet"),
      tone: "is-wallet",
    },
    {
      label: "Response health",
      value: responseHealth,
      note: activeActionCount > 0 ? `${activeActionCount} actions to clear` : "You are caught up right now",
      onClick: () => (activeActionCount > 0 ? navigate("/my-shared") : navigate("/notifications")),
      tone: "is-alerts",
    },
  ], [activeActionCount, navigate, profileCompletion, responseHealth, walletBalanceValue, walletReadiness]);

  const onboardingSteps = [
    { step: "01", title: "Create a new split", body: "Tap 'Create split' on the home screen to set up a subscription, course, or software plan for others to join.", cta: "Create Split", onClick: () => navigate("/create") },
    { step: "02", title: "Pick sharing or buy-together", body: "Choose 'Sharing' if you already own the plan, or 'Buy together' if the group buys it after members join.", cta: "Open Create Flow", onClick: () => navigate("/create") },
    { step: "03", title: "Set the details and publish", body: "Name your split, choose slots, set the price per slot, review dates, and publish when ready.", cta: "Continue Setup", onClick: () => navigate("/create") },
    { step: "04", title: "Manage everything in My Splits", body: "Check members, chat, confirmations, and actions all in one place after creating or joining a split.", cta: "Open My Splits", onClick: () => navigate("/my-shared") },
    { step: "05", title: "Add money or withdraw from Wallet", body: "Top up via Razorpay before joining paid groups. Request withdrawals anytime; they're usually settled within 24 hours.", cta: "Open Wallet", onClick: () => navigate("/wallet") },
  ];

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
        <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
          <SkeletonHero />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-32 rounded-[24px]" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(260px,0.92fr)]">
            <SkeletonBlock className="h-56 rounded-[24px]" />
            <SkeletonBlock className="h-56 rounded-[24px]" />
          </div>
          <SkeletonList count={4} className="grid gap-4 lg:grid-cols-2" itemClassName="h-48 rounded-[24px]" />
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
              <button type="button" onClick={dismissGuide} className="min-h-[44px] px-1 py-2 text-[13px] font-semibold text-slate-500 transition hover:text-slate-800 sm:text-sm">
                Skip
              </button>
            </div>

            <div className="mt-3 text-center text-[12px] font-medium text-slate-500 sm:mt-4 sm:text-sm">
              Step {guideStep + 1} of {totalGuideSlides}
            </div>
            <div className="sv-guide-dots">
              {Array.from({ length: totalGuideSlides }).map((_, index) => (
                <span key={`guide-dot-${index}`} className={`sv-guide-dot ${index === guideStep ? "sv-guide-dot-active" : ""}`} />
              ))}
            </div>

            <div className="mt-4 sm:mt-6">
              {guideStep === 0 ? (
                <div className="sv-guide-step sv-animate-rise">
                  <h2 className="text-xl font-bold leading-tight text-slate-950 sm:text-2xl">Welcome to ShareVerse 👋</h2>
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
                  <button type="button" onClick={dismissGuide} className="sv-btn-primary w-full justify-center sm:w-auto">
                    Got it
                  </button>
                </div>
              )}
            </div>

            <div className="sv-guide-nav">
              {guideStep === 0 ? (
                <span aria-hidden="true" className="min-h-[44px] w-24 shrink-0" />
              ) : (
                <button type="button" onClick={() => setGuideStep((current) => Math.max(0, current - 1))} className="sv-btn-secondary min-w-[96px]">
                  Back
                </button>
              )}

              {guideStep < totalGuideSlides - 1 ? (
                <button type="button" onClick={() => setGuideStep((current) => Math.min(totalGuideSlides - 1, current + 1))} className="sv-btn-primary min-w-[96px]">
                  Next
                </button>
              ) : (
                <span aria-hidden="true" className="min-h-[44px] w-24 shrink-0" />
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

        <section className="sv-dark-hero sv-animate-rise">
          <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <BrandMark glow sizeClass="h-10 w-10 sm:h-12 sm:w-12" roundedClass="rounded-[14px] sm:rounded-[18px]" />
                <span className="sv-chip-dark">Dashboard</span>
                <span className="sv-chip-dark">{activeGroups} active groups</span>
              </div>
              <p className="sv-eyebrow-on-dark mt-4 sm:mt-5">
                {greetingMeta.text}, {currentUserFirstName} {greetingMeta.emoji}
              </p>
              <h1 className="sv-display-on-dark mt-4 max-w-4xl sm:mt-5">
                Your shared-cost dashboard is cleaner, faster, and ready to act on.
              </h1>
              <p className="sv-home-hero-body mt-3 max-w-3xl text-[13px] leading-6 text-slate-300 sm:mt-4 sm:text-sm sm:leading-7 md:text-base md:leading-8">
                Jump into the next thing that matters, keep wallet and group activity visible at a glance, and scan recent splits without digging through dense cards.
              </p>

              <div className="sv-home-personal-note">
                <SparkIcon className="h-4.5 w-4.5" />
                <span>
                  {totalSpent > 0
                    ? `${formatCurrency(totalSpent)} has already moved through your ShareVerse activity.`
                    : `You have ${activeGroups} active group${activeGroups === 1 ? "" : "s"} moving right now.`}
                </span>
              </div>

              <div className="sv-home-quick-actions">
                <QuickActionButton icon={<PlusIcon className="h-4.5 w-4.5" />} title="Create" note="New split" onClick={() => navigate("/create")} />
                <QuickActionButton icon={<WalletIcon className="h-4.5 w-4.5" />} title="Top up" note="Add wallet funds" onClick={() => navigate("/wallet")} />
                <QuickActionButton icon={<LayersIcon className="h-4.5 w-4.5" />} title="Dashboard" note="Jump to focus" onClick={() => focusSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={openGuide} className="sv-btn-ghost-dark">Quick guide</button>
                <button type="button" onClick={() => navigate("/groups")} className="sv-btn-ghost-dark">Explore splits</button>
              </div>
            </div>

            <div className="sv-home-logo-cloud">
              <div className="sv-home-logo-grid">
                {logoCloud.map((item) => (
                  <div key={item.id} className={`sv-home-logo-chip ${item.tone}`}>
                    <span className="sv-home-logo-token">{item.token}</span>
                    <span className="sv-home-logo-label">{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="sv-home-hero-card">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">This week</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-[20px] border border-white/10 bg-white/10 px-3 py-3">
                    <p className="text-[11px] text-white/70">Wallet</p>
                    <p className="mt-2 text-lg font-bold text-white">{formatCurrency(walletBalanceValue)}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-white/10 px-3 py-3">
                    <p className="text-[11px] text-white/70">Actions</p>
                    <p className="mt-2 text-lg font-bold text-white">{activeActionCount || unreadNotifications}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-[20px] border border-emerald-200/20 bg-emerald-300/10 px-3 py-3 text-sm text-emerald-50">
                  {activeActionCount > 0
                    ? `${activeActionCount} items still need your touch in My Splits.`
                    : "Everything looks calm right now. Browse or publish the next split."}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sv-grid-stats sv-animate-rise sv-delay-1">
          {stats.map((item) => <StatCard key={item.label} {...item} />)}
        </section>

        <section className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(260px,0.92fr)] sv-animate-rise sv-delay-2">
          <section className={`sv-home-primary-card ${primaryCard.accent}`}>
            <div className="sv-home-primary-rail" />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="sv-eyebrow">{primaryCard.label}</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950 sm:text-[1.75rem]">{primaryCard.title}</h2>
                <p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">{primaryCard.body}</p>
              </div>
              <span className="sv-home-primary-icon">{primaryCard.icon}</span>
            </div>

            <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-white/70 px-4 py-4">
              <div className="flex items-center justify-between gap-3 text-[12px] font-semibold text-slate-500">
                <span>Progress snapshot</span>
                <span>{primaryCard.progressCurrent} of {primaryCard.progressTotal}</span>
              </div>
              <div className="sv-home-inline-progress mt-3">
                <span className="sv-home-inline-progress-fill" style={{ width: `${Math.max(8, Math.min(100, Math.round((primaryCard.progressCurrent / primaryCard.progressTotal) * 100)))}%` }} />
              </div>
            </div>

            <div className="mt-5">
              <button type="button" onClick={primaryCard.onClick} className="sv-btn-primary">{primaryCard.cta}</button>
            </div>
          </section>

          <aside ref={focusSectionRef} className="sv-card sv-home-focus-card" id="sv-home-focus">
            <p className="sv-eyebrow">Quick focus</p>
            <h2 className="sv-title mt-1.5 sm:mt-2">Where your dashboard stands</h2>
            <div className="mt-4 space-y-3 sm:mt-5">
              {focusItems.map((item) => (
                <button key={item.label} type="button" onClick={item.onClick} className={`sv-home-focus-item ${item.tone}`}>
                  <ProgressRing value={item.value} size={58} stroke={6} label={`${Math.round(item.value)}%`} />
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-bold text-slate-950">{item.label}</span>
                    <span className="mt-1 block text-xs leading-6 text-slate-500">{item.note}</span>
                  </span>
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
            <div className="sv-home-recent-grid mt-4 grid gap-4 lg:grid-cols-2">
              {marketplaceGroups.map((group) => <RecentSplitCard key={group.id} group={group} onClick={() => navigate("/groups")} />)}
            </div>
          ) : (
            <div className="sv-home-empty-state mt-4">
              <div>
                <p className="text-lg font-bold text-slate-950">No splits are visible yet.</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">Create the first one or check back after more groups go live.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => navigate("/create")} className="sv-btn-primary">Create split</button>
                <button type="button" onClick={() => navigate("/groups")} className="sv-btn-secondary">Explore splits</button>
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
    <button type="button" onClick={onClick} className="sv-home-action-button">
      <span className="sv-home-action-icon">{icon}</span>
      <span className="min-w-0 text-left">
        <span className="block text-sm font-bold text-white">{title}</span>
        <span className="block text-xs text-slate-300">{note}</span>
      </span>
    </button>
  );
}

function StatCard({ label, numericValue, icon, onClick, className = "", note, sparkline, prefix = "", suffix = "", decimals = 0 }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <article className={`sv-stat-card sv-home-stat-card sv-hover-lift cursor-pointer ${className}`} onClick={onClick} onKeyDown={handleKeyDown} role="button" tabIndex={0}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="sv-home-stat-icon">{icon}</span>
          <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-xs">{label}</p>
        </div>
        <Sparkline values={sparkline} />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950">
        <AnimatedMetricValue value={numericValue} prefix={prefix} suffix={suffix} decimals={decimals} />
      </p>
      <p className="mt-1 text-xs leading-6 text-slate-500">{note}</p>
    </article>
  );
}

function Sparkline({ values }) {
  return (
    <svg viewBox="0 0 100 100" className="sv-home-sparkline" aria-hidden="true">
      <polygon points={buildSparklineArea(values)} className="sv-home-sparkline-area" />
      <polyline points={buildSparklinePath(values)} className="sv-home-sparkline-line" />
    </svg>
  );
}

function AnimatedMetricValue({ value, prefix = "", suffix = "", decimals = 0 }) {
  const [displayValue, setDisplayValue] = useState(Number(value || 0));
  const previousValueRef = useRef(Number(value || 0));

  useEffect(() => {
    const from = previousValueRef.current;
    const to = Number(value || 0);

    if (Number.isNaN(to) || from === to) {
      previousValueRef.current = to;
      setDisplayValue(to);
      return undefined;
    }

    let animationFrameId = 0;
    const duration = 700;
    const startedAt = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplayValue(from + (to - from) * eased);
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    animationFrameId = window.requestAnimationFrame(tick);
    previousValueRef.current = to;
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [value]);

  return `${prefix}${displayValue.toFixed(decimals)}${suffix}`;
}

function RecentSplitCard({ group, onClick }) {
  const statusMeta = getRecentSplitStatusMeta(group.status);
  const progressPercent = Math.max(6, Math.min(100, Math.round(Number(group.progress_percent || 0))));
  const avatarTokens = buildRecentAvatarTokens(group);
  const joinPrice = Number(group.join_price || group.price_per_slot || 0);

  return (
    <article className="sv-home-recent-card sv-hover-lift">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="sv-home-status-row">
            <span className={`sv-home-status-dot ${statusMeta.dotClassName}`} />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{statusMeta.label}</span>
          </div>
          <h3 className="mt-3 truncate text-lg font-bold text-slate-950">{group.subscription_name}</h3>
          <p className="mt-2 text-sm text-slate-500">{group.mode_label} by {group.owner_name}</p>
        </div>
        <span className="sv-chip">{group.remaining_slots} slot{Number(group.remaining_slots) === 1 ? "" : "s"} left</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="sv-home-avatar-stack">
          {avatarTokens.map((token, index) => <span key={`${group.id}-${token}-${index}`} className="sv-home-avatar-token">{token}</span>)}
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Updated {formatRelativeTime(group.created_at)}</span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
          <span>{group.filled_slots} of {group.total_slots} filled</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="sv-home-recent-progress">
          <span className={`sv-home-recent-progress-fill ${group.mode === "group_buy" ? "is-buy" : "is-sharing"}`} style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Join price</p>
          <p className="mt-1 text-base font-bold text-slate-950">{formatCurrency(joinPrice)}</p>
        </div>
        <button type="button" onClick={onClick} className="sv-btn-secondary">Explore</button>
      </div>
    </article>
  );
}
