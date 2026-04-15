import PublicBusinessIdentity from "../components/PublicBusinessIdentity";
import PublicPageShell from "../components/PublicPageShell";

const faqSections = [
  {
    title: "Using ShareVerse",
    items: [
      {
        question: "What is ShareVerse?",
        answer:
          "ShareVerse is a platform for coordinating shared-cost participation for subscriptions, courses, memberships, software plans, and similar digital services. It helps people organize splits, track payments, chat with members, and manage the group flow in one place.",
      },
      {
        question: "How do I join a split?",
        answer:
          "Create an account, open a split you want to join, review the price and platform fee, and complete the wallet payment. After you join, you can track updates from My Splits and group chat.",
      },
      {
        question: "Do I need to share my own login credentials?",
        answer:
          "No. Members should not have to upload their own service passwords to join a split. Hosts coordinate access separately, and platform pages focus on participation, payment, and status updates.",
      },
      {
        question: "Can I create splits for courses, software, or memberships too?",
        answer:
          "Yes. ShareVerse is not limited to streaming plans. It is designed for digital plans such as courses, memberships, software tools, and similar services where users want clearer shared-cost coordination.",
      },
    ],
  },
  {
    title: "Payments and withdrawals",
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
          "Withdrawals are currently handled through a manual review flow. You can submit a request from the wallet page, and approved withdrawals are typically processed within 24 hours.",
      },
      {
        question: "What happens if there is a payment issue?",
        answer:
          "If a wallet credit, duplicate charge, or payout issue looks wrong, contact support with your username, amount, payment reference, and screenshots. The support team uses that trail to review and resolve the case.",
      },
    ],
  },
  {
    title: "Rules, safety, and compliance",
    items: [
      {
        question: "Is this legal?",
        answer:
          "ShareVerse is a software platform for coordinating shared-cost participation, but whether a particular split is allowed depends on the provider's terms, the host's usage, and applicable law. Users are responsible for making sure their activity follows the rules of the underlying service and local requirements. ShareVerse does not provide legal advice.",
      },
      {
        question: "Does ShareVerse guarantee that every provider allows shared access?",
        answer:
          "No. Different providers have different policies. Some services may allow household or team sharing, while others may restrict transfer, resale, or shared use. Hosts and members should check the provider's rules before participating.",
      },
      {
        question: "What if a host or member misuses a split?",
        answer:
          "The platform can review reports, pause sensitive flows, preserve transaction history, and remove users or content that appears misleading, abusive, or against platform rules. Members should report serious issues through support or the in-product issue flow.",
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
  return (
    <PublicPageShell
      eyebrow="Questions and answers"
      title="Common ShareVerse questions, answered clearly."
      intro="This page gives members, hosts, and verification teams a quick explanation of how ShareVerse works, how payments are handled, and how the platform thinks about safety, policy, and support."
    >
      <div className="grid gap-6">
        {faqSections.map((section) => (
          <section
            key={section.title}
            className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6"
          >
            <h2 className="text-2xl font-semibold text-slate-950">{section.title}</h2>
            <div className="mt-5 grid gap-4">
              {section.items.map((item) => (
                <article
                  key={item.question}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 md:px-5"
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
