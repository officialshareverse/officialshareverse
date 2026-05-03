import PublicBusinessIdentity from "../components/PublicBusinessIdentity";
import PublicPageShell from "../components/PublicPageShell";

const faqSections = [
  {
    title: "Using ShareVerse",
    items: [
      {
        question: "What is ShareVerse?",
        answer:
          "ShareVerse is a platform for coordinating shared-cost participation for provider-permitted digital plans, courses, memberships, software plans, and similar services. It helps people organize groups, track payments, chat with members, and manage the group flow in one place.",
      },
      {
        question: "How do I join a split?",
        answer:
          "Create an account, open a split you want to join, review the price and platform fee, and complete the wallet payment. After you join, you can track updates from My Splits and group chat.",
      },
      {
        question: "Do I need to share my own login credentials?",
        answer:
          "No. ShareVerse does not support listings that ask members to upload passwords, exchange account credentials, or send secret access details through the platform. Hosts should only coordinate access in provider-permitted ways and should never request member passwords.",
      },
      {
        question: "Can I create splits for courses, software, or memberships too?",
        answer:
          "Yes, if the underlying provider allows that arrangement. ShareVerse is designed for digital plans such as courses, memberships, software tools, and similar services where users want clearer shared-cost coordination, but high-risk or policy-breaking listings can be blocked or removed.",
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
    title: "Rules, safety, and compliance",
    items: [
      {
        question: "Is this legal?",
        answer:
          "ShareVerse is a software platform for coordinating shared-cost participation. Whether a specific listing is allowed depends on the provider's rules, the host's actual setup, and applicable law. Users are responsible for making sure their activity follows those requirements, and ShareVerse does not provide legal advice or guarantee that every provider permits every arrangement.",
      },
      {
        question: "Does ShareVerse guarantee that every provider allows shared access?",
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
