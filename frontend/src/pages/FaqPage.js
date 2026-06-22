import React from "react";
import { useNavigate } from "react-router-dom";
import PublicBusinessIdentity from "../components/PublicBusinessIdentity";
import PublicPageShell from "../components/PublicPageShell";
import useIsMobile from "../hooks/useIsMobile";

const faqSections = [
  {
    title: "Using ShareVerse",
    icon: "🚀",
    color: "from-blue-500 to-indigo-500",
    items: [
      {
        question: "What is ShareVerse?",
        answer:
          "ShareVerse is a platform for coordinating shared-cost participation for digital plans, courses, memberships, software plans, and similar services where the provider allows it. It helps people organize groups, track payments, chat with members, and manage the group flow in one place.",
      },
      {
        question: "How do I join a split?",
        answer:
          "Create an account, open a split you want to join, review the price and platform fee, and complete the wallet payment. After you join, you can track updates from My Splits and group chat.",
      },
      {
        question: "Do I need to share my own login credentials?",
        answer:
          "No. ShareVerse does not support listings that ask members to upload passwords, exchange account credentials, or send secret access details through the platform. Hosts should only coordinate access in ways where the provider allows it and should never request member passwords.",
      },
      {
        question: "Can I create splits for courses, software, or memberships too?",
        answer:
          "Yes, if the underlying provider allows that arrangement. ShareVerse is designed for digital plans such as courses, memberships, software tools, and similar services where users want clearer shared-cost coordination, but high-risk or policy-breaking listings can be blocked or removed.",
      },
    ],
  },
  {
    title: "Payments & Withdrawals",
    icon: "💳",
    color: "from-emerald-500 to-teal-500",
    items: [
      {
        question: "How do top-ups work?",
        answer:
          "Wallet top-ups are processed through Razorpay. When a payment succeeds and is verified by the backend, the wallet balance is updated and the transaction appears in your wallet history.",
      },
      {
        question: "Why is there a 5% platform fee?",
        answer:
          "The platform fee helps cover payment processing, support operations, and platform maintenance. You will see the fee separately in the join pricing so the total payable is clear before you confirm.",
      },
      {
        question: "How do withdrawals work right now?",
        answer:
          "Withdrawals are requested from the wallet page and are typically processed within 24 hours after operator checks.",
      },
      {
        question: "What happens if there is a payment issue?",
        answer:
          "If a wallet credit, duplicate charge, or payout issue looks wrong, contact support with your username, amount, payment reference, and screenshots. The support team uses that trail to review and resolve the case.",
      },
    ],
  },
  {
    title: "Safety & Compliance",
    icon: "🛡️",
    color: "from-purple-500 to-pink-500",
    items: [
      {
        question: "Is this legal?",
        answer:
          "ShareVerse is a software platform for coordinating shared-cost participation. Whether a specific listing is allowed depends on the provider's rules, the host's actual setup, and applicable law. Users are responsible for making sure their activity follows those requirements, and ShareVerse does not provide legal advice or guarantee that every provider permits every arrangement.",
      },
      {
        question: "Does ShareVerse guarantee provider approval?",
        answer:
          "No. Different providers have different policies. Some services may allow household or team sharing, while others may restrict transfer, resale, or shared use. Hosts and members should check the provider's rules before participating, and ShareVerse may remove listings that appear to depend on prohibited sharing or credential transfer.",
      },
      {
        question: "What if a host or member misuses a split?",
        answer:
          "The platform can review reports, pause sensitive flows, preserve transaction history, freeze payouts or wallet actions when needed, and remove users or content that appears misleading, abusive, or against platform rules. Members should report serious issues through support or the in-product issue flow.",
      },
      {
        question: "Can I get a refund?",
        answer:
          "Refund handling depends on the split type, payment state, and the issue involved. If a buy-together flow fails before completion, funds can be returned according to the platform flow. For other issues, contact support so the case can be reviewed under the published refund policy.",
      },
    ],
  },
];

