import React from "react";
import { useNavigate } from "react-router-dom";
import PublicPageShell from "../components/PublicPageShell";
import PublicBusinessIdentity, { SUPPORT_EMAIL } from "../components/PublicBusinessIdentity";
import useIsMobile from "../hooks/useIsMobile";

const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=ShareVerse%20account%20deletion%20request&body=Please%20delete%20or%20anonymize%20my%20ShareVerse%20account.%0A%0AUsername%3A%20%0AAccount%20email%3A%20%0ARegistered%20phone%20(optional)%3A%20%0AReason%20(optional)%3A%20`;

const requestSteps = [
  "Use Profile > Account deletion in the ShareVerse mobile app if you can sign in.",
  `If you cannot access the app, email ${SUPPORT_EMAIL} from the email linked to your ShareVerse account.`,
  "Include your username, account email, registered phone number if available, and a short deletion request.",
  "ShareVerse support verifies ownership before deleting or anonymizing account data.",
];

const deletedData = [
  "Profile fields that are no longer required, such as name, phone, profile picture, and account identifiers.",
  "Inactive app session and device records where they are no longer needed for security.",
  "Non-essential support, notification, and preference data after the request is completed.",
];

const retainedData = [
  "Wallet, payout, refund, transaction, tax, and accounting records where retention is required.",
  "Fraud-prevention, chargeback, dispute, complaint, security, and legal records while they remain necessary.",
  "Group records that must stay available to other members, with personal identifiers removed or minimized where possible.",
];

export default function AccountDeletionPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col pb-20 selection:bg-brand/20">
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 bg-slate-50/85 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3 flex items-center shadow-sm">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 text-slate-600 active:bg-slate-50 transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 flex justify-center pr-10">
            <span className="text-[15px] font-bold text-slate-900 tracking-wide">Account</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="px-6 pt-8 pb-6 flex flex-col animate-in slide-in-from-bottom-4 duration-500 fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-100/60 text-[10px] font-bold uppercase tracking-widest text-rose-700 mb-4 w-fit border border-rose-200/50">
            <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Data Management
          </div>
          <h1 className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Account Deletion
          </h1>
          <p className="mt-3 text-[15px] text-slate-600 leading-relaxed font-medium">
            Learn how to permanently delete or anonymize your ShareVerse account data.
          </p>
        </div>

        <div className="px-4 flex flex-col gap-5 mt-2">
          {/* How to request deletion */}
          <article className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "100ms" }}>
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight leading-snug">
              How to request deletion
            </h2>
            <div className="mt-5 flex flex-col gap-3">
              {requestSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                  <div className="w-6 h-6 rounded-full bg-slate-200/70 text-slate-600 flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                    {idx + 1}
                  </div>
                  <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <a 
                href={mailtoHref} 
                className="w-full flex items-center justify-center py-3.5 rounded-[16px] bg-slate-900 text-white font-bold text-[14px] shadow-md shadow-slate-900/20 active:scale-[0.98] transition-transform"
              >
                Email deletion request
              </a>
              <button 
                onClick={() => navigate("/privacy")}
                className="w-full flex items-center justify-center py-3.5 rounded-[16px] bg-white border border-slate-200 text-slate-700 font-bold text-[14px] active:bg-slate-50 transition-colors"
              >
                Read privacy policy
              </button>
            </div>
          </article>

          {/* Deleted Data */}
          <article className="bg-emerald-50 rounded-3xl p-6 shadow-sm border border-emerald-100 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-[17px] font-bold text-emerald-950 tracking-tight">
                Data deleted or anonymized
              </h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {deletedData.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-white/60 rounded-2xl p-4 border border-emerald-100/50">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></div>
                  <p className="text-[13px] text-emerald-900 font-medium leading-relaxed">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </article>

          {/* Retained Data */}
          <article className="bg-amber-50 rounded-3xl p-6 shadow-sm border border-amber-100 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "300ms" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-[17px] font-bold text-amber-950 tracking-tight">
                Records that may be retained
              </h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {retainedData.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-white/60 rounded-2xl p-4 border border-amber-100/50">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></div>
                  <p className="text-[13px] text-amber-900 font-medium leading-relaxed">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </article>

          {/* SLA Note */}
          <div className="mt-2 rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "400ms" }}>
            <svg className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[13px] leading-relaxed text-slate-600 font-medium">
              ShareVerse normally acknowledges account deletion requests within 5 business days and aims to complete eligible deletion or anonymization within 30 days after ownership verification, subject to lawful retention needs.
            </p>
          </div>
        </div>

        {/* Contact/Operator Details */}
        <div className="px-4 mt-8 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "500ms" }}>
          <PublicBusinessIdentity 
            title="Account deletion contact"
            intro=""
            customContainerClass="bg-slate-900 rounded-[28px] p-6 shadow-xl relative overflow-hidden"
            customTextClass="text-slate-300"
            hideTitle={false}
          />
        </div>

      </div>
    );
  }

  return (
    <PublicPageShell
      eyebrow="Account deletion"
      title="Request deletion of your ShareVerse account."
      intro="ShareVerse lets users request account deletion from inside the mobile app or through this public web page. Requests are reviewed so payment, wallet, payout, dispute, and legal records are handled correctly."
    >
      <div className="grid gap-4">
        <article className="rounded-[var(--sv-radius-card)] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-slate-950">How to request deletion</h2>
          <ol className="mt-4 grid gap-2 text-sm leading-7 text-slate-600 md:text-base">
            {requestSteps.map((step, index) => (
              <li key={step} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="font-semibold text-slate-900">{index + 1}. </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={mailtoHref} className="sv-btn-primary justify-center px-5 py-3">
              Email deletion request
            </a>
            <a href="/privacy" className="sv-btn-secondary justify-center px-5 py-3">
              Read privacy policy
            </a>
          </div>
        </article>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[var(--sv-radius-card)] border border-emerald-200 bg-emerald-50 p-5 md:p-6">
            <h2 className="text-xl font-semibold text-emerald-950">Data deleted or anonymized</h2>
            <ul className="mt-4 grid gap-2 text-sm leading-7 text-emerald-950 md:text-base">
              {deletedData.map((item) => (
                <li key={item} className="rounded-[18px] border border-emerald-200 bg-white/70 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[var(--sv-radius-card)] border border-amber-200 bg-amber-50 p-5 md:p-6">
            <h2 className="text-xl font-semibold text-amber-950">Records that may be retained</h2>
            <ul className="mt-4 grid gap-2 text-sm leading-7 text-amber-950 md:text-base">
              {retainedData.map((item) => (
                <li key={item} className="rounded-[18px] border border-amber-200 bg-white/70 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="rounded-[var(--sv-radius-card)] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600 md:p-6 md:text-base">
          ShareVerse normally acknowledges account deletion requests within 5 business days and aims to complete eligible deletion or anonymization within 30 days after ownership verification, subject to lawful retention needs.
        </div>
      </div>

      <PublicBusinessIdentity title="Account deletion contact" />
    </PublicPageShell>
  );
}
