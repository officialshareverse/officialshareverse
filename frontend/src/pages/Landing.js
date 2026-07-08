import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import API from "../api/axios";
import { getPaginatedItems } from "../api/pagination";
import BrandMark from "../components/BrandMark";
import PublicFooter from "../components/PublicFooter";
import useIsMobile from "../hooks/useIsMobile";

const featureNotes = [
  { label: "Subscriptions", icon: "TV", targetId: "modes" },
  { label: "Courses", icon: "EDU", targetId: "how-it-works" },
  { label: "Software", icon: "APP", targetId: "social-proof" },
  { label: "Memberships", icon: "VIP", targetId: "cta" },
];

const heroStats = [
  { value: 500, prefix: "Rs ", suffix: "/mo", label: "example saving", note: "when one plan is split with trusted members" },
  { value: 80, suffix: "%", label: "less per person", note: "possible on multi-seat plans when more people join" },
  { value: 24, suffix: "h", label: "payout window", note: "manual withdrawals are usually processed within a day" },
];

const popularPlanLogos = [
  { name: "Netflix", className: "is-netflix" },
  { name: "Spotify", className: "is-spotify" },
  { name: "Disney+ Hotstar", className: "is-disney" },
  { name: "Prime Video", className: "is-prime" },
  { name: "YouTube Premium", className: "is-youtube" },
  { name: "JioCinema", className: "is-jio" },
  { name: "SonyLIV", className: "is-sony" },
  { name: "Canva Pro", className: "is-canva" },
  { name: "Coursera", className: "is-coursera" },
  { name: "Google One", className: "is-google" },
];

const heroHighlights = [
  {
    icon: "01",
    label: "Split popular apps",
    value: "Pay your share, not the full bill",
    body: "Create or join groups for streaming, music, tools, learning, and memberships.",
    targetId: "modes",
  },
  {
    icon: "02",
    label: "Real money flow",
    value: "Wallet-backed joins",
    body: "Members pay through the wallet so hosts are not chasing payments in separate chats.",
    targetId: "cta",
  },
  {
    icon: "03",
    label: "Safer coordination",
    value: "Status, chat, and proof in one place",
    body: "Everyone can see slots, pricing, updates, and confirmations before moving forward.",
    targetId: "social-proof",
  },
];

const modes = [
  {
    id: "sharing",
    tab: "Sharing",
    eyebrow: "Existing plans",
    title: "List your plan in 2 minutes",
    body: "Already pay for a plan with extra seats? Add the price, slots, and timing so members can join with clear terms.",
    cta: "Start a sharing split",
    ctaTo: "/signup",
    bullets: [
      "Best when you already own the subscription or tool.",
      "Good for family plans where the provider allows it, shared tools, memberships, and courses.",
      "Members see the price and slot count before they pay.",
    ],
    metrics: [
      { label: "Best for", value: "Existing plans" },
      { label: "Works well with", value: "Subscriptions and software" },
      { label: "Main benefit", value: "Lower monthly cost" },
    ],
    mockSteps: [
      "Create the split and add the plan details.",
      "Set slots, price, and access timing.",
      "Publish and let members join with confidence.",
    ],
  },
  {
    id: "buy_together",
    tab: "Buy together",
    eyebrow: "Group purchase flow",
    title: "Start a group purchase before anyone overpays",
    body: "Collect members first, buy only when the group is ready, and keep everyone updated from the same page.",
    cta: "Start a buy-together group",
    ctaTo: "/signup",
    bullets: [
      "Best when the group should buy only after enough people commit.",
      "Useful for course cohorts, new memberships, or team software seats.",
      "Gives everyone one place to track readiness, chat, and payment context.",
    ],
    metrics: [
      { label: "Best for", value: "Planned group purchases" },
      { label: "Works well with", value: "Courses and memberships" },
      { label: "Main benefit", value: "Buy only after enough people join" },
    ],
    mockSteps: [
      "Open the group and collect interested members first.",
      "Track who is ready and what still needs action.",
      "Move together once the group is full and aligned.",
    ],
  },
];

