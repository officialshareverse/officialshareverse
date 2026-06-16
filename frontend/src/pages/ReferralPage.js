import { useNavigate } from "react-router-dom";
import useIsMobile from "../hooks/useIsMobile";

import ReferralDashboard from "../components/ReferralDashboard";
import {
  CheckCircleIcon,
  ShieldIcon,
  SparkIcon,
  WalletIcon,
} from "../components/UiIcons";

const REFERRAL_STEPS = [
  {
    icon: SparkIcon,
    title: "Share your code or signup link",
    body: "Open your dashboard below, copy your referral code, or send the signup link to friends who are new to ShareVerse.",
  },
  {
    icon: CheckCircleIcon,
    title: "Your friend signs up and joins",
    body: "A referral becomes successful after the invited user signs up with your code and completes their first eligible group join with a join subtotal of at least Rs 150.",
  },
  {
    icon: WalletIcon,
    title: "Rewards land in both wallets",
    body: "When that first valid join is completed at Rs 150 or more, the inviter earns Rs 25 and the invitee earns Rs 10 as bonus credit that can only be used to join groups.",
  },
];

const REFERRAL_TERMS = [
  "Referral rewards apply only when a new user signs up with a valid referral code or referral signup link and completes their first eligible group join on ShareVerse with a join subtotal of at least Rs 150.",
  "The inviter reward is Rs 25 and the invitee reward is Rs 10 for each successful first join, unless ShareVerse announces a different promotional amount on an official page.",
  "Only one referral reward is available per referred user. Repeat joins, duplicate accounts, or repeat claims for the same person are not eligible.",
  "Self-referrals, fake accounts, misleading promotion, or any fraudulent or abusive activity can result in the referral being rejected, reversed, or removed from wallet balances.",
  "Rewards are issued as non-withdrawable bonus credit and can be used only for joining eligible groups on ShareVerse.",
  "If a referred signup is cancelled, refunded, reversed, banned, or found to violate ShareVerse policies, ShareVerse may withhold or reverse related referral rewards.",
  "Referral rewards may take time to appear while account activity and the first joined group are verified.",
  "ShareVerse may update, pause, or end the referral program at any time. Continued use of referral links or codes means you agree to the latest referral terms.",
];

const REFERRAL_TERMS_HIGHLIGHTS = [
  {
    title: "Qualifying join",
    body: "Only the referred user's first eligible group join counts, and the subtotal must be at least Rs 150.",
  },
  {
    title: "Reward format",
    body: "Referral earnings are released as non-withdrawable bonus credit that can only be used for joining groups.",
  },
  {
    title: "Review protection",
    body: "Fraud checks, reversals, refunds, and policy violations can pause or remove a referral reward.",
  },
];

