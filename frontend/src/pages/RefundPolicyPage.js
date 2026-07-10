import React from "react";
import { useNavigate } from "react-router-dom";
import PublicPageShell from "../components/PublicPageShell";
import PublicBusinessIdentity from "../components/PublicBusinessIdentity";
import useIsMobile from "../hooks/useIsMobile";

const cards = [
  {
    title: "Wallet top-ups",
    body:
      "Wallet top-ups are credited only after payment verification. If a payment fails or is not captured, the wallet should not be credited. If a verified credit appears incorrectly because of a provider or platform error, ShareVerse may adjust the wallet ledger after review.",
    points: [
      "Top-up issues should be reported within 7 days of the attempted payment.",
      "If a verified top-up was credited incorrectly, ShareVerse may reverse or correct the wallet ledger after review.",
      "Approved corrections are normally initiated within 5 business days after the review is complete.",
    ],
  },
  {
    title: "Sharing groups",
    body:
      "Once a member successfully joins an active sharing group and the host payout is released, refunds are generally limited to platform error, duplicate charge, fraud, or another reason required by law or policy review.",
    points: [
      "Members should report a duplicate charge, missing access, or misleading listing before payout release or within 72 hours of the relevant issue becoming clear.",
      "If an approved refund can still be handled before payout release, the platform may reverse the ledger or return funds to the member wallet.",
      "After payout release, refunds may require additional review, host cooperation, or legal/policy escalation.",
    ],
  },
  {
    title: "Buy-together groups",
    body:
      "Buy-together contributions are held before payout. If the group fails to complete purchase on time, the purchaser refunds members, or the platform detects a qualifying failure state, held funds can be returned to member wallets.",
    points: [
      "Where the platform records an expired or failed buy-together state, refund or return processing is normally initiated within 7 business days.",
      "Disputed access, missing proof, or a provider-rule complaint can pause payout until the issue is resolved.",
      "If members have already confirmed access or payout has already been released, additional review will be required before any reversal is considered.",
    ],
  },
  {
    title: "Fraud, provider complaints, and manual review",
    body:
      "ShareVerse may request additional proof, pause wallet release, or deny a refund request when the facts do not support reversal under the platform policy.",
    points: [
      "Listings under fraud review, chargeback review, provider complaint, IP complaint, or policy investigation may have refunds and payouts paused while evidence is reviewed.",
      "Refund requests that appear abusive, unsupported, or outside the stated timelines may be denied.",
      "ShareVerse may preserve evidence and transaction records while a review is active.",
    ],
  },
];

const timelineItems = [
  {
    title: "Raise the issue fast",
    body: "Use support or the in-product issue flow as soon as possible. Include the listing name, username, amount, date, and screenshots or payment reference.",
  },
  {
    title: "Initial review",
    body: "ShareVerse normally acknowledges refund-sensitive issues within 1 business day and may ask for more proof before deciding how to proceed.",
  },
  {
    title: "Interim action",
    body: "During review, the platform may hold payout, freeze a withdrawal, pause a listing, or keep funds in wallet balance until the facts are clearer.",
  },
  {
    title: "Refund destination",
    body: "Approved corrections are usually returned to ShareVerse wallet balance first. Refunds to the original payment method may be used where required by law, payment-provider rules, or where a top-up never became a valid wallet credit.",
  },
];

