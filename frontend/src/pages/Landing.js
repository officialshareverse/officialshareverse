import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
  const [activeMode, setActiveMode] = useState(modes[0].id);
  const activeModeContent = modes.find((m) => m.id === activeMode) || modes[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-hidden">

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 px-5 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark glow sizeClass="h-8 w-8" />
          <span className="text-[15px] font-bold text-slate-900 dark:text-white">ShareVerse</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/login" className="inline-flex items-center justify-center px-3.5 py-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Login
          </Link>
          <Link to="/signup" className="inline-flex items-center justify-center px-3.5 py-2 text-[13px] font-semibold text-white bg-teal-500 rounded-xl shadow-sm hover:bg-teal-600 transition-colors">
            Sign up
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="px-6 pt-10 pb-8 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">Split more · Pay less</span>
        </div>

        <h1 className="text-[28px] leading-[1.2] font-black text-slate-900 dark:text-white">
          Save on Netflix, Spotify & everyday apps
          <span className="text-teal-500"> by splitting costs.</span>
        </h1>

        <p className="mt-4 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Browse live groups or list a plan you already pay for. Slots, pricing, and payments — all in one place.
        </p>

        <div className="mt-7 grid gap-3">
          <Link to="/signup" className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-teal-500 text-white text-[15px] font-semibold shadow-lg shadow-teal-500/20 hover:bg-teal-600 active:scale-[0.98] transition-all">
            Start saving →
          </Link>
          <Link to="/groups" className="flex items-center justify-center w-full py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[15px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all">
            Browse live groups
          </Link>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="px-5 pb-8">
        <div className="flex gap-3 overflow-x-auto pb-2 sv-hide-scrollbar snap-x snap-mandatory">
          {heroStats.map((item) => (
            <div key={item.label} className="shrink-0 w-[72%] snap-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                <CountUpMetric isMobile value={item.value} prefix={item.prefix} suffix={item.suffix} decimals={item.decimals} label={item.label} note={item.note} inline />
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Popular Plans Marquee ── */}
      <section className="pb-8 overflow-hidden">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 text-center mb-3">Popular plans</p>
        <div className="sv-plan-logo-strip w-full overflow-hidden">
          <div className="sv-marquee-container flex items-center gap-2 w-[200%]">
            {popularPlanLogos.map((item) => (
              <span key={item.name} className={`sv-plan-logo ${item.className}`}>{item.name}</span>
            ))}
            {popularPlanLogos.map((item) => (
              <span key={`${item.name}-dup`} className={`sv-plan-logo ${item.className}`}>{item.name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="px-5 pb-8">
        <p className="text-[10px] uppercase tracking-widest font-bold text-teal-600 dark:text-teal-400 mb-2">How it works</p>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-5">Three simple steps</h2>
        <div className="space-y-3">
          {howItWorks.map((item) => (
            <div key={item.step} className="flex gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="shrink-0 w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-sm font-black text-teal-600 dark:text-teal-400">{item.step}</span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Highlights ── */}
      <section className="px-5 pb-8">
        <div className="space-y-3">
          {heroHighlights.map((item) => (
            <div key={item.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">{item.label}</p>
              <p className="text-[15px] font-bold text-slate-900 dark:text-white">{item.value}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modes ── */}
      <section className="px-5 pb-8">
        <p className="text-[10px] uppercase tracking-widest font-bold text-teal-600 dark:text-teal-400 mb-2">Ways to save</p>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-5">Share or buy together</h2>

        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-5">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setActiveMode(mode.id)}
              className={`flex-1 py-2.5 text-[13px] font-semibold rounded-xl text-center transition-all ${activeMode === mode.id ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
            >
              {mode.tab}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest font-bold text-teal-600 dark:text-teal-400 mb-1">{activeModeContent.eyebrow}</p>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{activeModeContent.title}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{activeModeContent.body}</p>

          <div className="mt-4 space-y-2">
            {activeModeContent.bullets.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full bg-teal-500" />
                <span className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{item}</span>
              </div>
            ))}
          </div>

          <Link to={activeModeContent.ctaTo} className="mt-5 flex items-center justify-center w-full py-3 rounded-xl bg-teal-500 text-white text-[14px] font-semibold shadow-sm hover:bg-teal-600 active:scale-[0.98] transition-all">
            {activeModeContent.cta}
          </Link>
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="px-5 pb-8">
        <p className="text-[10px] uppercase tracking-widest font-bold text-teal-600 dark:text-teal-400 mb-2">Why ShareVerse</p>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-5">Built for transparency</h2>
        <div className="space-y-3">
          {trustPoints.map((point, index) => (
            <div key={point.title} className="flex gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="shrink-0 w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-black text-slate-500">0{index + 1}</span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{point.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{point.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Safety ── */}
      <section className="px-5 pb-8">
        <p className="text-[10px] uppercase tracking-widest font-bold text-teal-600 dark:text-teal-400 mb-2">Safety basics</p>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-5">Your data stays safe</h2>
        <div className="space-y-3">
          {safetyChecklist.map((item) => (
            <div key={item.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <p className="text-[14px] font-bold text-slate-900 dark:text-white">{item.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="mx-5 mb-8 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-3xl p-6 text-center">
        <h2 className="text-xl font-black text-white leading-tight">Ready to start saving?</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-300">Join ShareVerse and split the cost of your favourite apps.</p>
        <div className="mt-5 grid gap-2.5">
          <Link to="/signup" className="flex items-center justify-center py-3 rounded-xl bg-teal-500 text-white text-[14px] font-semibold shadow-lg shadow-teal-500/30 hover:bg-teal-600 active:scale-[0.98] transition-all">
            Create account
          </Link>
          <Link to="/login" className="flex items-center justify-center py-3 rounded-xl bg-white/10 border border-white/20 text-white text-[14px] font-semibold hover:bg-white/20 active:scale-[0.98] transition-all">
            Login
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   DESKTOP LANDING — the original desktop layout, unchanged.
   ───────────────────────────────────────────────────────────────────────────── */

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
