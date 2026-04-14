import { Link } from "react-router-dom";

const footerLinks = [
  { to: "/about", label: "About" },
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
        compact ? "mt-8 rounded-[26px] px-5 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.07)]" : "mt-16 rounded-[30px] px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-4 ${
          compact ? "md:flex-row md:items-center md:justify-between" : "md:flex-row md:items-start md:justify-between"
        }`}
      >
        <div className="max-w-xl">
          <p className="text-2xl font-bold leading-none text-slate-950">
            ShareVerse
          </p>
          <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-500">
            Split more. Pay less.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
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
