export const BUSINESS_OPERATOR_NAME = "Chetak Harichandra Pagare";
export const SUPPORT_EMAIL = "support.shareverse@gmail.com";
export const SUPPORT_PHONE = "+91 88569 58201";
export const COMPLIANCE_EMAIL = SUPPORT_EMAIL;
export const REGISTERED_ADDRESS_LINES = [
  "House No. 01, Akkalkuwa Road",
  "Ramgad, Taloda",
  "Nandurbar, Maharashtra 425413",
  "India",
];

export default function PublicBusinessIdentity({
  title = "Business identity and contact",
  intro = "ShareVerse is operated by Chetak Harichandra Pagare. These public contact details are provided for members, partners, payment providers, and compliance review.",
  isMobile
}) {
  return (
    <div className={isMobile ? "mt-6 rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm" : "mt-6 rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-white p-5 shadow-sm md:p-6"}>
      <h2 className={isMobile ? "text-[18px] font-black text-slate-900 mb-2" : "text-2xl font-semibold text-slate-950"}>{title}</h2>
      <p className={isMobile ? "text-[13px] leading-relaxed text-slate-500" : "mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base"}>{intro}</p>

      <div className={isMobile ? "mt-5 space-y-3 text-[13px] leading-relaxed text-slate-600" : "mt-5 space-y-2 text-sm leading-7 text-slate-600 md:text-base"}>
        <p>
          <span className={isMobile ? "font-bold text-slate-900 block text-[11px] uppercase tracking-widest text-slate-400 mb-0.5" : "font-semibold text-slate-900"}>Operator{isMobile ? "" : ":"}</span> {BUSINESS_OPERATOR_NAME}
        </p>
        <p>
          <span className={isMobile ? "font-bold text-slate-900 block text-[11px] uppercase tracking-widest text-slate-400 mb-0.5" : "font-semibold text-slate-900"}>Support email{isMobile ? "" : ":"}</span> {SUPPORT_EMAIL}
        </p>
        <p>
          <span className={isMobile ? "font-bold text-slate-900 block text-[11px] uppercase tracking-widest text-slate-400 mb-0.5" : "font-semibold text-slate-900"}>Phone{isMobile ? "" : ":"}</span> {SUPPORT_PHONE}
        </p>
        <p>
          <span className={isMobile ? "font-bold text-slate-900 block text-[11px] uppercase tracking-widest text-slate-400 mb-0.5" : "font-semibold text-slate-900"}>Compliance and grievance email{isMobile ? "" : ":"}</span> {COMPLIANCE_EMAIL}
        </p>
        <div>
          <span className={isMobile ? "font-bold text-slate-900 block text-[11px] uppercase tracking-widest text-slate-400 mb-0.5" : "font-semibold text-slate-900"}>Registered address{isMobile ? "" : ":"}</span>
          <div className={isMobile ? "" : "mt-1"}>
            {REGISTERED_ADDRESS_LINES.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <div className={isMobile ? "mt-4 pt-4 border-t border-slate-100" : ""}>
          <p className={isMobile ? "text-[12px] text-slate-400 leading-relaxed italic" : "text-sm text-slate-500"}>
            For provider complaints, payment-verification requests, or formal notices, include the affected listing, usernames, and date range in your email.
          </p>
        </div>
      </div>
    </div>
  );
}
