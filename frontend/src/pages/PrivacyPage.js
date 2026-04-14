import PublicPageShell from "../components/PublicPageShell";
import PublicBusinessIdentity from "../components/PublicBusinessIdentity";

const sections = [
  {
    title: "Information we collect",
    body:
      "ShareVerse collects information you provide directly, such as your name, username, email, phone number, group activity, messages, ratings, and wallet-related actions. We also collect technical information needed to secure the service and investigate abuse.",
  },
  {
    title: "How we use information",
    body:
      "We use your information to create accounts, power groups and wallet activity, process support requests, prevent fraud, improve product reliability, and send important transactional notices such as purchase-proof requests, access confirmations, disputes, and payment updates.",
  },
  {
    title: "Payments and third parties",
    body:
      "Payment data needed to complete wallet top-ups is handled by our payment provider. ShareVerse stores the minimum information needed to track payment status, verify credits, respond to disputes, and keep wallet ledgers accurate. We do not ask the frontend to store secret payment credentials.",
  },
  {
    title: "Security and retention",
    body:
      "We use account authentication, encrypted credential storage where applicable, OTP reset controls, and payment verification checks to protect user activity. We retain records for operational, fraud-prevention, dispute, and legal-compliance needs for as long as reasonably necessary.",
  },
  {
    title: "Your choices",
    body:
      "You can update profile details inside your account and contact support for help with account access, correction requests, or other privacy questions. Before launch, you should review this policy against the privacy laws that apply to your launch market.",
  },
];

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy policy"
      title="How ShareVerse collects, uses, and protects member information."
      intro="This page explains the main data flows in your product as it exists today: accounts, wallet activity, chats, proof uploads, and support handling. It is a launch-friendly foundation, but it should still be reviewed for your final jurisdiction and compliance posture."
    >
      <div className="grid gap-4">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6"
          >
            <h2 className="text-xl font-semibold text-slate-950">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{section.body}</p>
          </article>
        ))}
      </div>

      <PublicBusinessIdentity title="Who to contact about privacy questions" />
    </PublicPageShell>
  );
}
