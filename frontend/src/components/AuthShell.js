import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import BrandMark from "./BrandMark";
import PublicFooter from "./PublicFooter";
import ThemeToggle from "./ThemeToggle";

const valueProps = [
  {
    title: "Split existing digital plan costs",
    description: "Coordinate cost-sharing for a subscription, course, membership, or software plan you already manage.",
    badge: "Subscriptions",
  },
  {
    title: "Buy together as a group",
    description: "Collect commitments first, then complete the purchase together once the group is ready.",
    badge: "Buy together",
  },
  {
    title: "Keep wallet and group actions in one place",
    description: "Track who joined, what needs your response, and when payments are ready to move.",
    badge: "Dashboard",
  },
];

const testimonials = [
  {
    quote: "The setup felt clear on the first try. I created a software split and had members in the same evening.",
    name: "Aarav",
    meta: "Hosted a Canva split",
  },
  {
    quote: "The buy-together flow made it much easier to collect interest before anyone paid for the whole plan upfront.",
    name: "Nisha",
    meta: "Coordinated a course purchase",
  },
  {
    quote: "I like that wallet, chats, and approvals all sit together. It feels easier to keep track of active groups.",
    name: "Rohan",
    meta: "Joined multiple streaming groups",
  },
];

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  themeMode = "light",
  toggleTheme,
  panelWidthClass = "max-w-md",
  compact = false,
}) {
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    if (compact) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveTestimonial((current) => (current + 1) % testimonials.length);
    }, 5200);

    return () => window.clearInterval(intervalId);
  }, [compact]);

  const testimonial = testimonials[activeTestimonial];

  return (
    <div className="sv-page sv-auth-shell-page overflow-hidden text-slate-900">
      <div className="sv-auth-shell">
        <div className="sv-auth-shell-bg" aria-hidden="true" />
        <div className="sv-auth-shell-orb is-one" aria-hidden="true" />
        <div className="sv-auth-shell-orb is-two" aria-hidden="true" />

        <Link to="/" className="sv-auth-floating-badge">
          <BrandMark glow />
          <span>
            <strong>ShareVerse</strong>
            <small>Split more. Pay less.</small>
          </span>
        </Link>

        {typeof toggleTheme === "function" ? (
          <div className="sv-auth-theme-toggle">
            <ThemeToggle themeMode={themeMode} onToggle={toggleTheme} compact />
          </div>
        ) : null}

        <div
          className={`relative mx-auto min-h-screen ${
            compact ? "flex max-w-5xl flex-col" : "flex max-w-7xl flex-col lg:flex-row"
          }`}
        >
          {!compact ? (
            <section className="sv-auth-left-panel hidden lg:flex lg:order-1">
              <div className="max-w-2xl">
                <p className="sv-eyebrow">{eyebrow}</p>
                <h1 className="mt-4 text-5xl leading-[0.98] text-slate-950 md:text-6xl">{title}</h1>
                <p className="mt-5 max-w-xl text-base leading-8 text-slate-700 md:text-lg">{subtitle}</p>

                <div className="mt-10 grid gap-4 md:grid-cols-2">
                  {valueProps.slice(0, 2).map((item) => (
                    <article key={item.title} className="sv-auth-value-card">
                      <span className="sv-auth-value-badge">{item.badge}</span>
                      <h2 className="mt-4 text-xl font-semibold text-slate-950">{item.title}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                    </article>
                  ))}
                </div>

                <div className="sv-auth-testimonial">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="sv-eyebrow">Member note</p>
                      <p className="mt-3 text-base leading-8 text-slate-800">“{testimonial.quote}”</p>
                    </div>
                    <span className="sv-auth-quote-mark">”</span>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-950">{testimonial.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{testimonial.meta}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {testimonials.map((item, index) => (
                        <span
                          key={item.name}
                          className={`sv-auth-dot ${index === activeTestimonial ? "is-active" : ""}`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section
            className={`flex w-full items-start justify-center ${
              compact
                ? "flex-1 px-2 py-3 sm:px-4 sm:py-6 lg:px-6 lg:py-10"
                : "px-2 py-3 sm:items-center sm:px-4 sm:py-6 lg:max-w-xl lg:px-10 lg:py-10 lg:order-2"
            }`}
          >
            <div className={`w-full ${panelWidthClass}`}>
              <div className="sv-auth-mobile-banner lg:hidden">
                <div className="sv-auth-mobile-scroll">
                  {valueProps.map((item) => (
                    <article key={item.title} className="sv-auth-mobile-chip">
                      <span className="sv-auth-value-badge">{item.badge}</span>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </article>
                  ))}
                </div>
              </div>

              <div className={`mb-3 flex items-center justify-between gap-3 ${compact ? "" : "lg:hidden"}`}>
                <Link to="/" className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur">
                  <BrandMark sizeClass="h-7 w-7" />
                  <span className="text-sm font-bold leading-none">ShareVerse</span>
                </Link>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Split more. Pay less.</p>
              </div>

              <div className="sv-auth-card">
                {children}
                {footer ? <div className="mt-5 border-t border-slate-200 pt-4 sm:mt-6 sm:pt-5">{footer}</div> : null}
              </div>
            </div>
          </section>
        </div>

        <div className={`px-2 pb-3 sm:px-6 sm:pb-6 ${compact ? "lg:px-6" : "lg:px-10"}`}>
          <PublicFooter compact />
        </div>
      </div>
    </div>
  );
}
