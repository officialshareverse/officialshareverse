import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import BrandMark from "../components/BrandMark";
import PublicFooter from "../components/PublicFooter";

const heroIllustrationSrc = `${process.env.PUBLIC_URL}/shareverse-hero-network.png`;

const featureNotes = [
  { label: "Subscriptions", icon: "📺", targetId: "modes" },
  { label: "Courses", icon: "🎓", targetId: "how-it-works" },
  { label: "Software", icon: "💻", targetId: "social-proof" },
  { label: "Memberships", icon: "🏷️", targetId: "cta" },
];

const heroStats = [
  { value: 500, suffix: "+", label: "active splits", note: "from streaming plans to software seats" },
  { value: 12, prefix: "₹", suffix: "L+", label: "saved together", note: "through cleaner shared-cost coordination" },
  { value: 4.9, suffix: "/5", label: "community trust", note: "from repeat hosts and members", decimals: 1 },
];

const heroHighlights = [
  {
    icon: "📦",
    label: "Shared-cost groups",
    value: "Cleaner than scattered chats",
    body: "Create a group once, keep members aligned, and stop juggling screenshots or reminders across apps.",
    targetId: "modes",
  },
  {
    icon: "💸",
    label: "Wallet top-ups",
    value: "Ready before members join",
    body: "Keep wallet funding and plan participation in one flow, instead of chasing contributions one by one.",
    targetId: "cta",
  },
  {
    icon: "🛡️",
    label: "Community trust",
    value: "Profiles, reviews, confirmations",
    body: "Make repeat participation feel safer with visible status, cleaner history, and accountable group activity.",
    targetId: "social-proof",
  },
];

const modes = [
  {
    id: "sharing",
    tab: "Sharing",
    eyebrow: "Existing plans",
    title: "Turn one digital plan into an organized shared-cost group",
    body: "Invite members into a plan you already manage, keep pricing visible, and track who is active without relying on messy screenshots or scattered DMs.",
    cta: "Start a sharing split",
    ctaTo: "/signup",
    bullets: [
      "Best when you already own the subscription or tool.",
      "Great for streaming, shared tools, premium memberships, and courses.",
      "Members join a clear flow instead of a casual chat thread.",
    ],
    metrics: [
      { label: "Best for", value: "Existing plans" },
      { label: "Works well with", value: "Subscriptions and software" },
      { label: "Main benefit", value: "Cleaner host control" },
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
    title: "Fill a group before the purchase happens",
    body: "Collect commitments first, coordinate the purchase once the group is ready, and keep updates, chat, and participation in one shared workspace.",
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
      { label: "Main benefit", value: "Clear readiness tracking" },
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
    title: "Visual group status",
    body: "Members can tell whether a group is open, filling, waiting, or active without reading long explanations.",
  },
  {
    title: "One home for updates",
    body: "Notifications, wallet activity, and chat stay connected so the next step is always easier to spot.",
  },
  {
    title: "Designed for repeat use",
    body: "Profiles, ratings, and clean participation history help people come back with more confidence next time.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Open a split",
    body: "Choose whether you are sharing an existing plan or buying together after members commit.",
  },
  {
    step: "02",
    title: "Let people join clearly",
    body: "Show slots, pricing, and status in one place so members know exactly what they are entering.",
  },
  {
    step: "03",
    title: "Manage progress calmly",
    body: "Track confirmations, wallet actions, chat, and updates without losing the thread of the group.",
  },
];

const testimonials = [
  {
    name: "Riya S.",
    role: "Hosted a streaming split",
    quote: "ShareVerse made the whole thing feel organized instead of improvised. People joined faster because everything looked clear from the start.",
  },
  {
    name: "Arjun P.",
    role: "Runs software seat groups",
    quote: "The difference is confidence. Pricing, status, and wallet actions live in one place, so fewer questions keep coming back to me.",
  },
  {
    name: "Neha K.",
    role: "Joined a course buy-together",
    quote: "I liked knowing where the group stood without checking five chats. It felt much more real and much less messy.",
  },
];

const joinTickerItems = [
  "A streaming group filled in 18 minutes",
  "A cohort course split opened with 6 seats",
  "Three teammates started a software buy-together",
  "A wallet top-up cleared before a new group launch",
  "Another membership group just went live",
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
              <span className="sv-live-badge sv-animate-glow">🔥 New groups added today</span>
              <p className="sv-eyebrow-on-dark mt-5">Split more. Pay less.</p>
              <h1 className="sv-display-on-dark mt-4 max-w-4xl">
                Shared-cost plans feel more trustworthy when the whole flow looks
                <span className="sv-gradient-text"> organized from the start.</span>
              </h1>
              <p className="sv-landing-hero-body mt-4 max-w-2xl text-[13px] leading-6 text-slate-200 sm:text-sm sm:leading-7 md:text-base md:leading-8">
                ShareVerse gives subscriptions, courses, software, and memberships a calmer system:
                create a split, let people join clearly, keep updates visible, and manage shared payments
                in one premium-feeling workspace.
              </p>

              <div className="mt-5 grid gap-2.5 sm:inline-flex sm:flex-wrap sm:gap-3">
                <Link to="/signup" className="sv-btn-primary justify-center">
                  Start with your first split
                </Link>
                <Link to="/login" className="sv-btn-secondary justify-center bg-white/90 text-slate-950 sm:bg-white/90">
                  I already have an account
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

                  <div className="sv-hero-floating-card">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Live social proof
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950 sm:text-base">
                      Join 500+ users already splitting costs in a cleaner workflow.
                    </p>
                  </div>
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
              <p className="sv-eyebrow">Modes that match the real-world flow</p>
              <h2 className="sv-title mt-2 sm:mt-3">Choose between sharing a plan now or buying together later</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                Instead of presenting two static cards, ShareVerse can explain each mode in context so people immediately understand which flow fits their group.
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
            <h2 className="sv-title mt-2 sm:mt-3">A calmer, more visual way to manage digital plan groups</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
              Instead of collecting screenshots, balances, and member updates across scattered chats, ShareVerse gives the whole group one coordinated workspace.
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
                <p className="sv-eyebrow">Social proof</p>
                <h2 className="sv-title mt-2">People come back when the flow feels trustworthy</h2>
              </div>
              <span className="sv-chip">Rated 4.9/5 by repeat users</span>
            </div>

            <div className="sv-testimonial-list mt-5 grid gap-3 sm:gap-4">
              {testimonials.map((item, index) => (
                <article
                  key={item.name}
                  className={`sv-testimonial-card ${index === 0 ? "sv-animate-rise" : index === 1 ? "sv-animate-rise sv-delay-1" : "sv-animate-rise sv-delay-2"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 sm:text-base">{item.name}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500 sm:text-xs">{item.role}</p>
                    </div>
                    <span className="text-amber-500">★★★★★</span>
                  </div>
                  <p className="mt-3 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">{item.quote}</p>
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
                Join 500+ users already splitting costs in a workflow that looks as organized as it feels.
              </h2>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-200 sm:text-sm sm:leading-7">
                Create a group, track who joins, keep updates visible, and bring wallet actions into the same polished flow instead of managing everything through scattered conversations.
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
