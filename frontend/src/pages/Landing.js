import { Link } from "react-router-dom";

import BrandMark from "../components/BrandMark";
import PublicFooter from "../components/PublicFooter";

const heroIllustrationSrc = `${process.env.PUBLIC_URL}/streaming-services-collage.png`;
const logoSrc = `${process.env.PUBLIC_URL}/shareverse-logo.jpeg`;

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
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="sv-brand-shell flex flex-col items-stretch gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Link
            to="/"
            className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 sm:w-auto sm:justify-start"
          >
            <BrandMark glow />
            <div>
              <span className="block text-xl font-bold leading-none">ShareVerse</span>
              <span className="mt-1 hidden text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:block">
                Split more. Pay less.
              </span>
            </div>
          </Link>

          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <Link to="/login" className="sv-btn-secondary w-full sm:w-auto">
              Login
            </Link>
            <Link to="/signup" className="sv-btn-primary w-full sm:w-auto">
              Create account
            </Link>
          </div>
        </header>

        <section className="sv-light-hero sv-light-hero-grid relative">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <div className="text-center lg:text-left">
              <p className="sv-eyebrow sv-animate-rise">Split more. Pay less.</p>
              <h1 className="sv-display sv-animate-rise sv-delay-1 mt-4 max-w-4xl">
                The shared-cost platform for subscriptions, courses, software, and memberships.
              </h1>
              <p className="sv-animate-rise sv-delay-2 mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:mt-5 md:text-base md:leading-8">
                ShareVerse gives digital plans a cleaner system: create a group, coordinate members,
                track participation, keep updates visible, and manage shared payments in one calm place.
              </p>

              <div className="sv-animate-rise sv-delay-3 mt-7 grid gap-3 sm:inline-flex sm:flex-wrap sm:justify-center lg:justify-start">
                <Link to="/signup" className="sv-btn-primary w-full sm:w-auto">
                  Start with your first split
                </Link>
                <Link to="/login" className="sv-btn-secondary w-full sm:w-auto">
                  I already have an account
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
                {featureNotes.map((note, index) => (
                  <span
                    key={note}
                    className={`sv-chip sv-animate-rise normal-case tracking-[0.04em] ${index === 1 ? "sv-delay-1" : index === 2 ? "sv-delay-2" : index === 3 ? "sv-delay-3" : ""}`}
                  >
                    {note}
                  </span>
                ))}
              </div>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                {heroHighlights.map((item, index) => (
                  <article
                    key={item.label}
                    className={`rounded-[22px] border border-white/70 bg-white/88 p-4 text-left shadow-[0_20px_48px_rgba(15,23,42,0.08)] ${index === 1 ? "sv-animate-float-soft" : index === 2 ? "sv-animate-float sv-delay-1" : "sv-animate-rise"}`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-950">{item.value}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -left-3 top-5 hidden rounded-full border border-white/70 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-[0_18px_42px_rgba(15,23,42,0.1)] md:block sv-animate-float">
                Shared-cost groups
              </div>
              <div className="absolute -right-3 bottom-8 hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800 shadow-[0_18px_42px_rgba(15,23,42,0.1)] md:block sv-animate-float-soft">
                Trust-first flow
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f6fbfc_100%)] p-3 shadow-[0_28px_70px_rgba(15,23,42,0.12)] md:p-4">
                <div className="rounded-[24px] border border-white/90 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.12),transparent_26%),linear-gradient(180deg,#ffffff_0%,#eef6f8_100%)] p-4 md:p-5">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between rounded-[24px] border border-slate-200 bg-white/92 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                      <div className="flex items-center gap-3">
                        <BrandMark glow sizeClass="h-12 w-12" roundedClass="rounded-[18px]" />
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">ShareVerse</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">Built for group coordination</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                        Live beta
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white p-2 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                      <img
                        src={heroIllustrationSrc}
                        alt="Popular streaming and digital subscription services shown as colorful circles."
                        className="sv-animate-float-soft w-full rounded-[18px] object-cover"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-[20px] border border-slate-200 bg-slate-950 p-4 text-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Best for</p>
                        <p className="mt-3 text-lg font-semibold">Subscriptions, courses, software, memberships</p>
                      </div>
                      <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                        <div className="flex items-center gap-3">
                          <img
                            src={logoSrc}
                            alt="ShareVerse brand logo"
                            className="h-12 w-12 rounded-[16px] border border-slate-200 object-cover shadow-[0_12px_24px_rgba(15,23,42,0.1)]"
                          />
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-800">What you get</p>
                            <p className="mt-1 text-sm font-semibold text-slate-950">Cleaner than unmanaged group chats</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {modes.map((mode, index) => (
            <article key={mode.title} className={`sv-card-solid relative overflow-hidden ${index === 0 ? "sv-animate-rise" : "sv-animate-rise sv-delay-1"}`}>
              <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-emerald-100/70 blur-3xl" />
              <p className="sv-eyebrow">{mode.eyebrow}</p>
              <h2 className="sv-title mt-3 max-w-lg">{mode.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{mode.body}</p>
            </article>
          ))}
        </section>

        <section className="sv-card-solid">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
            <div>
              <p className="sv-eyebrow">Why ShareVerse</p>
              <h2 className="sv-title mt-3">A calmer, more visual way to manage digital plan groups</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Instead of collecting screenshots, balances, and member updates across scattered chats,
                ShareVerse gives the whole group one coordinated workspace.
              </p>

              <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Popular use cases</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {useCases.map((item, index) => (
                    <span
                      key={item}
                      className={`rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${index % 2 === 0 ? "sv-animate-float-soft" : "sv-animate-float"}`}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {trustPoints.map((point, index) => (
                <div
                  key={point.title}
                  className={`rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.07)] ${index === 1 ? "sv-animate-float-soft" : index === 2 ? "sv-animate-float" : "sv-animate-rise"}`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] text-sm font-bold text-white">
                    0{index + 1}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-950">{point.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{point.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sv-card-solid">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <p className="sv-eyebrow">Ready to start</p>
              <h2 className="sv-title mt-3">Bring your next group into one polished workspace.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Create a group, track who joins, use wallet top-ups for live contributions, and keep
                the whole experience organized from the first member to the final confirmation.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Link to="/signup" className="sv-btn-primary justify-center">
                Create account
              </Link>
              <Link to="/login" className="sv-btn-secondary justify-center">
                Login
              </Link>
              <Link to="/support" className="sv-btn-secondary justify-center">
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
