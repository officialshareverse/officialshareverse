import { Link } from "react-router-dom";

import PublicFooter from "./PublicFooter";

const valueProps = [
  {
    title: "Share existing subscriptions",
    description: "Open paid slots when you already own a plan and want recurring revenue from unused seats.",
    tone: "bg-sky-100 text-sky-900",
  },
  {
    title: "Buy together as a group",
    description: "Pool money with other members first, then activate the subscription once the group is ready.",
    tone: "bg-amber-100 text-amber-900",
  },
];

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  panelWidthClass = "max-w-md",
}) {
  return (
    <div className="sv-page overflow-hidden text-slate-900">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(187,122,20,0.12),_transparent_26%)]" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
          <section className="flex flex-1 flex-col justify-between px-6 py-8 lg:px-12 lg:py-10">
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f172a_0%,#14532d_100%)] text-xs font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]">
                  SV
                </span>
                <span className="text-xl font-bold leading-none">
                  ShareVerse
                </span>
              </Link>

              <p className="hidden text-sm uppercase tracking-[0.18em] text-slate-500 md:block">
                Shared plans and buy-together groups
              </p>
            </div>

            <div className="my-12 max-w-2xl lg:my-0">
              <p className="sv-eyebrow">
                {eyebrow}
              </p>
              <h1
                className="mt-5 text-5xl leading-[0.94] text-slate-950 md:text-6xl"
              >
                {title}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-700">
                {subtitle}
              </p>

              <div className="mt-10 grid gap-4 md:grid-cols-2">
                {valueProps.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[28px] border border-white/70 bg-white/76 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur"
                  >
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${item.tone}`}
                    >
                      Product mode
                    </span>
                    <h2 className="mt-4 text-xl font-semibold text-slate-950">{item.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                  </article>
                ))}
              </div>

              <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-600">
                <span>Wallet-backed joins</span>
                <span>Owner payouts</span>
                <span>Group-buy activation flow</span>
              </div>
            </div>
          </section>

          <section className="flex w-full items-center justify-center px-6 py-10 lg:max-w-xl lg:px-10">
            <div className={`w-full ${panelWidthClass} rounded-[32px] border border-white/80 bg-white/86 p-7 shadow-[0_36px_90px_rgba(15,23,42,0.16)] backdrop-blur md:p-8`}>
              {children}
              {footer ? <div className="mt-6 border-t border-slate-200 pt-5">{footer}</div> : null}
            </div>
          </section>
        </div>

        <div className="px-6 pb-6 lg:px-10">
          <PublicFooter compact />
        </div>
      </div>
    </div>
  );
}
