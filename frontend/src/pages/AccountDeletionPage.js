import PublicPageShell from "../components/PublicPageShell";
import PublicBusinessIdentity, { SUPPORT_EMAIL } from "../components/PublicBusinessIdentity";

const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=ShareVerse%20account%20deletion%20request&body=Please%20delete%20or%20anonymize%20my%20ShareVerse%20account.%0A%0AUsername%3A%20%0AAccount%20email%3A%20%0ARegistered%20phone%20(optional)%3A%20%0AReason%20(optional)%3A%20`;

const requestSteps = [
  "Use Profile > Account deletion in the ShareVerse mobile app if you can sign in.",
  `If you cannot access the app, email ${SUPPORT_EMAIL} from the email linked to your ShareVerse account.`,
  "Include your username, account email, registered phone number if available, and a short deletion request.",
  "ShareVerse support verifies ownership before deleting or anonymizing account data.",
];

const deletedData = [
  "Profile fields that are no longer required, such as name, phone, profile picture, and account identifiers.",
  "Inactive app session and device records where they are no longer needed for security.",
  "Non-essential support, notification, and preference data after the request is completed.",
];

const retainedData = [
  "Wallet, payout, refund, transaction, tax, and accounting records where retention is required.",
  "Fraud-prevention, chargeback, dispute, complaint, security, and legal records while they remain necessary.",
  "Group records that must stay available to other members, with personal identifiers removed or minimized where possible.",
];

export default function AccountDeletionPage() {
  return (
    <PublicPageShell
      eyebrow="Account deletion"
      title="Request deletion of your ShareVerse account."
      intro="ShareVerse lets users request account deletion from inside the mobile app or through this public web page. Requests are reviewed so payment, wallet, payout, dispute, and legal records are handled correctly."
    >
      <div className="grid gap-4">
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-slate-950">How to request deletion</h2>
          <ol className="mt-4 grid gap-2 text-sm leading-7 text-slate-600 md:text-base">
            {requestSteps.map((step, index) => (
              <li key={step} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="font-semibold text-slate-900">{index + 1}. </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={mailtoHref} className="sv-btn-primary justify-center px-5 py-3">
              Email deletion request
            </a>
            <a href="/privacy" className="sv-btn-secondary justify-center px-5 py-3">
              Read privacy policy
            </a>
          </div>
        </article>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 md:p-6">
            <h2 className="text-xl font-semibold text-emerald-950">Data deleted or anonymized</h2>
            <ul className="mt-4 grid gap-2 text-sm leading-7 text-emerald-950 md:text-base">
              {deletedData.map((item) => (
                <li key={item} className="rounded-[18px] border border-emerald-200 bg-white/70 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 md:p-6">
            <h2 className="text-xl font-semibold text-amber-950">Records that may be retained</h2>
            <ul className="mt-4 grid gap-2 text-sm leading-7 text-amber-950 md:text-base">
              {retainedData.map((item) => (
                <li key={item} className="rounded-[18px] border border-amber-200 bg-white/70 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600 md:p-6 md:text-base">
          ShareVerse normally acknowledges account deletion requests within 5 business days and aims to complete eligible deletion or anonymization within 30 days after ownership verification, subject to lawful retention needs.
        </div>
      </div>

      <PublicBusinessIdentity title="Account deletion contact" />
    </PublicPageShell>
  );
}