const trustPoints = [
  {
    title: "Clear slot and price status",
    body: "Members can see what they pay, how many slots are left, and whether the group is still open.",
  },
  {
    title: "Wallet records for every move",
    body: "Top-ups, joins, refunds, and withdrawals stay visible in one ledger.",
  },
  {
    title: "Manual payouts with a visible window",
    body: "Withdrawals are requested in the wallet and usually processed within 24 hours after operator review.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "List your plan",
    body: "Add the app, monthly price, available seats, and the amount each member pays.",
  },
  {
    step: "02",
    title: "Members join",
    body: "People browse live groups, pay from wallet balance, and track their spot from My Splits.",
  },
  {
    step: "03",
    title: "Everyone saves",
    body: "The plan cost is split across members instead of one person carrying the full bill.",
  },
];

const safetyChecklist = [
  {
    title: "Display names, not public emails",
    body: "Marketplace listings show a host name without exposing email addresses.",
  },
  {
    title: "Provider-safe listings",
    body: "Groups should be created only for plans where sharing or group purchase coordination is permitted.",
  },
  {
    title: "Admin payout completion",
    body: "Withdrawals are completed after the real transfer is made, keeping wallet history consistent.",
  },
];

const joinTickerItems = [
  "Netflix groups can reduce the monthly bill per person",
  "Spotify family plans work best when every seat is filled",
  "Courses and tools can be listed as buy-together groups",
  "Wallet joins keep payments out of scattered DMs",
  "Withdrawals are usually processed within 24 hours",
];

function getPreviewGroupName(group) {
  const name = group.subscription_name || group.subscription || "ShareVerse split";
  return String(name);
}

function getPreviewRemainingSlots(group) {
  const totalSlots = Number(group.total_slots || 0);
  const filledSlots = Number(group.filled_slots || 0);
  return Math.max(Number(group.remaining_slots ?? totalSlots - filledSlots) || 0, 0);
}

function getPreviewAccentClass(group, index) {
  const normalizedName = getPreviewGroupName(group).toLowerCase();

  if (normalizedName.includes("spotify") || normalizedName.includes("music")) {
    return "bg-emerald-500";
  }
  if (normalizedName.includes("netflix") || normalizedName.includes("youtube")) {
    return "bg-rose-500";
  }
  if (normalizedName.includes("canva") || normalizedName.includes("figma") || normalizedName.includes("ai")) {
    return "bg-violet-500";
  }
  if (normalizedName.includes("prime") || normalizedName.includes("hotstar") || normalizedName.includes("disney")) {
    return "bg-sky-500";
  }

  return ["bg-teal-500", "bg-sky-500", "bg-violet-500"][index % 3];
}

function formatPreviewGroupDetail(group) {
  const remainingSlots = getPreviewRemainingSlots(group);
  const slotName = group.mode === "group_buy" ? "spot" : "seat";
  const stateLabel = group.mode === "group_buy" ? "needed" : "open";

  return `${remainingSlots} ${slotName}${remainingSlots === 1 ? "" : "s"} ${stateLabel}`;
}

function formatPreviewPrice(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) {
    return "Rs 0";
  }

  return `Rs ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  })}`;
}

function getPreviewPriceSuffix(group) {
  return group.mode === "group_buy" ? "/spot" : "/seat";
}

export default function Landing({ setIsAuth }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileLanding />;
  }

  return <DesktopLanding />;
}

/* ─────────────────────────────────────────────────────────────────────────────
   MOBILE LANDING — built mobile-first with zero negative margins or viewport
   width hacks. Every section is a simple stacked block with safe padding.
   ───────────────────────────────────────────────────────────────────────────── */

