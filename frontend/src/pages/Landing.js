import { Link } from "react-router-dom";

import BrandMark from "../components/BrandMark";
import PublicFooter from "../components/PublicFooter";

const heroIllustrationSrc = `${process.env.PUBLIC_URL}/shareverse-hero-network.png`;

const featureNotes = [
  "Subscriptions",
  "Courses",
  "Software",
  "Memberships",
];

const heroHighlights = [
  { label: "Shared-cost groups", value: "Cleaner than scattered chats" },
  { label: "Wallet top-ups", value: "Live with Razorpay" },
  { label: "Community trust", value: "Profiles, reviews, confirmations" },
];

const modes = [
  {
    eyebrow: "Existing plans",
    title: "Turn one digital plan into an organized shared-cost group",
    body: "Invite members into a plan you already manage, keep pricing visible, and track who is active without relying on messy screenshots or scattered DMs.",
  },
  {
    eyebrow: "Buy together",
    title: "Fill a group before the purchase happens",
    body: "Collect interest first, coordinate the purchase once the group is ready, and keep updates, chat, and participation in one shared workspace.",
  },
];

const trustPoints = [
  {
    title: "Visual group status",
    body: "Members can quickly understand whether a group is open, filling, waiting, or already active.",
  },
  {
    title: "One home for updates",
    body: "Notifications, wallet activity, and group chat stay connected so nothing important gets lost.",
  },
  {
    title: "Designed for repeat use",
    body: "Profiles, ratings, and clean participation history help people come back with more confidence.",
  },
];

const useCases = [
  "Netflix and streaming plans",
  "Course or cohort access",
  "Software seats and shared tools",
  "Memberships and digital communities",
];

