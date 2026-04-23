import PublicPageShell from "../components/PublicPageShell";
import PublicBusinessIdentity from "../components/PublicBusinessIdentity";

const sections = [
  {
    title: "1. Using ShareVerse",
    body:
      "ShareVerse helps members coordinate shared-cost participation for digital plans such as courses, memberships, software tools, and buy-together purchases. By using the platform, you agree to provide accurate account details and use the service only for lawful activity and only for listings that comply with the underlying provider's rules.",
  },
  {
    title: "2. Accounts and security",
    body:
      "You are responsible for activity under your account, including safeguarding your password, keeping profile information current, and reporting unauthorized access quickly. We may suspend or restrict accounts that present fraud, abuse, or security risk.",
  },
  {
    title: "3. Groups, hosts, and members",
    body:
      "Hosts are responsible for accurate group listings, fair pricing, and timely coordination with members. Hosts may publish only listings they are authorized to coordinate under the underlying provider's rules. Members are responsible for paying through the platform, following group rules, and using any resulting access only as allowed by the underlying provider and applicable law. ShareVerse is a coordination tool, not a guarantee that a provider permits a specific arrangement.",
  },
  {
    title: "4. Payments and wallet",
    body:
      "Wallet balances can be funded through supported payment providers and may be used to join groups or receive eligible payouts. Payment providers process card, UPI, and similar payment details directly. ShareVerse may delay, pause, or reverse wallet credits when fraud, chargebacks, disputes, or compliance reviews apply.",
  },
  {
    title: "5. Buy-together rules",
    body:
      "Buy-together groups collect member funds first. The purchaser must complete the purchase within the required time, deliver the listing as described, and upload proof when requested. If the underlying provider does not permit the arrangement, the listing must not be created or continued. Payouts may remain on hold until member confirmations are complete or until the configured confirmation window closes without disputes.",
  },
  {
    title: "6. Prohibited behavior",
    body:
      "You may not use ShareVerse for fraud, impersonation, payment abuse, credential theft, credential-sharing requests, harassment, or any listing that knowingly violates provider restrictions or applicable law. We may remove groups, freeze wallet actions, disable accounts, or preserve records for review when abuse is detected.",
  },
  {
    title: "7. Provider complaints and enforcement",
    body:
      "ShareVerse may review complaints from providers, members, partners, or regulators about listings, payments, content, or account activity. We may request proof, pause access-related flows, freeze payouts, remove listings, or suspend accounts while a complaint is reviewed.",
  },
  {
    title: "8. Suspension, closure, and updates",
    body:
      "We may update the platform, these terms, supported payment flows, and group policies as ShareVerse evolves. Continued use after updates means you accept the revised terms. We may also suspend or close access when a user presents fraud, abuse, compliance, or payment risk.",
  },
];

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Terms of service"
      title="Rules for using ShareVerse responsibly and safely."
      intro="These terms describe how members, hosts, and purchasers should use ShareVerse as a coordination and shared-cost platform. They should be read together with the support, refund, and privacy pages published on the site."
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

      <PublicBusinessIdentity title="Operator details for these terms" />
    </PublicPageShell>
  );
}
