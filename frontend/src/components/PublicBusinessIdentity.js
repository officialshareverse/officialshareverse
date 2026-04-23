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
}) {
  return (
    <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{intro}</p>

      <div className="mt-5 space-y-2 text-sm leading-7 text-slate-600 md:text-base">
        <p>
          <span className="font-semibold text-slate-900">Operator:</span> {BUSINESS_OPERATOR_NAME}
        </p>
        <p>
          <span className="font-semibold text-slate-900">Support email:</span> {SUPPORT_EMAIL}
        </p>
        <p>
          <span className="font-semibold text-slate-900">Phone:</span> {SUPPORT_PHONE}
        </p>
        <p>
          <span className="font-semibold text-slate-900">Compliance and grievance email:</span> {COMPLIANCE_EMAIL}
        </p>
        <div>
          <span className="font-semibold text-slate-900">Registered address:</span>
          <div className="mt-1">
            {REGISTERED_ADDRESS_LINES.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <p className="text-sm text-slate-500">
          For provider complaints, payment-verification requests, or formal notices, include the affected listing, usernames, and date range in your email.
        </p>
      </div>
    </div>
  );
}
