import PublicBusinessIdentity, {
  BUSINESS_OPERATOR_NAME,
  COMPLIANCE_EMAIL,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from "../components/PublicBusinessIdentity";
import PublicPageShell from "../components/PublicPageShell";

const contactCards = [
  {
    title: "General support",
    detail: SUPPORT_EMAIL,
    helper: "Use this inbox for account help, refunds, payment issues, and general support requests.",
  },
  {
    title: "Compliance and grievance",
    detail: COMPLIANCE_EMAIL,
    helper: "Use this address for formal complaints, provider-rule concerns, payment verification, or unresolved support escalations.",
  },
  {
    title: "Provider or IP complaint",
    detail: SUPPORT_EMAIL,
    helper: "Send the listing name, usernames, screenshots, and a short explanation of the policy or rights issue so the team can review it quickly.",
  },
  {
    title: "Phone support",
    detail: SUPPORT_PHONE,
    helper: "Use this number for urgent contact, onboarding follow-ups, and verification requests during business hours.",
  },
  {
    title: "Operator",
    detail: BUSINESS_OPERATOR_NAME,
    helper: "Use this name when a payment provider, partner, or verification team asks who operates ShareVerse.",
  },
  {
    title: "Expected response",
    detail: "Within 1-2 business days",
    helper: "Urgent payment-risk or provider-complaint cases should be raised with supporting details so they can be prioritized.",
  },
];

const faqItems = [
  {
    question: "What should a member include in a support request?",
    answer:
      "Include the group name, username, payment date, issue summary, and any proof such as payment reference or access screenshots. This helps resolve wallet and group issues faster.",
  },
  {
    question: "Where should payment issues be reported?",
    answer:
      "Wallet-credit problems, duplicate top-ups, and withdrawal concerns should go to support. Buy-together access issues should also be reported inside the group flow so the platform can pause payout immediately.",
  },
  {
    question: "How do provider or policy complaints work?",
    answer:
      "ShareVerse can review the listing, preserve the activity trail, request proof, pause sensitive flows, and remove or restrict content while the complaint is reviewed. Next actions depend on whether the issue is a payment failure, missing access, misleading listing, or policy breach.",
  },
];

export default function SupportPage() {
  return (
    <PublicPageShell
      eyebrow="Support"
      title="How members can reach ShareVerse and get issues resolved."
      intro="This page gives members, providers, partners, and verification teams one clear place to find help for accounts, wallet payments, group access, disputes, policy questions, and formal complaints."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {contactCards.map((card) => (
          <article
            key={card.title}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {card.title}
            </p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">{card.detail}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{card.helper}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5 md:p-6">
        <h2 className="text-2xl font-semibold text-slate-950">Before contacting support</h2>
        <ul className="mt-4 grid gap-3 text-sm leading-7 text-slate-600">
          <li>Check your wallet page for payment and balance history.</li>
          <li>Use the group chat for normal coordination with hosts and members.</li>
          <li>Use the in-product access issue action for buy-together problems so payout pauses automatically.</li>
          <li>Include screenshots, payment reference, usernames, and timing details when something fails.</li>
          <li>For provider or IP complaints, include the listing name and a short explanation of the rule or rights issue.</li>
        </ul>
      </div>

      <PublicBusinessIdentity
        title="Public contact summary"
        intro="Use the same operator, address, and contact details for support, provider review, compliance notices, and payment verification."
      />

      <div className="mt-6 grid gap-4">
        {faqItems.map((item) => (
          <article
            key={item.question}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6"
          >
            <h3 className="text-lg font-semibold text-slate-950">{item.question}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{item.answer}</p>
          </article>
        ))}
      </div>
    </PublicPageShell>
  );
}
