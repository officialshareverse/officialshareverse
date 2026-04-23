import PublicPageShell from "../components/PublicPageShell";
import PublicBusinessIdentity from "../components/PublicBusinessIdentity";

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
    title: "1. Raise the issue fast",
    body: "Use support or the in-product issue flow as soon as possible. Include the listing name, username, amount, date, and screenshots or payment reference.",
  },
  {
    title: "2. Initial review",
    body: "ShareVerse normally acknowledges refund-sensitive issues within 1 business day and may ask for more proof before deciding how to proceed.",
  },
  {
    title: "3. Interim action",
    body: "During review, the platform may hold payout, freeze a withdrawal, pause a listing, or keep funds in wallet balance until the facts are clearer.",
  },
  {
    title: "4. Refund destination",
    body: "Approved corrections are usually returned to ShareVerse wallet balance first. Refunds to the original payment method may be used where required by law, payment-provider rules, or where a top-up never became a valid wallet credit.",
  },
];

export default function RefundPolicyPage() {
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
            className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 md:p-6"
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
        {timelineItems.map((item) => (
          <article
            key={item.title}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6"
          >
            <h2 className="text-xl font-semibold text-slate-950">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{item.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900 md:p-6">
        Refund timing still depends on payment-provider settlement, wallet status, evidence quality, and whether fraud or provider-policy review is open. ShareVerse may pause refunds or payouts while a complaint is being investigated.
      </div>

      <PublicBusinessIdentity title="Refund and support contact details" />
    </PublicPageShell>
  );
}
