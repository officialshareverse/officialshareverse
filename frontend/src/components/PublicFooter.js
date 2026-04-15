import { Link } from "react-router-dom";

import BrandMark from "./BrandMark";
import {
  BUSINESS_OPERATOR_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from "./PublicBusinessIdentity";

const footerLinks = [
  { to: "/about", label: "About" },
  { to: "/faq", label: "Q&A" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/refunds", label: "Refund Policy" },
  { to: "/shipping", label: "Shipping Policy" },
  { to: "/support", label: "Support" },
];

export default function PublicFooter({ compact = false }) {
  return (
    <footer
      className={`border border-white/60 bg-white/78 backdrop-blur ${
        compact ? "mt-8 rounded-[24px] px-4 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.07)] sm:px-5" : "mt-10 rounded-[24px] px-4 py-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:mt-16 sm:rounded-[30px] sm:px-6 sm:py-8"
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-4 ${
          compact ? "md:flex-row md:items-center md:justify-between" : "md:flex-row md:items-start md:justify-between"
        }`}
      >
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <BrandMark glow sizeClass="h-10 w-10 sm:h-11 sm:w-11" />
            <div>
              <p className="text-xl font-bold leading-none text-slate-950 sm:text-2xl">
                ShareVerse
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500 sm:text-sm">
                Split more. Pay less.
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-sm leading-7 text-slate-600">
            <p>Operated by {BUSINESS_OPERATOR_NAME}</p>
            <p className="break-words">Support: {SUPPORT_EMAIL}</p>
            <p>{SUPPORT_PHONE}</p>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600 sm:flex sm:flex-wrap sm:gap-x-5">
          {footerLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="font-medium transition hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
