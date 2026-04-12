import PublicPageShell from "../components/PublicPageShell";

const contactCards = [
  {
    title: "General support",
    detail: "support@shareverse.in",
    helper: "Use this inbox for account help, refunds, payment issues, and launch support requests.",
  },
  {
    title: "Urgent access problem",
    detail: "Report from My Groups first",
    helper: "Buy-together access issues should be reported inside the group flow so payout pauses automatically.",
  },
  {
    title: "Expected response",
    detail: "Within 1-2 business days",
    helper: "For launch, keep this aligned with your actual team capacity and published hours.",
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
    question: "What happens after a dispute is raised?",
    answer:
      "The platform can pause payout, preserve the activity trail, and review payment or access evidence. Next actions depend on whether the issue is a payment failure, missing access, listing problem, or policy breach.",
  },
];

export default function SupportPage() {
  return (
    <PublicPageShell
      eyebrow="Support"
      title="How members can reach ShareVerse and get issues resolved."
      intro="Support is part of launch readiness. This page gives members one clear place to find help for accounts, wallet payments, group access, disputes, and policy questions."
    >
      <div className="grid gap-4 md:grid-cols-3">
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
          <li>Include screenshots, payment reference, and timing details when something fails.</li>
        </ul>
      </div>

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
