import PublicPageShell from "../components/PublicPageShell";
import PublicBusinessIdentity from "../components/PublicBusinessIdentity";

const sections = [
  {
    title: "1. Scope and operator",
    body:
      "ShareVerse is a coordination and shared-cost platform. It helps hosts, members, and purchasers manage listings, wallet activity, chat, and confirmation flows for digital plans, memberships, courses, software tools, and buy-together purchases.",
    points: [
      "ShareVerse is not the provider of the underlying third-party service being listed.",
      "Using the platform means you accept these terms and the related privacy, refund, and support pages published on the site.",
      "You may use ShareVerse only for lawful activity and only for listings that comply with the underlying provider's rules.",
    ],
  },
  {
    title: "2. Accounts, eligibility, and security",
    body:
      "You are responsible for activity under your account, including safeguarding your password, keeping profile information current, and reporting unauthorized access quickly.",
    points: [
      "You must provide accurate identity, contact, and payment-related information when required.",
      "You may not create misleading duplicate accounts, impersonate another person, or allow another user to operate your account in a deceptive way.",
      "We may suspend or restrict accounts that present fraud, abuse, chargeback, or security risk.",
    ],
  },
  {
    title: "3. Host attestation and listing standards",
    body:
      "Hosts are responsible for accurate listings, fair pricing, and timely coordination with members. By publishing a listing, a host represents that the listing matches the real plan or purchase flow and that the host is authorized to coordinate it.",
    points: [
      "Hosts may publish only listings they are permitted to coordinate under the underlying provider's rules.",
      "Hosts must describe the plan type, member count, pricing, and timing honestly and must not make deceptive claims about access, household eligibility, or team rights.",
      "Hosts may be asked to provide invoices, receipts, screenshots, or other proof to support a listing or resolve a complaint.",
    ],
  },
  {
    title: "4. Member obligations and use restrictions",
    body:
      "Members are responsible for reviewing listings before joining, paying through the platform flow, and using any resulting access only as allowed by the underlying provider and applicable law.",
    points: [
      "Members must not ask other users for passwords, secret codes, or account credentials through ShareVerse.",
      "Members should report missing access, misleading listings, or payment issues promptly through the in-product flow or support channels.",
      "Members may not bypass platform safeguards by coordinating deceptive resale, abusive credential transfer, or off-platform payment evasion.",
    ],
  },
  {
    title: "5. Wallet, payments, and payouts",
    body:
      "Wallet balances can be funded through supported payment providers and may be used to join groups or receive eligible payouts. Payment providers process card, UPI, and similar payment details directly.",
    points: [
      "Wallet credits are created only after payment verification and may be delayed, paused, or reversed when fraud, chargebacks, disputes, or compliance reviews apply.",
      "Withdrawals may remain subject to manual review, document checks, or payout holds.",
      "ShareVerse may preserve ledger history, payout history, and dispute evidence even after a listing is closed.",
    ],
  },
  {
    title: "6. Buy-together and confirmation flows",
    body:
      "Buy-together groups collect member funds first. The purchaser must complete the purchase within the required time, deliver the listing as described, and upload proof when requested.",
    points: [
      "If the underlying provider does not permit the arrangement, the listing must not be created or continued.",
      "Payouts may remain on hold until member confirmations are complete or until the configured confirmation window closes without disputes.",
      "Access-confirmation steps, refund timing, and payout release may be paused if ShareVerse receives a complaint or needs additional proof.",
    ],
  },
  {
    title: "7. Prohibited listings and repeat abuse",
    body:
      "You may not use ShareVerse for fraud, impersonation, payment abuse, credential theft, credential-sharing requests, harassment, or any listing that knowingly violates provider restrictions or applicable law.",
    points: [
      "Listings that depend on prohibited password sharing, unauthorized resale, misleading household claims, or deceptive team-seat claims may be removed without notice.",
      "Repeat or serious abuse may lead to permanent suspension, payout holds, wallet freezes, and refusal of future access.",
      "We may preserve records and cooperate with payment-provider, platform, or lawful authority requests where required.",
    ],
  },
  {
    title: "8. Complaints, takedowns, and complaint handling",
    body:
      "ShareVerse may review complaints from providers, members, partners, or regulators about listings, payments, content, or account activity.",
    points: [
      "We may request proof, pause access-related flows, freeze payouts, remove listings, or suspend accounts while a complaint is reviewed.",
      "A complaint may result in interim action even before final resolution if payment risk, safety, IP, or provider-policy concerns are present.",
      "Users should respond truthfully and promptly to evidence requests made during a complaint review.",
    ],
  },
  {
    title: "9. Suspension, records, and updates",
    body:
      "We may update the platform, these terms, supported payment flows, and group policies as ShareVerse evolves.",
    points: [
      "Continued use after updates means you accept the revised terms.",
      "We may suspend or close access when a user presents fraud, abuse, compliance, or payment risk.",
      "Closing an account does not remove our right to retain payment, dispute, complaint, or security records where operationally or legally required.",
    ],
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
            {section.points ? (
              <ul className="mt-4 grid gap-2 text-sm leading-7 text-slate-600 md:text-base">
                {section.points.map((point) => (
                  <li key={point} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      <PublicBusinessIdentity title="Operator details for these terms" />
    </PublicPageShell>
  );
}