export default function Landing() {
  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6 md:space-y-8">
        {/* ─── Header ─── */}
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

        {/* ─── Hero ─── */}
        <section className="sv-light-hero sv-light-hero-grid relative overflow-hidden">
          <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-slate-950 shadow-[0_20px_60px_rgba(15,23,42,0.14)] sm:rounded-[28px] md:rounded-[36px]">
            <img
              src={heroIllustrationSrc}
              alt="Illustration showing people coordinating digital plans, tools, and shared-cost participation across one connected platform."
              className="aspect-[4/3.5] w-full object-cover object-center sm:aspect-[16/12] md:aspect-[16/11]"
            />

            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.03)_0%,rgba(15,23,42,0.08)_42%,rgba(15,23,42,0.32)_100%)] sm:bg-[linear-gradient(180deg,rgba(15,23,42,0.14)_0%,rgba(15,23,42,0.16)_26%,rgba(15,23,42,0.28)_56%,rgba(15,23,42,0.52)_100%)]" />

            {/* Desktop overlay badge */}
            <div className="absolute inset-x-0 top-0 hidden gap-3 p-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:p-5 md:p-6">
              <div className="inline-flex w-fit items-center gap-2.5 rounded-full border border-white/18 bg-slate-950/30 px-3 py-2 text-left backdrop-blur-sm">
                <BrandMark glow sizeClass="h-9 w-9" roundedClass="rounded-[12px]" />
                <div>
                  <p className="text-[9px] uppercase tracking-[0.16em] text-white/65">ShareVerse</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-white">Built for calmer split coordination</p>
                </div>
              </div>

              <div className="inline-flex w-fit rounded-full border border-white/22 bg-white/12 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm sm:text-[11px]">
                Digital plans, one shared flow
              </div>
            </div>

            {/* Desktop hero content */}
            <div className="absolute inset-0 hidden items-center justify-center px-4 py-14 sm:flex sm:px-6 sm:py-16 md:px-8 md:py-20">
              <div className="mx-auto max-w-5xl text-center">
                <p className="sv-eyebrow sv-animate-rise text-emerald-300">Split more. Pay less.</p>
                <h1 className="sv-display sv-animate-rise sv-delay-1 mt-3 max-w-4xl mx-auto text-white sm:mt-4">
                  The shared-cost platform for subscriptions, courses, software, and memberships.
                </h1>
                <div className="sv-animate-rise sv-delay-2 mt-3 max-w-3xl mx-auto rounded-[18px] border border-white/12 bg-slate-950/24 px-3 py-3 shadow-[0_20px_48px_rgba(15,23,42,0.24)] backdrop-blur-sm sm:mt-4 sm:rounded-[22px] sm:px-5 sm:py-3.5 md:mt-5 md:rounded-[24px] md:px-6 md:py-4">
                  <p className="text-[12px] font-medium leading-5 text-white drop-shadow-[0_2px_10px_rgba(15,23,42,0.7)] sm:text-sm sm:leading-7 md:text-base md:leading-8">
                    ShareVerse gives digital plans a cleaner system: create a split, coordinate members,
                    track participation, keep updates visible, and manage shared payments in one calm place.
                  </p>
                </div>

                <div className="sv-animate-rise sv-delay-3 mt-5 grid gap-2.5 min-[420px]:grid-cols-2 sm:mt-6 sm:inline-flex sm:flex-wrap sm:justify-center sm:gap-3">
                  <Link to="/signup" className="sv-btn-primary w-full sm:w-auto">
                    Start with your first split
                  </Link>
                  <Link to="/login" className="w-full rounded-full border border-white/28 bg-white/88 px-5 py-2.5 text-center text-sm font-semibold text-slate-950 shadow-[0_18px_42px_rgba(15,23,42,0.18)] backdrop-blur-sm transition hover:bg-white sm:w-auto sm:px-6 sm:py-3">
                    I already have an account
                  </Link>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-5">
                  {featureNotes.map((note, index) => (
                    <span
                      key={note}
                      className={`rounded-full border border-white/22 bg-white/10 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm sm:px-3.5 sm:py-1.5 sm:text-xs ${index === 1 ? "sv-delay-1" : index === 2 ? "sv-delay-2" : index === 3 ? "sv-delay-3" : ""}`}
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile-only hero text card */}
          <div className="-mt-6 px-1 relative z-10 sm:hidden">
            <div className="rounded-[20px] border border-white/80 bg-white/94 px-3.5 py-4 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Split more. Pay less.
              </p>
              <h1 className="mt-2.5 text-[1.55rem] font-bold leading-[1.06] text-slate-950">
                Shared-cost plans, courses, software, and memberships.
              </h1>
              <p className="mt-2.5 text-[13px] leading-[1.6] text-slate-600">
                Create a split, coordinate members, keep updates visible, and manage shared payments in one cleaner flow.
              </p>

              <div className="mt-4 grid gap-2">
                <Link to="/signup" className="sv-btn-primary w-full justify-center text-[13px]">
                  Start with your first split
                </Link>
                <Link to="/login" className="sv-btn-secondary w-full justify-center text-[13px]">
                  I already have an account
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {featureNotes.map((note) => (
                  <span
                    key={note}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700"
                  >
                    {note}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Highlights row */}
          <div className="mt-4 grid gap-2.5 sm:mt-6 md:mt-8 md:grid-cols-3 md:gap-3">
            {heroHighlights.map((item, index) => (
              <article
                key={item.label}
                className={`rounded-[18px] border border-white/70 bg-white/88 p-3 text-left shadow-[0_16px_40px_rgba(15,23,42,0.07)] sm:rounded-[22px] sm:p-4 ${index === 1 ? "sv-animate-float-soft" : index === 2 ? "sv-animate-float sv-delay-1" : "sv-animate-rise"}`}
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">{item.label}</p>
                <p className="mt-2 text-[13px] font-semibold leading-5 text-slate-950 sm:mt-3 sm:text-sm sm:leading-6">{item.value}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Modes ─── */}
        <section className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {modes.map((mode, index) => (
            <article key={mode.title} className={`sv-card-solid relative overflow-hidden ${index === 0 ? "sv-animate-rise" : "sv-animate-rise sv-delay-1"}`}>
              <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-emerald-100/70 blur-3xl sm:h-28 sm:w-28" />
              <p className="sv-eyebrow">{mode.eyebrow}</p>
              <h2 className="sv-title mt-2 max-w-lg sm:mt-3">{mode.title}</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:mt-3 sm:text-sm sm:leading-7">{mode.body}</p>
            </article>
          ))}
        </section>

        {/* ─── Why ShareVerse ─── */}
        <section className="sv-card-solid">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-6">
            <div>
              <p className="sv-eyebrow">Why ShareVerse</p>
              <h2 className="sv-title mt-2 sm:mt-3">A calmer, more visual way to manage digital plan groups</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:mt-3 sm:text-sm sm:leading-7">
                Instead of collecting screenshots, balances, and member updates across scattered chats,
                ShareVerse gives the whole group one coordinated workspace.
              </p>

              <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/90 p-3.5 sm:mt-6 sm:rounded-[24px] sm:p-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">Popular use cases</p>
                <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
                  {useCases.map((item, index) => (
                    <span
                      key={item}
                      className={`rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)] sm:px-4 sm:py-2 sm:text-sm ${index % 2 === 0 ? "sv-animate-float-soft" : "sv-animate-float"}`}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
              {trustPoints.map((point, index) => (
                <div
                  key={point.title}
                  className={`rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:rounded-[24px] sm:p-5 ${index === 1 ? "sv-animate-float-soft" : index === 2 ? "sv-animate-float" : "sv-animate-rise"}`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] text-[12px] font-bold text-white sm:h-11 sm:w-11 sm:rounded-2xl sm:text-sm">
                    0{index + 1}
                  </div>
                  <h3 className="mt-3 text-base font-bold text-slate-950 sm:mt-4 sm:text-lg">{point.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-6 text-slate-600 sm:mt-2 sm:text-sm sm:leading-7">{point.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="sv-card-solid">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-6">
            <div>
              <p className="sv-eyebrow">Ready to start</p>
              <h2 className="sv-title mt-2 sm:mt-3">Bring your next group into one polished workspace.</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:mt-3 sm:text-sm sm:leading-7">
                Create a group, track who joins, use wallet top-ups for live contributions, and keep
                the whole experience organized from the first member to the final confirmation.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
              <Link to="/signup" className="sv-btn-primary justify-center text-[13px] sm:text-sm">
                Create account
              </Link>
              <Link to="/login" className="sv-btn-secondary justify-center text-[13px] sm:text-sm">
                Login
              </Link>
              <Link to="/support" className="sv-btn-secondary justify-center text-[13px] sm:text-sm">
                Talk to support
              </Link>
            </div>
          </div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}
