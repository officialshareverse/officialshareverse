import { Link } from "react-router-dom";

import BrandMark from "./BrandMark";
import PublicFooter from "./PublicFooter";

export default function PublicPageShell({ eyebrow, title, intro, children }) {
  return (
    <div className="sv-page text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[30px] border border-white/70 bg-white/80 px-5 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
          >
            <BrandMark />
            <span className="text-xl font-bold leading-none">
              ShareVerse
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link to="/login" className="font-medium text-slate-600 transition hover:text-slate-900">
              Login
            </Link>
            <Link
              to="/signup"
              className="sv-btn-primary px-4 py-2.5"
            >
              Create account
            </Link>
          </div>
        </header>

        <section className="sv-light-hero mt-8 px-6 py-8 md:px-8 md:py-10">
          <p className="sv-eyebrow">{eyebrow}</p>
          <h1 className="sv-display mt-4 max-w-4xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
            {intro}
          </p>

          <div className="mt-8">{children}</div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}
