import { Link } from "react-router-dom";

import BrandMark from "./BrandMark";
import PublicFooter from "./PublicFooter";

const valueProps = [
  {
    title: "Split existing digital plan costs",
    description: "Coordinate cost-sharing for a subscription, course, membership, or software plan you already manage.",
    tone: "bg-sky-100 text-sky-900",
  },
  {
    title: "Buy together as a group",
    description: "Collect commitments first, then complete the purchase together once the group is ready.",
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
          {/* Left panel - value props (hidden on mobile, shown on lg) */}
          <section className="hidden flex-1 flex-col justify-between px-6 py-8 lg:flex lg:order-1 lg:px-12 lg:py-10">
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur"
              >
                <BrandMark />
                <span className="text-lg font-bold leading-none sm:text-xl">
                  ShareVerse
                </span>
              </Link>

              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                Split more. Pay less.
              </p>
            </div>

            <div className="my-0 max-w-2xl">
              <p className="sv-eyebrow">
                {eyebrow}
              </p>
              <h1 className="mt-4 text-5xl leading-[1] text-slate-950 md:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-700 md:text-lg">
                {subtitle}
              </p>

              <div className="mt-10 grid gap-4 md:grid-cols-2">
                {valueProps.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[22px] border border-white/70 bg-white/76 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur md:rounded-[28px] md:p-5"
                  >
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] md:text-xs md:tracking-[0.22em] ${item.tone}`}
                    >
                      Product mode
                    </span>
                    <h2 className="mt-4 text-xl font-semibold text-slate-950">{item.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                  </article>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-6 text-sm font-medium text-slate-600">
                <span>Group cost splitting</span>
                <span>Shared coordination</span>
                <span>Status-based activity flow</span>
              </div>
            </div>
          </section>

          {/* Right panel - form (full width on mobile, side panel on lg) */}
          <section className="flex w-full items-start justify-center px-2 py-3 sm:items-center sm:px-4 sm:py-6 lg:max-w-xl lg:px-10 lg:py-10 lg:order-2">
            <div className={`w-full ${panelWidthClass}`}>
              {/* Mobile-only header */}
              <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur"
                >
                  <BrandMark sizeClass="h-7 w-7" />
                  <span className="text-sm font-bold leading-none">ShareVerse</span>
                </Link>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  Split more. Pay less.
                </p>
              </div>

              <div className="rounded-[20px] border border-white/80 bg-white/86 p-4 shadow-[0_28px_70px_rgba(15,23,42,0.14)] backdrop-blur sm:rounded-[26px] sm:p-5 md:rounded-[32px] md:p-8">
                {children}
                {footer ? <div className="mt-5 border-t border-slate-200 pt-4 sm:mt-6 sm:pt-5">{footer}</div> : null}
              </div>
            </div>
          </section>
        </div>

        <div className="px-2 pb-3 sm:px-6 sm:pb-6 lg:px-10">
          <PublicFooter compact />
        </div>
      </div>
    </div>
  );
}
