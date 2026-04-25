import { useNavigate } from "react-router-dom";

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

  return (
    <main className="sv-page">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="sv-card sv-reveal sv-referral-page-hero">
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

          <div className="sv-referral-page-actions">
            <button type="button" className="sv-btn-primary" onClick={() => navigate("/wallet")}>
              Back to wallet
            </button>
            <button type="button" className="sv-btn-secondary" onClick={() => navigate("/groups")}>
              Explore groups
            </button>
          </div>
        </section>

        <div className="sv-referral-page-grid">
          <ReferralDashboard />

          <div className="sv-referral-page-sidebar">
            <section className="sv-card sv-reveal sv-referral-guide-card">
              <p className="sv-eyebrow">How it works</p>
              <h2 className="sv-title mt-2">A simple referral flow</h2>
              <p className="sv-referral-page-subtitle">
                Share only with real people who are new to ShareVerse so the reward flow stays valid and review-ready.
              </p>

              <div className="sv-referral-steps">
                {REFERRAL_STEPS.map(({ icon: Icon, title, body }) => (
                  <article key={title} className="sv-referral-step">
                    <span className="sv-referral-step-icon" aria-hidden="true">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section className="sv-card sv-reveal sv-referral-terms-shell">
          <div className="sv-referral-terms-header">
            <div>
              <p className="sv-eyebrow">Terms and conditions</p>
              <h2 className="sv-title mt-2">Referral rewards are subject to review</h2>
            </div>
            <span className="sv-referral-terms-shield" aria-hidden="true">
              <ShieldIcon className="h-5 w-5" />
            </span>
          </div>

          <div className="sv-referral-terms-layout">
            <aside className="sv-referral-terms-summary">
              <p className="sv-referral-page-subtitle">
                By sharing your referral code or referral signup link, you agree to the following referral terms.
              </p>

              <div className="sv-referral-terms-highlights">
                {REFERRAL_TERMS_HIGHLIGHTS.map(({ title, body }) => (
                  <article key={title} className="sv-referral-terms-highlight">
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
            </aside>

            <ol className="sv-referral-terms-list">
              {REFERRAL_TERMS.map((term, index) => (
                <li key={term} className="sv-referral-terms-item">
                  <span className="sv-referral-terms-index">{index + 1}</span>
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