function MobileLanding() {
  const [liveGroups, setLiveGroups] = useState([]);
  const [liveGroupsStatus, setLiveGroupsStatus] = useState("loading");

  useEffect(() => {
    let isMounted = true;

    async function fetchLiveGroups() {
      try {
        const response = await API.get("groups/", { params: { page_size: 3 } });
        const groups = getPaginatedItems(response.data)
          .filter((group) => getPreviewRemainingSlots(group) > 0)
          .slice(0, 3);

        if (isMounted) {
          setLiveGroups(groups);
          setLiveGroupsStatus("ready");
        }
      } catch (error) {
        console.error("Failed to load landing live groups.", error);
        if (isMounted) {
          setLiveGroupsStatus("error");
        }
      }
    }

    void fetchLiveGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasLiveGroups = liveGroups.length > 0;
  const liveGroupsBadge = liveGroupsStatus === "loading" ? "Loading" : hasLiveGroups ? "Open" : "Browse";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f8fb] text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <BrandMark glow sizeClass="h-9 w-9" roundedClass="rounded-lg" />
          <span className="truncate text-[16px] font-black tracking-tight">ShareVerse</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/login" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            Login
          </Link>
          <Link to="/signup" className="rounded-lg bg-teal-500 px-3.5 py-2 text-[13px] font-black text-white shadow-sm shadow-teal-500/25">
            Sign up
          </Link>
        </div>
      </header>

      <main className="pb-5">
        <section className="px-4 pb-7 pt-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-amber-700 dark:border-amber-500/30 dark:bg-amber-400/10 dark:text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Stop paying alone
          </div>

          <h1 className="max-w-[22rem] text-[34px] font-black leading-[1.04] tracking-normal text-slate-950 dark:text-white">
            Split Netflix, Spotify and tools with people ready to join.
          </h1>

          <p className="mt-4 max-w-[21rem] text-[15px] leading-6 text-slate-600 dark:text-slate-300">
            Browse open seats before signing up, then create your account when you are ready to join or list a plan.
          </p>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Example split</p>
              <p className="mt-1 text-[23px] font-black text-slate-950 dark:text-white">Rs 500 plan</p>
              <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">Split with 5 people: around Rs 100 each.</p>
            </div>
            <div className="flex h-full min-h-20 w-20 flex-col items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-200">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em]">Save</span>
              <span className="text-2xl font-black">80%</span>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <Link to="/signup" className="flex min-h-12 items-center justify-center rounded-lg bg-teal-500 px-4 py-3 text-[15px] font-black text-white shadow-lg shadow-teal-500/25 active:scale-[0.99]">
              Create free account
            </Link>
            <Link to="/groups" className="flex min-h-12 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-3 text-[15px] font-black text-slate-800 shadow-sm active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
              Browse live groups first
            </Link>
          </div>
        </section>

        <section className="px-4 pb-7">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-teal-600 dark:text-teal-300">Live group preview</p>
                <h2 className="mt-1 text-[18px] font-black">Open seats people understand fast</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{liveGroupsBadge}</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {liveGroupsStatus === "loading" ? (
                [0, 1, 2].map((item) => (
                  <div key={item} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3" aria-hidden="true">
                    <span className="h-9 w-9 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                    <div className="min-w-0 space-y-2">
                      <span className="block h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                      <span className="block h-3 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                    <span className="h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                ))
              ) : hasLiveGroups ? (
                liveGroups.map((group, index) => {
                  const groupName = getPreviewGroupName(group);
                  const price = formatPreviewPrice(group.join_price ?? group.price_per_slot);
                  const groupPath = group.id ? `/groups/${group.id}` : "/groups";

                  return (
                    <Link
                      key={group.id || `${groupName}-${index}`}
                      to={groupPath}
                      state={group.id ? { group } : undefined}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 transition-colors active:bg-slate-50 dark:active:bg-slate-800/70"
                    >
                      <span className={`h-9 w-9 rounded-lg ${getPreviewAccentClass(group, index)}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-black text-slate-950 dark:text-white">{groupName}</p>
                        <p className="mt-0.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">{formatPreviewGroupDetail(group)}</p>
                      </div>
                      <p className="text-right text-[15px] font-black text-slate-950 dark:text-white">{price}<span className="text-[11px] font-bold text-slate-400">{getPreviewPriceSuffix(group)}</span></p>
                    </Link>
                  );
                })
              ) : (
                <div className="px-4 py-4">
                  <p className="text-[13px] font-semibold leading-5 text-slate-600 dark:text-slate-300">
                    {liveGroupsStatus === "error" ? "Live groups could not be loaded right now." : "No open groups are listed right now."}
                  </p>
                  <Link to="/groups" className="mt-3 inline-flex text-[13px] font-black text-teal-700 dark:text-teal-300">
                    Browse all groups
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="pb-7">
          <p className="px-4 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Popular searches</p>
          <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sv-hide-scrollbar" aria-label="Popular plans">
            {popularPlanLogos.slice(0, 7).map((item) => (
              <span key={item.name} className={`sv-plan-logo shrink-0 ${item.className}`}>{item.name}</span>
            ))}
          </div>
        </section>

        <section className="px-4 pb-7">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-teal-600 dark:text-teal-300">How it works</p>
          <h2 className="mt-2 text-[24px] font-black tracking-normal">From click to saving in three steps</h2>
          <div className="mt-4 grid gap-3">
            {howItWorks.map((item) => (
              <article key={item.step} className="grid grid-cols-[42px_1fr] gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-[14px] font-black text-teal-700 dark:bg-teal-400/10 dark:text-teal-200">{item.step}</span>
                <div>
                  <h3 className="text-[16px] font-black text-slate-950 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-slate-600 dark:text-slate-400">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 pb-7">
          <div className="grid gap-3">
            <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-500">For joiners</p>
              <h2 className="mt-2 text-[19px] font-black">See price, slots and host before joining.</h2>
              <p className="mt-2 text-[13px] leading-5 text-slate-600 dark:text-slate-400">Open groups show what you pay and how many seats are left, so the signup decision is not blind.</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-600">For hosts</p>
              <h2 className="mt-2 text-[19px] font-black">List the plan you already pay for.</h2>
              <p className="mt-2 text-[13px] leading-5 text-slate-600 dark:text-slate-400">Add slots, price and access timing in one place instead of explaining the same split in chats.</p>
            </article>
          </div>
        </section>

        <section className="px-4 pb-7">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-teal-600 dark:text-teal-300">Trust basics</p>
          <h2 className="mt-2 text-[24px] font-black tracking-normal">Built to reduce payment confusion</h2>
          <div className="mt-4 grid gap-3">
            {safetyChecklist.slice(0, 2).map((item) => (
              <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-[15px] font-black text-slate-950 dark:text-white">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-600 dark:text-slate-400">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 pb-4">
          <div className="rounded-lg bg-slate-950 p-5 text-white shadow-sm dark:bg-white dark:text-slate-950">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-teal-300 dark:text-teal-700">Start here</p>
            <h2 className="mt-2 text-[24px] font-black leading-tight tracking-normal">Turn ad clicks into accounts with a clearer first step.</h2>
            <p className="mt-2 text-[13px] leading-5 text-slate-300 dark:text-slate-600">Create an account to join a split, or browse live groups first if you want to see what is available.</p>
            <div className="mt-4 grid gap-2.5">
              <Link to="/signup" className="flex min-h-12 items-center justify-center rounded-lg bg-teal-500 px-4 py-3 text-[15px] font-black text-white">
                Sign up and start saving
              </Link>
              <Link to="/groups" className="flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-[15px] font-black text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-950">
                View live groups
              </Link>
            </div>
          </div>
        </section>
      </main>


      <PublicFooter />
    </div>
  );
}
function DesktopLanding() {
  const [activeMode, setActiveMode] = useState(modes[0].id);
  const activeModeContent = modes.find((mode) => mode.id === activeMode) || modes[0];

  const jumpToSection = (targetId) => {
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6 md:space-y-8">
        <header className="sv-brand-shell flex items-center justify-between gap-3 px-5 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
          >
            <BrandMark glow sizeClass="h-10 w-10" />
            <div className="min-w-0">
              <span className="block truncate text-xl font-bold leading-none">ShareVerse</span>
              <span className="mt-0.5 block text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Split more. Pay less.
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/login" className="sv-btn-secondary px-4 py-2.5 text-sm">Login</Link>
            <Link to="/signup" className="sv-btn-primary px-4 py-2.5 text-sm">Sign up</Link>
          </div>
        </header>

        <section className="sv-marketing-hero sv-landing-hero relative overflow-hidden">
          <div className="grid gap-6 lg:items-center">
            <div className="relative z-[1] flex flex-col items-start text-left">
              <span className="sv-live-badge sv-animate-glow">Popular apps, one shared wallet</span>
              <p className="sv-eyebrow-on-dark mt-5">Split more. Pay less.</p>
              <h1 className="sv-display-on-dark mt-4 max-w-4xl">
                Save Rs 500/month on Netflix, Spotify, and everyday apps
                <span className="sv-gradient-text"> by splitting costs safely.</span>
              </h1>
              <p className="sv-landing-hero-body mt-4 max-w-2xl text-sm leading-7 text-slate-200 md:text-base md:leading-8">
                Browse live groups or list a plan you already pay for. ShareVerse keeps slots,
                pricing, wallet payments, chat, and withdrawal requests in one place so everyone
                understands the split before joining.
              </p>

              <div className="mt-8 inline-flex flex-wrap gap-4">
                <Link to="/signup" className="sv-btn-primary py-3 text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)]">Start saving</Link>
                <Link to="/groups" className="sv-btn-secondary bg-white/90 text-slate-950 py-3 text-sm shadow-sm">Browse live groups</Link>
              </div>

              <div className="sv-counter-grid mt-6 w-full max-w-none">
                {heroStats.map((item) => (
                  <CountUpMetric key={item.label} value={item.value} prefix={item.prefix} suffix={item.suffix} decimals={item.decimals} label={item.label} note={item.note} />
                ))}
              </div>

              <div className="sv-landing-feature-notes mt-5 flex flex-wrap gap-2">
                {featureNotes.map((item) => (
                  <button key={item.label} type="button" onClick={() => jumpToSection(item.targetId)} className="sv-feature-note sv-glass-panel border-white/10">
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="sv-plan-logo-strip mt-5 w-full overflow-hidden" aria-label="Popular plans on ShareVerse">
                <span className="sv-plan-logo-strip-label">Popular plans</span>
                <div className="sv-marquee-container inline-flex items-center gap-3">
                  {popularPlanLogos.map((item) => (
                    <span key={item.name} className={`sv-plan-logo ${item.className}`}>{item.name}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="sv-landing-highlight-grid mt-6 grid gap-3 md:grid-cols-3">
            {heroHighlights.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => jumpToSection(item.targetId)}
                className={`sv-highlight-card sv-hover-lift text-left ${index === 0 ? "sv-animate-rise" : index === 1 ? "sv-animate-rise sv-delay-1" : "sv-animate-rise sv-delay-2"}`}
              >
                <span className="sv-highlight-card-icon" aria-hidden="true">{item.icon}</span>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                <p className="mt-2 text-base font-semibold leading-6 text-slate-950">{item.value}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
              </button>
            ))}
          </div>
        </section>

        <section id="modes" className="sv-card-solid scroll-mt-24">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="sv-eyebrow">Ways to save</p>
              <h2 className="sv-title mt-3">Share a plan you have or start a group purchase</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Use sharing when you already have the plan. Use buy together when the group should form before anyone commits to the full price.
              </p>
            </div>
            <div className="sv-mode-toggle inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              {modes.map((mode) => (
                <button key={mode.id} type="button" onClick={() => setActiveMode(mode.id)} className={`sv-mode-toggle-button justify-center ${activeMode === mode.id ? "is-active" : ""}`}>{mode.tab}</button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
            <article className="sv-mode-preview-card sv-animate-rise">
              <p className="sv-eyebrow">{activeModeContent.eyebrow}</p>
              <h3 className="sv-title mt-2">{activeModeContent.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{activeModeContent.body}</p>
              <div className="mt-4 space-y-2.5">
                {activeModeContent.bullets.map((item) => (
                  <div key={item} className="sv-mode-bullet"><span className="sv-mode-bullet-dot" aria-hidden="true" /><span>{item}</span></div>
                ))}
              </div>
              <div className="sv-mode-metrics mt-5 grid gap-2 sm:grid-cols-3">
                {activeModeContent.metrics.map((item) => (
                  <div key={item.label} className="sv-mode-metric">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <Link to={activeModeContent.ctaTo} className="sv-btn-primary justify-center w-auto text-sm py-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]">{activeModeContent.cta}</Link>
              </div>
            </article>

            <div className="sv-mode-mock">
              <div className="sv-mode-mock-window">
                <div className="sv-mode-mock-head">
                  <div className="flex gap-1.5">
                    <span className="sv-mode-mock-dot bg-rose-400" />
                    <span className="sv-mode-mock-dot bg-amber-400" />
                    <span className="sv-mode-mock-dot bg-emerald-400" />
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Flow preview</span>
                </div>
                <div className="mt-4 space-y-3">
                  {activeModeContent.mockSteps.map((item, index) => (
                    <div key={item} className="sv-mode-step">
                      <span className="sv-mode-step-index">0{index + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{item}</p>
                        <p className="mt-1 text-[13px] leading-6 text-slate-600">
                          {index === 0 ? "Start with a clear intention so people understand what kind of group they are joining."
                            : index === 1 ? "Keep the financial and timing expectations easy to scan before anyone commits."
                              : "Move forward with everyone looking at the same status instead of multiple disconnected updates."}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="grid gap-4 md:grid-cols-3 scroll-mt-24">
          {howItWorks.map((item, index) => (
            <article key={item.step} className={`sv-card-solid sv-how-card ${index === 0 ? "sv-animate-rise" : index === 1 ? "sv-animate-rise sv-delay-1" : "sv-animate-rise sv-delay-2"}`}>
              <span className="sv-how-step">{item.step}</span>
              <h3 className="sv-title mt-4">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
            </article>
          ))}
        </section>

        <section id="social-proof" className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] scroll-mt-24">
          <section className="sv-card-solid">
            <p className="sv-eyebrow">Why ShareVerse</p>
            <h2 className="sv-title mt-3">Know the price, slots, and payout status before you join</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">ShareVerse is for people who want to save on digital plans without losing track of who paid, what is open, and what happens next.</p>
            <div className="sv-trust-timeline mt-5">
              {trustPoints.map((point, index) => (
                <div key={point.title} className="sv-trust-item">
                  <span className="sv-trust-index">0{index + 1}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{point.title}</h3>
                    <p className="mt-1.5 text-sm leading-7 text-slate-600">{point.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="sv-card-solid">
            <div className="flex flex-row items-end justify-between">
              <div>
                <p className="sv-eyebrow">Safety basics</p>
                <h2 className="sv-title mt-2">Trust signals that match the current product</h2>
              </div>
              <span className="sv-chip">No inflated user claims</span>
            </div>
            <div className="sv-testimonial-list mt-5 grid gap-4">
              {safetyChecklist.map((item, index) => (
                <article key={item.title} className={`sv-testimonial-card ${index === 0 ? "sv-animate-rise" : index === 1 ? "sv-animate-rise sv-delay-1" : "sv-animate-rise sv-delay-2"}`}>
                  <p className="text-base font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section id="cta" className="sv-marketing-hero sv-landing-cta scroll-mt-24">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
            <div>
              <p className="sv-eyebrow-on-dark">Ready to start</p>
              <h2 className="sv-display-on-dark mt-3 max-w-3xl">Start saving on the subscriptions and tools you already use.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">Create a group, let members join with clear pricing, and use wallet records so every payment and withdrawal has a trace.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link to="/signup" className="sv-btn-primary justify-center text-sm">Create account</Link>
              <Link to="/login" className="sv-btn-secondary justify-center bg-white/90 text-slate-950 text-sm">Login</Link>
              <Link to="/support" className="sv-btn-secondary justify-center bg-white/10 text-white text-sm">Talk to support</Link>
            </div>
          </div>
          <div className="sv-join-ticker mt-6" aria-hidden="true">
            <div className="sv-join-track">
              {[...joinTickerItems, ...joinTickerItems].map((item, index) => (
                <span key={`${item}-${index}`} className="sv-join-pill">
                  <span className="text-emerald-300">•</span>
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}

function CountUpMetric({ isMobile, inline, value, prefix = "", suffix = "", decimals = 0, label, note }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let startTime = 0;
    const duration = 1200;

    const tick = (timestamp) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const progress = Math.min(1, (timestamp - startTime) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * easedProgress);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [value]);

  const formattedValue =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString("en-IN");

  /* When inline=true, MobileLanding provides its own card wrapper, so we just
     render the value + note fragments without a container div. */
  if (inline) {
    return (
      <>
        <span className="text-3xl font-black text-slate-900 dark:text-white">
          {prefix}{formattedValue}{suffix}
        </span>
        <p className="mt-2 text-[13px] leading-5 text-slate-500 dark:text-slate-400">{note}</p>
      </>
    );
  }

  return (
    <div className="sv-counter-card">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-[11px]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">
        {prefix}
        {formattedValue}
        {suffix}
      </p>
      <p className="mt-2 text-[12px] leading-5 text-slate-300 sm:text-[13px] sm:leading-6">{note}</p>
    </div>
  );
}
