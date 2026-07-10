import React from "react";
import { Link, useNavigate } from "react-router-dom";
import PublicPageShell from "../components/PublicPageShell";
import BrandMark from "../components/BrandMark";
import useIsMobile from "../hooks/useIsMobile";
import {
  BUSINESS_OPERATOR_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from "../components/PublicBusinessIdentity";

const aboutHighlights = [
  {
    icon: "✨",
    title: "What ShareVerse does",
    body: "ShareVerse is a technology platform for coordinating shared payments, participation, and communication for subscriptions, courses, memberships, software plans, and similar digital services.",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    icon: "🤝",
    title: "How the platform is used",
    body: "Users can create groups, join groups, track participation, coordinate through group chat, and manage contribution-related activity in one place with clearer status updates and group accountability.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
];

export default function AboutPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col pb-32">
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 bg-slate-50/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3 flex items-center">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 text-slate-600 active:bg-slate-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 flex justify-center pr-10">
            <span className="text-[15px] font-bold text-slate-900 tracking-wide">About Us</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="px-6 pt-10 pb-8 flex flex-col items-center text-center animate-in slide-in-from-bottom-4 duration-500 fade-in">
          <div className="w-20 h-20 rounded-[22px] bg-white shadow-md border border-slate-100 flex items-center justify-center p-3.5 mb-6 shadow-brand/10">
            <BrandMark glow sizeClass="w-full h-full" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/5 border border-brand/10 text-[10px] font-bold uppercase tracking-widest text-brand mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
            ShareVerse Platform
          </div>
          <h1 className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Built for cleaner <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-teal-500">
              group coordination
            </span>
          </h1>
          <p className="mt-4 text-[15px] text-slate-600 leading-relaxed font-medium">
            The simplest way to share digital services, coordinate group payments, and track access in one secure platform.
          </p>
        </div>

        {/* Highlights */}
        <div className="px-4 flex flex-col gap-4 mt-2">
          {aboutHighlights.map((item, idx) => (
            <div key={idx} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: `${150 * (idx + 1)}ms` }}>
              <div className="flex flex-col gap-4 relative z-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${item.bg}`}>
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-[14px] text-slate-600 leading-relaxed font-medium">
                    {item.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Operator Details Card */}
        <div className="px-4 mt-6 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "450ms" }}>
          <div className="bg-slate-900 rounded-[28px] p-6 shadow-xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-brand opacity-20 rounded-full blur-3xl -mr-10 -mt-10"></div>
            
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-5">
              Operator Details
            </p>
            
            <div className="flex flex-col gap-4 relative z-10">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <span className="text-[13px] text-slate-400 font-medium">Operated by</span>
                <span className="text-[14px] font-bold text-white text-right">{BUSINESS_OPERATOR_NAME}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <span className="text-[13px] text-slate-400 font-medium">Email</span>
                <span className="text-[14px] font-bold text-white text-right">{SUPPORT_EMAIL}</span>
              </div>
              <div className="flex justify-between items-center pb-2">
                <span className="text-[13px] text-slate-400 font-medium">Phone</span>
                <span className="text-[14px] font-bold text-white text-right">{SUPPORT_PHONE}</span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-800/60 p-4 border border-slate-700/50 relative z-10">
              <p className="text-[11px] text-slate-300 leading-relaxed text-center font-medium">
                ShareVerse is managed as an independent online business. Registered address in Maharashtra, India is shared during formal compliance review.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-xl border-t border-slate-200/60 z-50">
          <Link 
            to="/signup"
            className="w-full flex items-center justify-center py-4 rounded-[18px] bg-brand text-white font-bold text-[16px] shadow-lg shadow-brand/20 active:scale-[0.98] transition-transform"
          >
            Join ShareVerse Free
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PublicPageShell
      eyebrow="About us"
      title="What ShareVerse is and who operates it."
      intro="This page gives users, payment providers, and partners a simple overview of the ShareVerse platform and the public contact details behind it."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {aboutHighlights.map((item) => (
          <article
            key={item.title}
            className="rounded-[var(--sv-radius-card)] border border-slate-200 bg-white p-5 shadow-sm md:p-6"
          >
            <h2 className="text-xl font-semibold text-slate-950">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{item.body}</p>
          </article>
        ))}
        <article className="rounded-[var(--sv-radius-card)] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-slate-950">Operator details</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
            ShareVerse is operated by {BUSINESS_OPERATOR_NAME} and is currently managed as an independent online business based in Maharashtra, India.
          </p>
        </article>
      </div>

      <div className="mt-6 rounded-[var(--sv-radius-card)] border border-slate-200 bg-slate-50 p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Public contact details
        </p>
        <div className="mt-4 space-y-2 text-sm leading-7 text-slate-600 md:text-base">
          <p>
            <span className="font-semibold text-slate-900">Operator:</span> {BUSINESS_OPERATOR_NAME}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Email:</span> {SUPPORT_EMAIL}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Phone:</span> {SUPPORT_PHONE}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Registered address is shared only during verification or formal compliance review when required.
          </p>
        </div>
      </div>
    </PublicPageShell>
  );
}
