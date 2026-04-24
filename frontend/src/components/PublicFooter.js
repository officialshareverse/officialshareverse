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
      className={`border border-slate-200 bg-white ${
        compact ? "mt-8 rounded-lg px-4 py-4 shadow-sm sm:px-5" : "mt-10 rounded-lg px-4 py-5 shadow-sm sm:mt-12 sm:px-6 sm:py-6"
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-3 ${
          compact ? "md:flex-row md:items-center md:justify-between" : "md:flex-row md:items-start md:justify-between"
        }`}
      >
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <BrandMark sizeClass="h-10 w-10 sm:h-11 sm:w-11" roundedClass="rounded-[12px]" />
            <div>
              <p className="text-lg font-bold leading-none text-slate-950 sm:text-xl">ShareVerse</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                Split more. Pay less.
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
            <p>Operated by {BUSINESS_OPERATOR_NAME}</p>
            <p className="break-words">Support: {SUPPORT_EMAIL}</p>
            <p>{SUPPORT_PHONE}</p>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm text-slate-600 sm:flex sm:flex-wrap sm:gap-x-5">
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
