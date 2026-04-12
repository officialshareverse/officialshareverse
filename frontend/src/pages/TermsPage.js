import PublicPageShell from "../components/PublicPageShell";

const sections = [
  {
    title: "1. Using ShareVerse",
    body:
      "ShareVerse helps members coordinate shared plans, buy-together groups, wallet-backed payments, and group communication. By using the platform, you agree to provide accurate account details and use the service only for lawful, policy-compliant participation.",
  },
  {
    title: "2. Accounts and security",
    body:
      "You are responsible for activity under your account, including safeguarding your password, keeping profile information current, and reporting unauthorized access quickly. We may suspend or restrict accounts that present fraud, abuse, or security risk.",
  },
  {
    title: "3. Groups, hosts, and members",
    body:
      "Hosts are responsible for accurate group listings, fair pricing, and timely coordination with members. Members are responsible for paying through the platform, following group rules, and using access only as allowed by the underlying provider and applicable law.",
  },
  {
    title: "4. Payments and wallet",
    body:
      "Wallet balances can be funded through supported payment providers and may be used to join groups or receive eligible payouts. Payment providers process card, UPI, and similar payment details directly. ShareVerse may delay, pause, or reverse wallet credits when fraud, chargebacks, disputes, or compliance reviews apply.",
  },
  {
    title: "5. Buy-together rules",
    body:
      "Buy-together groups collect member funds first. The purchaser must complete the purchase within the required time, share access off-platform where applicable, and upload proof when requested. Payouts may remain on hold until member confirmations are complete or until the configured confirmation window closes without disputes.",
  },
  {
    title: "6. Prohibited behavior",
    body:
      "You may not use ShareVerse for fraud, impersonation, payment abuse, credential theft, harassment, or any listing that knowingly violates provider restrictions or applicable law. We may remove groups, freeze wallet actions, or disable accounts when abuse is detected.",
  },
  {
    title: "7. Suspension, closure, and updates",
    body:
      "We may update the platform, these terms, supported payment flows, and group policies as ShareVerse evolves. Material changes should be reviewed with your legal counsel before launch. Continued use after updates means you accept the revised terms.",
  },
];

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Terms of service"
      title="Rules for using ShareVerse responsibly and safely."
      intro="These terms describe how members, hosts, and purchasers should use ShareVerse. They are a strong launch draft for your product, but you should still have them reviewed by a qualified lawyer before going fully public."
    >
      <div className="grid gap-4">
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
    </PublicPageShell>
  );
}