export default function FaqPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
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
            <span className="text-[15px] font-bold text-slate-900 tracking-wide">Q&A</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="px-6 pt-8 pb-6 flex flex-col animate-in slide-in-from-bottom-4 duration-500 fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/5 border border-brand/10 text-[10px] font-bold uppercase tracking-widest text-brand mb-4 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
            Help Center
          </div>
          <h1 className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Questions & Answers
          </h1>
          <p className="mt-3 text-[15px] text-slate-600 leading-relaxed font-medium">
            Find quick explanations on how ShareVerse works, payments, and our approach to safety.
          </p>
        </div>

        {/* FAQ Sections */}
        <div className="px-4 flex flex-col gap-8 mt-2">
          {faqSections.map((section, sIdx) => (
            <section 
              key={section.title} 
              className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both"
              style={{ animationDelay: `${150 * (sIdx + 1)}ms` }}
            >
              <div className="flex items-center gap-3 px-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${section.color} shadow-sm flex items-center justify-center text-lg text-white`}>
                  {section.icon}
                </div>
                <h2 className="text-[19px] font-bold text-slate-900 tracking-tight">{section.title}</h2>
              </div>
              
              <div className="flex flex-col gap-3">
                {section.items.map((item, idx) => (
                  <details 
                    key={idx} 
                    className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
                  >
                    <summary className="flex items-center justify-between px-5 py-4 font-bold text-[15px] text-slate-800 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none active:bg-slate-50/50 transition-colors">
                      <span className="pr-4 leading-snug">{item.question}</span>
                      <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-500 group-open:rotate-180 transition-transform duration-300">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </summary>
                    <div className="px-5 pb-5 pt-1 text-[14px] text-slate-600 leading-relaxed font-medium border-t border-slate-100 mt-1 bg-slate-50/30">
                      {item.answer}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Support Section */}
        <div className="px-4 mt-10 animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both" style={{ animationDelay: "600ms" }}>
          <div className="bg-slate-900 rounded-[28px] p-6 shadow-xl text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-40 h-40 bg-blue-500 opacity-20 rounded-full blur-3xl -ml-10 -mt-10"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500 opacity-20 rounded-full blur-3xl -mr-10 -mb-10"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-4 border border-white/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-[18px] font-bold text-white mb-2">Need more help?</h3>
              <p className="text-[13px] text-slate-300 leading-relaxed font-medium mb-6">
                If your question is about a real payment, access issue, dispute, or verification check, our support team can review the exact case.
              </p>
              
              <div className="w-full">
                <PublicBusinessIdentity 
                  hideTitle={true} 
                  customContainerClass="rounded-2xl bg-white/10 p-4 border border-white/10 text-left" 
                  customTextClass="text-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  }

  return (
    <PublicPageShell
      eyebrow="Questions and answers"
      title="Common ShareVerse questions, answered clearly."
      intro="This page gives members, hosts, providers, and verification teams a quick explanation of how ShareVerse works, how payments are handled, and how the platform approaches safety, provider compliance, and support."
    >
      <div className="grid gap-6">
        {faqSections.map((section) => (
          <section
            key={section.title}
            className="rounded-[length:var(--sv-radius-card-md)] border border-slate-200 bg-white p-5 shadow-sm md:p-6"
          >
            <h2 className="text-2xl font-semibold text-slate-950">{section.title}</h2>
            <div className="mt-5 grid gap-4">
              {section.items.map((item) => (
                <article
                  key={item.question}
                  className="rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-slate-50 px-4 py-4 md:px-5"
                >
                  <h3 className="text-lg font-semibold text-slate-950">{item.question}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{item.answer}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <PublicBusinessIdentity
        title="Need help with a specific question?"
        intro="If your question is about a real payment, access issue, dispute, or verification check, use the public support details below so the team can review the exact case."
      />
    </PublicPageShell>
  );
}
