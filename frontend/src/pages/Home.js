import { useEffect, useMemo, useState } from "react";
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
  WalletIcon,
} from "../components/UiIcons";
import useIsMobile from "../hooks/useIsMobile";
import {
  HOME_ACTIVATION_VERSION,
  getActivationTemplatesForPath,
} from "./activationOptions";

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
    return { text: "Good morning", emoji: "ðŸŒ…" };
  }
  if (hour < 17) {
    return { text: "Good afternoon", emoji: "â˜€ï¸" };
  }
  return { text: "Good evening", emoji: "ðŸŒ™" };
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
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [showActivation, setShowActivation] = useState(false);
  const [activationPath, setActivationPath] = useState("sharing");
  const [activationTemplateId, setActivationTemplateId] = useState(
    () => getActivationTemplatesForPath("sharing")[0]?.id || ""
  );

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
  const onboardingStorageKey = currentUserId
    ? `sv-home-guide-seen-${onboardingGuideVersion}-${currentUserId}`
    : "";
  const activationStorageKey = currentUserId
    ? `sv-home-activation-seen-${HOME_ACTIVATION_VERSION}-${currentUserId}`
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
  const hostedGroupsCount = Number(ownerSummary.total_groups_created || 0);
  const joinedGroupsCount = memberships.length;
  const shouldShowFirstActionActivation = hostedGroupsCount === 0 && joinedGroupsCount === 0;
  const greetingMeta = getGreetingMeta();
  const currentUserFirstName =
    profileSnapshot?.first_name?.trim() || dashboard?.current_user?.username || "there";
  const walletBalanceValue = Number(dashboard?.wallet_balance || 0);
  const activeGroups = Number(dashboard?.active_groups || 0);
  const totalSpent = Number(profileSnapshot?.total_spent || dashboard?.total_spent || 0);
  const profileCompletion = Number(profileSnapshot?.profile_completion || 0);
  const totalGuideSlides = 7;
  const marketplaceGroups = groups.slice(0, isMobile ? 2 : 4);
  const activeActionCount =
    membershipNeedsAttention + Number(ownerSummary.buy_together_waiting || 0);
  const activationTemplates = useMemo(
    () => getActivationTemplatesForPath(activationPath),
    [activationPath]
  );
  const selectedActivationTemplate =
    activationPath === "join"
      ? null
      : activationTemplates.find((item) => item.id === activationTemplateId) ||
        activationTemplates[0] ||
        null;
  const heroSummary =
    totalSpent > 0
      ? `${formatCurrency(totalSpent)} has moved through your ShareVerse activity so far.`
      : activeActionCount > 0
        ? `${activeActionCount} item${activeActionCount === 1 ? "" : "s"} need your attention right now.`
        : groups.length > 0
          ? "Everything looks calm right now. You can browse new splits or open the next one."
          : "You are ready to create your first split whenever you want.";

  useEffect(() => {
    if (activationPath === "join") {
      return;
    }

    if (!activationTemplates.some((item) => item.id === activationTemplateId)) {
      setActivationTemplateId(activationTemplates[0]?.id || "");
    }
  }, [activationPath, activationTemplateId, activationTemplates]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const hasSeenActivation = window.localStorage.getItem(activationStorageKey) === "1";
    const hasSeenGuide = window.localStorage.getItem(onboardingStorageKey) === "1";

    if (shouldShowFirstActionActivation && !hasSeenActivation) {
      setShowActivation(true);
      setShowGuide(false);
      return;
    }

    setShowActivation(false);
    if (!hasSeenGuide) {
      setShowGuide(true);
    }
  }, [
    activationStorageKey,
    currentUserId,
    onboardingStorageKey,
    shouldShowFirstActionActivation,
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

  const onboardingSteps = [
    {
      step: "01",
      title: "Create a new split",
      body: "Tap 'Create split' on the home screen to set up a provider-permitted plan, course, membership, or software tool for others to join.",
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

  const markGuideSeen = () => {
    if (onboardingStorageKey) {
      window.localStorage.setItem(onboardingStorageKey, "1");
    }
  };

  const dismissGuide = () => {
    markGuideSeen();
    setShowGuide(false);
  };

  const dismissActivation = () => {
    if (activationStorageKey) {
      window.localStorage.setItem(activationStorageKey, "1");
    }
    markGuideSeen();
    setShowActivation(false);
  };

  const continueFromActivation = () => {
    dismissActivation();

    if (activationPath === "join") {
      navigate("/groups", {
        state: {
          activationEntry: "home-activation",
          activationPath: "join",
        },
      });
      return;
    }

    navigate("/create", {
      state: {
        activationEntry: "home-activation",
        activationPath,
        activationTemplateId: selectedActivationTemplate?.id || null,
      },
    });
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
          <SkeletonList
            count={4}
            className="grid gap-4 lg:grid-cols-2"
            itemClassName="h-48 rounded-[24px]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      {showActivation ? (
        <div className="sv-modal-backdrop">
          <div className="sv-guide-modal">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="sv-eyebrow">First step</p>
                <h2 className="mt-2 text-xl font-bold leading-tight text-slate-950 sm:text-2xl">
                  What would you like to do first?
                </h2>
              </div>
              <button
                type="button"
                onClick={dismissActivation}
                className="min-h-[44px] px-1 py-2 text-[13px] font-semibold text-slate-500 transition hover:text-slate-800 sm:text-sm"
              >
                Maybe later
              </button>
            </div>

            <p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
              Pick the fastest path into ShareVerse. You can share something you already
              manage, join an open split, or start a buy-together with safer category
              defaults already prepared for you.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <ActivationPathCard
                active={activationPath === "sharing"}
                eyebrow="Share first"
                title="Share a plan you already pay for"
                body="Best when you already manage the plan and just want paid slots to go live."
                icon={<PlusIcon className="h-5 w-5" />}
                onClick={() => setActivationPath("sharing")}
              />
              <ActivationPathCard
                active={activationPath === "join"}
                eyebrow="Join first"
                title="Join an open split"
                body="Browse live listings and jump into something that already fits your stack."
                icon={<CompassIcon className="h-5 w-5" />}
                onClick={() => setActivationPath("join")}
              />
              <ActivationPathCard
                active={activationPath === "group_buy"}
                eyebrow="Buy together"
                title="Start a buy-together"
                body="Collect member commitments first, then buy after the group is aligned."
                icon={<LayersIcon className="h-5 w-5" />}
                onClick={() => setActivationPath("group_buy")}
              />
            </div>

            {activationPath === "join" ? (
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-950">Fastest path to value</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  We&apos;ll take you straight to Explore so you can compare open splits,
                  pricing, and availability before you commit.
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Start with a safer category template
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      We&apos;ll prefill the name, slot count, and starting price. You can
                      adjust everything before publishing.
                    </p>
                  </div>
                  <span className="sv-chip">
                    {activationPath === "sharing" ? "Share path" : "Buy-together path"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {activationTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setActivationTemplateId(template.id)}
                      className={`rounded-[20px] border px-4 py-4 text-left transition ${
                        selectedActivationTemplate?.id === template.id
                          ? "border-slate-900 bg-white shadow-sm"
                          : "border-slate-200 bg-white/80 hover:border-slate-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-950">{template.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {template.description}
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {template.totalSlots} slots • Rs {template.pricePerSlot} each
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] leading-6 text-slate-500 sm:text-sm">
                This only sets your starting point. Nothing gets published until you review it.
              </p>
              <button
                type="button"
                onClick={continueFromActivation}
                className="sv-btn-primary w-full justify-center sm:w-auto"
              >
                {activationPath === "join"
                  ? "Explore open splits"
                  : activationPath === "group_buy"
                    ? "Start buy-together setup"
                    : "Start sharing setup"}
              </button>
            </div>
          </div>
        </div>
      ) : showGuide ? (
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
                    Welcome to ShareVerse ðŸ‘‹
                  </h2>
                  <p className="mt-3 max-w-xl text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                    Here&apos;s a quick tour of the main sections. Tap any shortcut to jump
                    straight there, or hit Next for a step-by-step guide.
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
                        <span className="block text-[13px] font-semibold text-slate-950 sm:text-sm">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-5 text-slate-500 sm:mt-1 sm:text-xs sm:leading-6">
                          {item.note}
                        </span>
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
                  <h2 className="text-xl font-bold text-emerald-950 sm:text-2xl">
                    You&apos;re ready to go
                  </h2>
                  <p className="max-w-xl text-[13px] leading-6 text-emerald-900 sm:text-sm sm:leading-7">
                    Need help after this? Open Support anytime and we&apos;ll help you
                    with creating splits, joining them, top-ups, or manual withdrawal review.
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

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sv-animate-rise sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_320px] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <BrandMark sizeClass="h-10 w-10 sm:h-11 sm:w-11" roundedClass="rounded-[14px] sm:rounded-[16px]" />
                <span className="sv-chip">Dashboard</span>
                {!isMobile ? <span className="sv-chip">{activeGroups} active groups</span> : null}
              </div>
              <p className="sv-eyebrow mt-5">
                {greetingMeta.text}, {currentUserFirstName} {greetingMeta.emoji}
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
                {isMobile
                  ? "Everything you need, without the noise."
                  : "A simpler view of your wallet, splits, and next step."}
              </h1>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7 md:text-base">
                Keep the essentials visible, open the next action quickly, and manage your
                groups without a crowded dashboard.
              </p>

              <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
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

            <aside className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
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
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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

            <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
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

          <aside className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <p className="sv-eyebrow">Quick checks</p>
            <div className="mt-4 space-y-3">
              {quickChecks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:shadow-sm"
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
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
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

function ActivationPathCard({ active, eyebrow, title, body, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border px-4 py-4 text-left transition ${
        active
          ? "border-slate-900 bg-slate-950 text-white shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-[16px] ${
          active ? "bg-white/12 text-white" : "bg-slate-100 text-slate-700"
        }`}
      >
        {icon}
      </span>
      <p
        className={`mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] ${
          active ? "text-white/70" : "text-slate-500"
        }`}
      >
        {eyebrow}
      </p>
      <h3 className="mt-2 text-base font-semibold leading-tight">{title}</h3>
      <p className={`mt-3 text-sm leading-6 ${active ? "text-white/80" : "text-slate-600"}`}>
        {body}
      </p>
    </button>
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
      className="cursor-pointer rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-5"
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
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
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
