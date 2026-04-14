import PublicPageShell from "../components/PublicPageShell";
import PublicBusinessIdentity from "../components/PublicBusinessIdentity";

const cards = [
  {
    title: "Wallet top-ups",
    body:
      "Wallet top-ups are credited only after payment verification. If a payment fails or is not captured, the wallet should not be credited. If a verified credit appears incorrectly because of a provider or platform error, ShareVerse may adjust the wallet ledger after review.",
  },
  {
    title: "Sharing groups",
    body:
      "Once a member successfully joins an active sharing group and the host payout is released, refunds are generally handled only for platform error, duplicate charge, fraud, or another reason required by law or your final support policy.",
  },
  {
    title: "Buy-together groups",
    body:
      "Buy-together contributions are held before payout. If the group fails to complete purchase on time, the purchaser refunds members, or the platform detects a qualifying failure state, held funds can be returned to member wallets. Disputed access can pause payout until the issue is resolved.",
  },
  {
    title: "Disputes and manual review",
    body:
      "Members should report payment or access issues quickly and include enough detail for review. ShareVerse may request additional proof, pause wallet release, or deny a refund request when the facts do not support reversal under the platform policy.",
  },
];

export default function RefundPolicyPage() {
  return (
    <PublicPageShell
      eyebrow="Refund policy"
      title="How wallet credits, group joins, and buy-together refunds are handled."
      intro="This policy matches the core flows currently built into ShareVerse: verified wallet top-ups, held buy-together funds, member confirmations, and dispute pauses. Review it before launch to make sure it fits your final market and customer promise."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 md:p-6"
          >
            <h2 className="text-xl font-semibold text-slate-950">{card.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{card.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900 md:p-6">
        Refund timing depends on the payment provider, wallet status, and dispute review outcome. For launch, publish the expected turnaround clearly in your support process and align it with your payment partner settlement timelines.
      </div>

      <PublicBusinessIdentity title="Refund and support contact details" />
    </PublicPageShell>
  );
}
