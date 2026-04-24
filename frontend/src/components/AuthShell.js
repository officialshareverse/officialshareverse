import { Link } from "react-router-dom";

import BrandMark from "./BrandMark";
import PublicFooter from "./PublicFooter";
import ThemeToggle from "./ThemeToggle";

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  themeMode = "light",
  toggleTheme,
  panelWidthClass = "max-w-md",
}) {
  return (
    <div className="sv-page text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
          >
            <BrandMark sizeClass="h-8 w-8" />
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-950">ShareVerse</p>
              <p className="text-xs text-slate-500">Split more. Pay less.</p>
            </div>
          </Link>
          {typeof toggleTheme === "function" ? (
            <ThemeToggle themeMode={themeMode} onToggle={toggleTheme} compact />
          ) : null}
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className={`w-full ${panelWidthClass}`.trim()}>
            <div className="sv-auth-card">
              {(eyebrow || title || subtitle) ? (
                <div className="mb-6 space-y-2">
                  {eyebrow ? <p className="sv-eyebrow">{eyebrow}</p> : null}
                  {title ? <h1 className="text-2xl font-bold text-slate-950">{title}</h1> : null}
                  {subtitle ? (
                    <p className="text-sm leading-6 text-slate-600">{subtitle}</p>
                  ) : null}
                </div>
              ) : null}

              {children}

              {footer ? (
                <div className="mt-6 border-t border-slate-200 pt-4">{footer}</div>
              ) : null}
            </div>
          </div>
        </div>

        <PublicFooter compact />
      </div>
    </div>
  );
}
