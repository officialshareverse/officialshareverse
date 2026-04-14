import { Link } from "react-router-dom";

import BrandMark from "./BrandMark";
import PublicFooter from "./PublicFooter";

export default function PublicPageShell({ eyebrow, title, intro, children }) {
  return (
    <div className="sv-page text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col items-stretch gap-4 rounded-[24px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:rounded-[30px] sm:px-5">
          <Link
            to="/"
            className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 sm:w-auto sm:justify-start"
          >
            <BrandMark />
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

        <section className="sv-light-hero mt-6 px-5 py-6 md:mt-8 md:px-8 md:py-10">
          <p className="sv-eyebrow">{eyebrow}</p>
          <h1 className="sv-display mt-4 max-w-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:mt-5 md:text-lg md:leading-8">
            {intro}
          </p>

          <div className="mt-8">{children}</div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}
