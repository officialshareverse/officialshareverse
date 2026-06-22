import React from "react";
import { useNavigate } from "react-router-dom";
import PublicPageShell from "../components/PublicPageShell";
import PublicBusinessIdentity from "../components/PublicBusinessIdentity";
import useIsMobile from "../hooks/useIsMobile";

const sections = [
  {
    title: "Digital-only platform",
    body:
      "ShareVerse is a digital platform. We do not sell or ship physical goods. Access, communication, group coordination, notifications, and member updates are delivered online through the website, email, and in-product flows.",
  },
  {
    title: "How delivery works",
    body:
      "After signup, members can access their account, groups, chats, and profile tools immediately through the ShareVerse website. When a group flow requires host coordination, access updates are handled digitally through the platform and direct member communication, not through courier or postal delivery.",
  },
  {
    title: "Timing expectations",
    body:
      "Digital access timing depends on the specific product flow. Account creation is immediate after successful signup. Group joins, confirmations, proof review, and access coordination depend on host actions, member confirmations, and the applicable group rules shown on the platform.",
  },
  {
    title: "No physical shipping charges",
    body:
      "Because ShareVerse does not ship physical products, there are no shipping fees, logistics charges, or delivery partners involved in normal platform use. Any platform fees, group contributions, or wallet transactions are separate from shipping and are governed by the applicable pricing and refund policies.",
  },
];

export default function ShippingPolicyPage() {
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
            <span className="text-[15px] font-bold text-slate-900 tracking-wide">Delivery</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="px-6 pt-8 pb-6 flex flex-col animate-in slide-in-from-bottom-4 duration-500 fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/60 text-[10px] font-bold uppercase tracking-widest text-indigo-700 mb-4 w-fit border border-indigo-200/50">
            <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Digital Delivery
          </div>
          <h1 className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Shipping Policy
          </h1>
          <p className="mt-3 text-[15px] text-slate-600 leading-relaxed font-medium">
            ShareVerse delivers digital access and coordination only. We do not ship physical products.
          </p>
        </div>

        <div className="px-4 flex flex-col gap-4 mt-2">
          {/* Main Policy Cards */}
          {sections.map((section, sIdx) => (
            <article 
              key={section.title} 
              className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200/80 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both"
              style={{ animationDelay: `${Math.min(sIdx * 100, 600)}ms` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shrink-0">
                  {sIdx === 0 && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  )}
                  {sIdx === 1 && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                  {sIdx === 2 && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {sIdx === 3 && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
                  {section.title}
                </h2>
              </div>
              <p className="text-[14px] text-slate-600 leading-relaxed font-medium">
                {section.body}
              </p>
            </article>
          ))}

          {/* Compliance Note */}
          <div className="mt-2 rounded-[24px] border border-emerald-200/60 bg-emerald-50/80 p-5 shadow-sm flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "500ms" }}>
            <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[13px] leading-relaxed text-emerald-900 font-medium">
              If a payment partner or reviewer needs a plain-language summary: ShareVerse is a web-based service, all delivery is digital, and no physical order fulfillment is involved.
            </p>
          </div>
        </div>

        {/* Contact/Operator Details */}
        <div className="px-4 mt-8 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "600ms" }}>
          <PublicBusinessIdentity 
            title="Business contact for delivery questions"
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
      eyebrow="Shipping policy"
      title="ShareVerse delivers digital access and coordination only."
      intro="This shipping policy explains that ShareVerse does not ship physical products. It exists to clarify digital delivery for members, payment partners, and compliance reviewers."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-slate-50 p-5 md:p-6"
          >
            <h2 className="text-xl font-semibold text-slate-950">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{section.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[length:var(--sv-radius-card)] border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-900 md:p-6">
        If a payment partner or reviewer needs a plain-language summary: ShareVerse is a web-based service, all delivery is digital, and no physical order fulfillment is involved.
      </div>

      <PublicBusinessIdentity title="Business contact for delivery questions" />
    </PublicPageShell>
  );
}
