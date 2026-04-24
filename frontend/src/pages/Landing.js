import { Link } from "react-router-dom";

import BrandMark from "../components/BrandMark";
import PublicFooter from "../components/PublicFooter";

const steps = [
  {
    title: "Open a split",
    body: "Choose sharing when you already manage a plan, or buy together when the group should commit first.",
  },
  {
    title: "Let members join clearly",
    body: "Show price, slots, and status in one place so nobody has to decode screenshots or scattered chats.",
  },
  {
    title: "Manage everything calmly",
    body: "Keep payments, chat, confirmations, and progress inside one clean workspace instead of juggling tools.",
  },
];

const trustPoints = [
  "Sharing for plans you already manage",
  "Buy-together flow with held funds and confirmations",
  "Wallet, notifications, and group chat in one place",
];

const testimonials = [
  {
    name: "Riya S.",
    role: "Hosted a household plan group",
    quote:
      "ShareVerse made the whole flow feel organized instead of improvised. People joined faster because the listing looked clear from the start.",
  },
  {
    name: "Arjun P.",
    role: "Runs software seat groups",
    quote:
      "Pricing, status, and wallet actions now live in one place. I spend less time repeating the same answers to every member.",
  },
  {
    name: "Neha K.",
    role: "Joined a course buy-together",
    quote:
      "I always knew what stage the group was in. It felt much more trustworthy than chasing updates across random chats.",
  },
];

export default function Landing() {
  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Link to="/" className="inline-flex items-center gap-3">
            <BrandMark sizeClass="h-10 w-10" roundedClass="rounded-[12px]" />
            <div>
              <p className="text-lg font-bold text-slate-950">ShareVerse</p>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Split more. Pay less.
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/login" className="sv-btn-secondary px-4 py-2">
              Login
            </Link>
            <Link to="/signup" className="sv-btn-primary px-4 py-2">
              Sign up
            </Link>
          </div>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
                Shared-cost coordination
              </p>
              <h1 className="max-w-3xl text-2xl font-bold text-slate-950">
                A simple place to manage shared plans, buy-togethers, and member payments.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600">
                ShareVerse helps people open a split, let others join with clarity, and keep
                status, chat, and wallet activity in one clean workflow.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link to="/signup" className="sv-btn-primary">
                  Create your first split
                </Link>
                <Link to="/login" className="sv-btn-secondary">
                  I already have an account
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {trustPoints.map((point) => (
                  <div key={point} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Best for
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                <li>Digital subscriptions you already manage</li>
                <li>Courses and memberships with shared-cost coordination</li>
                <li>Small software groups and team plans</li>
              </ul>
              <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">Two clean flows</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Share now if the plan already exists. Buy together if the group should fill before
                  the purchase happens.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              How it works
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Three steps, not ten moving parts
            </h2>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-md border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Step {index + 1}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              What people like
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Trust comes from clarity, not flashy screens
            </h2>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <article key={item.name} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm leading-7 text-slate-700">“{item.quote}”</p>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-950">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.role}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-900 bg-slate-900 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Start now
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Open your first split and keep the whole flow in one place.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                Create a listing, let members join with confidence, and manage shared-cost plans
                without chasing updates across multiple apps.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/signup" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-950">
                Create account
              </Link>
              <Link
                to="/login"
                className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}