export default function ReferralPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <main className={isMobile ? "sv-mobile-bg min-h-screen bg-slate-50" : "sv-page"}>
      <div className={isMobile ? "flex flex-col" : "mx-auto flex w-full max-w-7xl flex-col gap-6"}>
        <section className={isMobile ? "bg-teal-600 px-4 pt-8 pb-[88px] relative overflow-hidden text-white" : "sv-card sv-reveal sv-referral-page-hero"}>
          {isMobile ? (
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-teal-200 text-[10px] font-extrabold uppercase tracking-widest">Referral Program</p>
                <button type="button" onClick={() => navigate("/wallet")} className="bg-teal-700/50 text-white text-[11px] font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform">
                  Back
                </button>
              </div>
              <h1 className="text-[28px] font-black leading-[1.1] mb-3 text-white">Earn Rs 25 for every new friend.</h1>
              <p className="text-teal-50 text-[13px] leading-relaxed opacity-90 mb-5">
                Share your code. They get Rs 10, you get Rs 25 when they join a group of Rs 150+.
              </p>
            </div>
          ) : (
            <div className="sv-referral-page-hero-copy">
              <div>
                <p className="sv-eyebrow">Referral program</p>
                <h1 className="sv-title mt-2">Give friends a cleaner signup path and earn join-only bonus credit.</h1>
                <p className="sv-referral-page-subtitle">
                  This page keeps your referral code, shareable signup link, reward tracking, and referral rules in one place.
                </p>

                <div className="sv-referral-page-chips">
                  <span className="sv-chip">Rs 25 for inviter</span>
                  <span className="sv-chip">Rs 10 for invitee</span>
                  <span className="sv-chip">Minimum qualifying join subtotal: Rs 150</span>
                  <span className="sv-chip">Bonus credit cannot be withdrawn</span>
                </div>
              </div>
            </div>
          )}

          {!isMobile && (
            <div className="sv-referral-page-actions">
              <button type="button" className="sv-btn-primary" onClick={() => navigate("/wallet")}>
                Back to wallet
              </button>
              <button type="button" className="sv-btn-secondary" onClick={() => navigate("/groups")}>
                Explore groups
              </button>
            </div>
          )}
        </section>

        <div className={isMobile ? "px-3 space-y-4 -mt-[64px] relative z-20 pb-8" : "sv-referral-page-grid"}>
          <ReferralDashboard />

          <div className="sv-referral-page-sidebar">
            <section className={isMobile ? "bg-white rounded-[32px] p-6 shadow-sm border border-slate-100" : "sv-card sv-reveal sv-referral-guide-card"}>
              <p className={isMobile ? "text-teal-600 text-[10px] font-extrabold uppercase tracking-widest mb-1" : "sv-eyebrow"}>How it works</p>
              <h2 className={isMobile ? "text-[20px] font-black text-slate-900 mb-2 leading-tight" : "sv-title mt-2"}>A simple referral flow</h2>
              <p className={isMobile ? "text-slate-500 text-[13px] leading-relaxed mb-6" : "sv-referral-page-subtitle"}>
                Share only with real people who are new to ShareVerse so the reward flow stays valid and review-ready.
              </p>

              <div className={isMobile ? "space-y-6 relative before:absolute before:inset-y-0 before:left-[17px] before:w-[2px] before:bg-slate-100" : "sv-referral-steps"}>
                {REFERRAL_STEPS.map(({ icon: Icon, title, body }, index) => (
                  <article key={title} className={isMobile ? "flex gap-4 relative" : "sv-referral-step"}>
                    <span className={isMobile ? "h-9 w-9 shrink-0 rounded-full bg-teal-50 border-4 border-white flex items-center justify-center text-teal-600 relative z-10" : "sv-referral-step-icon"} aria-hidden="true">
                      <Icon className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
                    </span>
                    <div className={isMobile ? "pt-1" : ""}>
                      <h3 className={isMobile ? "text-[14px] font-bold text-slate-900 mb-1" : ""}>{title}</h3>
                      <p className={isMobile ? "text-slate-500 text-[13px] leading-relaxed" : ""}>{body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section className={isMobile ? "px-4 pb-12" : "sv-card sv-reveal sv-referral-terms-shell"}>
          <div className={isMobile ? "mb-5" : "sv-referral-terms-header"}>
            <div>
              <p className={isMobile ? "text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1" : "sv-eyebrow"}>Terms and conditions</p>
              <h2 className={isMobile ? "text-[16px] font-bold text-slate-700 flex items-center gap-2" : "sv-title mt-2"}>
                Subject to review
                {isMobile && <ShieldIcon className="h-4 w-4 text-slate-400" />}
              </h2>
            </div>
            {!isMobile && (
              <span className="sv-referral-terms-shield" aria-hidden="true">
                <ShieldIcon className="h-5 w-5" />
              </span>
            )}
          </div>

          <div className={isMobile ? "space-y-6" : "sv-referral-terms-layout"}>
            <aside className={isMobile ? "" : "sv-referral-terms-summary"}>
              <p className={isMobile ? "text-slate-500 text-[12px] mb-4" : "sv-referral-page-subtitle"}>
                By sharing your referral code or referral signup link, you agree to the following referral terms.
              </p>

              <div className={isMobile ? "space-y-3" : "sv-referral-terms-highlights"}>
                {REFERRAL_TERMS_HIGHLIGHTS.map(({ title, body }) => (
                  <article key={title} className={isMobile ? "bg-slate-200/50 rounded-[20px] p-4 border border-slate-100" : "sv-referral-terms-highlight"}>
                    <h3 className={isMobile ? "text-[13px] font-bold text-slate-700 mb-1" : ""}>{title}</h3>
                    <p className={isMobile ? "text-slate-500 text-[12px] leading-relaxed" : ""}>{body}</p>
                  </article>
                ))}
              </div>
            </aside>

            <ol className={isMobile ? "space-y-3 mt-6 pl-0 list-none" : "sv-referral-terms-list"}>
              {REFERRAL_TERMS.map((term, index) => (
                <li key={term} className={isMobile ? "flex gap-3 text-slate-400 text-[11px] leading-relaxed" : "sv-referral-terms-item"}>
                  <span className={isMobile ? "font-bold text-slate-300 mt-0.5" : "sv-referral-terms-index"}>{index + 1}</span>
                  <span>{term}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