export default function RefundPolicyPage() {
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
            <span className="text-[15px] font-bold text-slate-900 tracking-wide">Payments</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="px-6 pt-8 pb-6 flex flex-col animate-in slide-in-from-bottom-4 duration-500 fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/60 text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-4 w-fit border border-amber-200/50">
            <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Refund Policy
          </div>
          <h1 className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Wallet & Refunds
          </h1>
          <p className="mt-3 text-[15px] text-slate-600 leading-relaxed font-medium">
            Learn how wallet credits, group joins, and buy-together failures are handled on ShareVerse.
          </p>
        </div>

        <div className="px-4 flex flex-col gap-5 mt-2">
          {/* Main Policy Cards */}
          {cards.map((card, cIdx) => (
            <article 
              key={card.title} 
              className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both"
              style={{ animationDelay: `${Math.min(cIdx * 100, 600)}ms` }}
            >
              <h2 className="text-[18px] font-bold text-slate-900 tracking-tight leading-snug">
                {card.title}
              </h2>
              <p className="mt-3 text-[14px] text-slate-600 leading-relaxed font-medium">
                {card.body}
              </p>
              
              {card.points && card.points.length > 0 && (
                <div className="mt-4 flex flex-col gap-2.5">
                  {card.points.map((point, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-3 bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                      <div className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div>
                      <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                        {point}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}

          {/* Refund Timeline */}
          <article className="bg-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "700ms" }}>
            <h2 className="text-[18px] font-bold text-white tracking-tight leading-snug mb-6">
              The refund process
            </h2>
            <div className="relative pl-3">
              {/* Vertical line */}
              <div className="absolute top-2 bottom-2 left-[19px] w-[2px] bg-slate-800 rounded-full"></div>
              
              <div className="flex flex-col gap-6">
                {timelineItems.map((item, tIdx) => (
                  <div key={tIdx} className="relative flex gap-4">
                    <div className="w-4 h-4 rounded-full bg-slate-900 border-[4px] border-amber-400 shrink-0 relative z-10 mt-1 shadow-[0_0_12px_rgba(251,191,36,0.4)]"></div>
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-[15px] font-bold text-white">
                        {tIdx + 1}. {item.title}
                      </h3>
                      <p className="text-[13px] leading-relaxed text-slate-400 font-medium">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* SLA Note */}
          <div className="rounded-3xl border border-amber-200/60 bg-amber-50/80 p-5 shadow-sm flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "800ms" }}>
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[13px] leading-relaxed text-amber-900 font-medium">
              Refund timing still depends on payment-provider settlement, wallet status, evidence quality, and whether fraud or provider-policy review is open. ShareVerse may pause refunds or payouts while a complaint is being investigated.
            </p>
          </div>
        </div>

        {/* Contact/Operator Details */}
        <div className="px-4 mt-8 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "900ms" }}>
          <PublicBusinessIdentity 
            title="Refund and support contact"
            intro=""
            customContainerClass="bg-white rounded-[28px] p-6 shadow-sm border border-slate-200/80"
            customTextClass=""
            hideTitle={false}
          />
        </div>

      </div>
    );
  }

  return (
    <PublicPageShell
      eyebrow="Refund policy"
      title="How wallet credits, group joins, and buy-together refunds are handled."
      intro="This policy explains how ShareVerse handles wallet corrections, sharing joins, buy-together failures, and refund-sensitive disputes based on the live product flow."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-[var(--sv-radius-card)] border border-slate-200 bg-slate-50 p-5 md:p-6"
          >
            <h2 className="text-xl font-semibold text-slate-950">{card.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{card.body}</p>
            <ul className="mt-4 grid gap-2 text-sm leading-7 text-slate-600 md:text-base">
              {card.points.map((point) => (
                <li key={point} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                  {point}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {timelineItems.map((item, i) => (
          <article
            key={item.title}
            className="rounded-[var(--sv-radius-card)] border border-slate-200 bg-white p-5 shadow-sm md:p-6"
          >
            <h2 className="text-xl font-semibold text-slate-950">{i + 1}. {item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{item.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[var(--sv-radius-card)] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900 md:p-6">
        Refund timing still depends on payment-provider settlement, wallet status, evidence quality, and whether fraud or provider-policy review is open. ShareVerse may pause refunds or payouts while a complaint is being investigated.
      </div>

      <PublicBusinessIdentity title="Refund and support contact details" />
    </PublicPageShell>
  );
}
