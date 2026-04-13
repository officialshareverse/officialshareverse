import PublicPageShell from "../components/PublicPageShell";

const sections = [
  {
    title: "Digital-only platform",
    body:
      "ShareVerse is a digital platform. We do not sell or ship physical goods. Access, communication, group coordination, notifications, and member updates are delivered online through the website, email, and in-product flows.",
  },
  {
    title: "How delivery works",
    body:
      "After signup, members can access their account, groups, chats, and profile tools immediately through the ShareVerse website. When a group flow requires host coordination, access updates are handled digitally through the platform and direct member communication, not through courier or postal delivery.",
  },
  {
    title: "Timing expectations",
    body:
      "Digital access timing depends on the specific product flow. Account creation is immediate after successful signup. Group joins, confirmations, proof review, and access coordination depend on host actions, member confirmations, and the applicable group rules shown on the platform.",
  },
  {
    title: "No physical shipping charges",
    body:
      "Because ShareVerse does not ship physical products, there are no shipping fees, logistics charges, or delivery partners involved in normal platform use. Any platform fees, group contributions, or wallet transactions are separate from shipping and are governed by the applicable pricing and refund policies.",
  },
];

export default function ShippingPolicyPage() {
  return (
    <PublicPageShell
      eyebrow="Shipping policy"
      title="ShareVerse delivers digital access and coordination only."
      intro="This shipping policy explains that ShareVerse does not ship physical products. It exists to clarify digital delivery for members, payment partners, and compliance reviewers."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 md:p-6"
          >
            <h2 className="text-xl font-semibold text-slate-950">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{section.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-900 md:p-6">
        If a payment partner or reviewer needs a plain-language summary: ShareVerse is a web-based service, all delivery is digital, and no physical order fulfillment is involved.
      </div>
    </PublicPageShell>
  );
}
