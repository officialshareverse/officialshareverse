import { Link } from "react-router-dom";

import BrandMark from "./BrandMark";
import PublicFooter from "./PublicFooter";

export default function PublicPageShell({ eyebrow, title, intro, children }) {
  return (
    <div className="sv-page text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="sv-brand-shell flex flex-col items-stretch gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Link
            to="/"
            className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 sm:w-auto sm:justify-start"
          >
            <BrandMark glow />
            <span className="text-xl font-bold leading-none">
              ShareVerse
            </span>
          </Link>

          <div className="grid w-full grid-cols-2 gap-3 text-sm sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <Link to="/login" className="font-medium text-slate-600 transition hover:text-slate-900">
              Login
            </Link>
            <Link
              to="/signup"
              className="sv-btn-primary w-full px-4 py-2.5 sm:w-auto"
            >
              Create account
            </Link>
          </div>
        </header>

        <section className="sv-light-hero sv-light-hero-grid mt-6 px-5 py-6 md:mt-8 md:px-8 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
            <div>
              <p className="sv-eyebrow">{eyebrow}</p>
              <h1 className="sv-display mt-4 max-w-4xl">{title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:mt-5 md:text-lg md:leading-8">
                {intro}
              </p>

              <div className="mt-8">{children}</div>
            </div>

            <div className="hidden lg:block">
              <div className="sv-soft-card sv-animate-float-soft">
                <div className="flex items-center gap-3">
                  <BrandMark glow sizeClass="h-14 w-14" roundedClass="rounded-[20px]" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">ShareVerse</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">Built for cleaner group coordination</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}
