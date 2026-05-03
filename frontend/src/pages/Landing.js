import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import BrandMark from "../components/BrandMark";
import PublicFooter from "../components/PublicFooter";

const heroIllustrationSrc = `${process.env.PUBLIC_URL}/shareverse-hero-network.png`;

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
      "Good for provider-permitted family plans, shared tools, memberships, and courses.",
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

export default function Landing() {
  const [activeMode, setActiveMode] = useState(modes[0].id);
  const [heroLoaded, setHeroLoaded] = useState(false);

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
        <header className="sv-brand-shell flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
          <Link
            to="/"
            className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 sm:flex-none sm:gap-3 sm:rounded-full sm:px-4 sm:py-2.5"
          >
            <BrandMark glow sizeClass="h-8 w-8 sm:h-10 sm:w-10" />
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold leading-none sm:text-xl">ShareVerse</span>
              <span className="mt-0.5 hidden text-[9px] uppercase tracking-[0.14em] text-slate-500 sm:block sm:text-[10px] sm:tracking-[0.18em]">
                Split more. Pay less.
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/login" className="sv-btn-secondary px-3 py-2 text-[13px] sm:px-4 sm:py-2.5 sm:text-sm">
              Login
            </Link>
            <Link to="/signup" className="sv-btn-primary px-3 py-2 text-[13px] sm:px-4 sm:py-2.5 sm:text-sm">
              Sign up
            </Link>
          </div>
        </header>

        <section className="sv-dark-hero sv-landing-hero relative overflow-hidden">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)] lg:items-center">
            <div className="relative z-[1]">
              <span className="sv-live-badge sv-animate-glow">Popular apps, one shared wallet</span>
              <p className="sv-eyebrow-on-dark mt-5">Split more. Pay less.</p>
              <h1 className="sv-display-on-dark mt-4 max-w-4xl">
                Save Rs 500/month on Netflix, Spotify, and everyday apps
                <span className="sv-gradient-text"> by splitting costs safely.</span>
              </h1>
              <p className="sv-landing-hero-body mt-4 max-w-2xl text-[13px] leading-6 text-slate-200 sm:text-sm sm:leading-7 md:text-base md:leading-8">
                Browse live groups or list a plan you already pay for. ShareVerse keeps slots,
                pricing, wallet payments, chat, and withdrawal requests in one place so everyone
                understands the split before joining.
              </p>

              <div className="mt-5 grid gap-2.5 sm:inline-flex sm:flex-wrap sm:gap-3">
                <Link to="/signup" className="sv-btn-primary justify-center">
                  Start saving
                </Link>
                <Link to="/login" className="sv-btn-secondary justify-center bg-white/90 text-slate-950 sm:bg-white/90">
                  Browse live groups
                </Link>
              </div>

              <div className="sv-counter-grid mt-6">
                {heroStats.map((item) => (
                  <CountUpMetric
                    key={item.label}
                    value={item.value}
                    prefix={item.prefix}
                    suffix={item.suffix}
                    decimals={item.decimals}
                    label={item.label}
                    note={item.note}
                  />
                ))}
              </div>

              <div className="sv-landing-feature-notes mt-5 flex flex-wrap gap-2">
                {featureNotes.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => jumpToSection(item.targetId)}
                    className="sv-feature-note"
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="sv-plan-logo-strip mt-5" aria-label="Popular plans on ShareVerse">
                <span className="sv-plan-logo-strip-label">Popular plans</span>
                {popularPlanLogos.map((item) => (
                  <span key={item.name} className={`sv-plan-logo ${item.className}`}>
                    {item.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative z-[1]">
              <div className="sv-hero-media-shell">
                <div className="sv-hero-image-shell">
                  <div
                    className={`sv-hero-image-backdrop ${heroLoaded ? "is-loaded" : ""}`}
                    style={{ backgroundImage: `url(${heroIllustrationSrc})` }}
                  />
                  <div className={`sv-hero-image-placeholder ${heroLoaded ? "is-loaded" : ""}`} />
                  <img
                    src={heroIllustrationSrc}
                    alt="Illustration showing people coordinating digital plans, tools, and shared-cost participation across one connected platform."
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setHeroLoaded(true)}
                    className={`sv-hero-image ${heroLoaded ? "is-ready" : ""}`}
                  />
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
                className={`sv-highlight-card sv-hover-lift ${index === 0 ? "sv-animate-rise" : index === 1 ? "sv-animate-rise sv-delay-1" : "sv-animate-rise sv-delay-2"}`}
              >
                <span className="sv-highlight-card-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">{item.label}</p>
                <p className="mt-2 text-[15px] font-semibold leading-6 text-slate-950 sm:text-base">{item.value}</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">{item.body}</p>
              </button>
            ))}
          </div>
        </section>

        <section id="modes" className="sv-card-solid scroll-mt-24">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="sv-eyebrow">Ways to save</p>
              <h2 className="sv-title mt-2 sm:mt-3">Share a plan you have or start a group purchase</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                Use sharing when you already have the plan. Use buy together when the group should form before anyone commits to the full price.
              </p>
            </div>

            <div className="sv-mode-toggle">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setActiveMode(mode.id)}
                  className={`sv-mode-toggle-button ${activeMode === mode.id ? "is-active" : ""}`}
                >
                  {mode.tab}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
            <article className="sv-mode-preview-card sv-animate-rise">
              <p className="sv-eyebrow">{activeModeContent.eyebrow}</p>
              <h3 className="sv-title mt-2">{activeModeContent.title}</h3>
              <p className="mt-3 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">{activeModeContent.body}</p>

              <div className="mt-4 space-y-2.5">
                {activeModeContent.bullets.map((item) => (
                  <div key={item} className="sv-mode-bullet">
                    <span className="sv-mode-bullet-dot" aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="sv-mode-metrics mt-5 grid gap-2 sm:grid-cols-3">
                {activeModeContent.metrics.map((item) => (
                  <div key={item.label} className="sv-mode-metric">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-[13px] font-semibold leading-6 text-slate-950 sm:text-sm">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <Link to={activeModeContent.ctaTo} className="sv-btn-primary justify-center text-[13px] sm:text-sm">
                  {activeModeContent.cta}
                </Link>
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
                        <p className="mt-1 text-[12px] leading-5 text-slate-600 sm:text-[13px] sm:leading-6">
                          {index === 0
                            ? "Start with a clear intention so people understand what kind of group they are joining."
                            : index === 1
                              ? "Keep the financial and timing expectations easy to scan before anyone commits."
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
            <article
              key={item.step}
              className={`sv-card-solid sv-how-card ${index === 0 ? "sv-animate-rise" : index === 1 ? "sv-animate-rise sv-delay-1" : "sv-animate-rise sv-delay-2"}`}
            >
              <span className="sv-how-step">{item.step}</span>
              <h3 className="sv-title mt-4">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">{item.body}</p>
            </article>
          ))}
        </section>

        <section id="social-proof" className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] scroll-mt-24">
          <section className="sv-card-solid">
            <p className="sv-eyebrow">Why ShareVerse</p>
            <h2 className="sv-title mt-2 sm:mt-3">Know the price, slots, and payout status before you join</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
              ShareVerse is for people who want to save on digital plans without losing track of who paid, what is open, and what happens next.
            </p>

            <div className="sv-trust-timeline mt-5">
              {trustPoints.map((point, index) => (
                <div key={point.title} className="sv-trust-item">
                  <span className="sv-trust-index">0{index + 1}</span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-950 sm:text-lg">{point.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">{point.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="sv-card-solid">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="sv-eyebrow">Safety basics</p>
                <h2 className="sv-title mt-2">Trust signals that match the current product</h2>
              </div>
              <span className="sv-chip">No inflated user claims</span>
            </div>

            <div className="sv-testimonial-list mt-5 grid gap-3 sm:gap-4">
              {safetyChecklist.map((item, index) => (
                <article
                  key={item.title}
                  className={`sv-testimonial-card ${index === 0 ? "sv-animate-rise" : index === 1 ? "sv-animate-rise sv-delay-1" : "sv-animate-rise sv-delay-2"}`}
                >
                  <p className="text-sm font-semibold text-slate-950 sm:text-base">{item.title}</p>
                  <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section id="cta" className="sv-dark-hero sv-landing-cta scroll-mt-24">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
            <div>
              <p className="sv-eyebrow-on-dark">Ready to start</p>
              <h2 className="sv-display-on-dark mt-3 max-w-3xl">
                Start saving on the subscriptions and tools you already use.
              </h2>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-200 sm:text-sm sm:leading-7">
                Create a group, let members join with clear pricing, and use wallet records so every payment and withdrawal has a trace.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
              <Link to="/signup" className="sv-btn-primary justify-center text-[13px] sm:text-sm">
                Create account
              </Link>
              <Link to="/login" className="sv-btn-secondary justify-center bg-white/90 text-[13px] text-slate-950 sm:text-sm">
                Login
              </Link>
              <Link to="/support" className="sv-btn-secondary justify-center bg-white/10 text-[13px] text-white sm:text-sm">
                Talk to support
              </Link>
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

function CountUpMetric({ value, prefix = "", suffix = "", decimals = 0, label, note }) {
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
