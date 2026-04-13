import { Link } from "react-router-dom";

import PublicFooter from "../components/PublicFooter";

const heroIllustrationSrc = "/streaming-services-collage.png";

const featureNotes = [
  "Split costs with a group",
  "Group chat for members",
  "Clear status and confirmation flow",
];

const modes = [
  {
    eyebrow: "Existing plans",
    title: "Coordinate shared costs for a plan you already manage",
    body: "Open group spots for a subscription, course, membership, or software plan and let members join with clear pricing.",
  },
  {
    eyebrow: "Buy together",
    title: "Create a group before the purchase happens",
    body: "Collect members first, fill the group, and move forward together once the digital plan or course is ready to be purchased.",
  },
];

const trustPoints = [
  {
    title: "Simple group flow",
    body: "Members can understand what stage a group is in before they join.",
  },
  {
    title: "One shared workspace",
    body: "Wallet activity, notifications, and chat stay connected in one place.",
  },
  {
    title: "Built for trust",
    body: "Profiles, ratings, and confirmations help groups feel more organized.",
  },
];

export default function Landing() {
  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[30px] border border-white/70 bg-white/78 px-5 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f172a_0%,#14532d_100%)] text-xs font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]">
              SV
            </span>
            <span className="text-xl font-bold leading-none">ShareVerse</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/login" className="sv-btn-secondary">
              Login
            </Link>
            <Link to="/signup" className="sv-btn-primary">
              Create account
            </Link>
          </div>
        </header>

        <section className="sv-light-hero">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="text-center lg:text-left">
              <p className="sv-eyebrow">Split more. Pay less.</p>
              <h1 className="sv-display mt-4 max-w-4xl">
                A simple platform for splitting the cost of subscriptions, courses, software, and memberships.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
                ShareVerse helps people organize group payments, participation, and member coordination for digital
                plans with a cleaner flow for updates, accountability, and shared costs.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Link to="/signup" className="sv-btn-primary">
                  Get started
                </Link>
                <Link to="/login" className="sv-btn-secondary">
                  I already have an account
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-2 lg:justify-start">
                {featureNotes.map((note) => (
                  <span key={note} className="sv-chip normal-case tracking-[0.04em]">
                    {note}
                  </span>
                ))}
              </div>
            </div>

            <div className="mx-auto w-full max-w-xl">
              <div className="overflow-hidden rounded-[32px] border border-white/75 bg-white/88 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.1)]">
                <div className="rounded-[28px] bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.12),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3">
                  <img
                    src={heroIllustrationSrc}
                    alt="Popular streaming and digital subscription services shown as colorful circles."
                    className="w-full rounded-[24px] object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {modes.map((mode) => (
            <article key={mode.title} className="sv-card-solid">
              <p className="sv-eyebrow">{mode.eyebrow}</p>
              <h2 className="sv-title mt-3">{mode.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{mode.body}</p>
            </article>
          ))}
        </section>

        <section className="sv-card-solid">
          <div className="max-w-2xl">
            <p className="sv-eyebrow">Why ShareVerse</p>
            <h2 className="sv-title mt-3">Everything important stays in one place</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Instead of managing shared-cost activity across scattered messages and manual tracking, ShareVerse
              keeps the essential coordination steps together in one simple product.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {trustPoints.map((point) => (
              <div key={point.title} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <h3 className="text-lg font-bold text-slate-950">{point.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{point.body}</p>
              </div>
            ))}
          </div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}
