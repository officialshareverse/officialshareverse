import PublicPageShell from "../components/PublicPageShell";
import {
  BUSINESS_OPERATOR_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from "../components/PublicBusinessIdentity";

const aboutHighlights = [
  {
    title: "What ShareVerse does",
    body:
      "ShareVerse is a technology platform for coordinating shared payments, participation, and communication for subscriptions, courses, memberships, software plans, and similar digital services.",
  },
  {
    title: "How the platform is used",
    body:
      "Users can create groups, join groups, track participation, coordinate through group chat, and manage contribution-related activity in one place with clearer status updates and group accountability.",
  },
  {
    title: "Operator details",
    body:
      `ShareVerse is operated by ${BUSINESS_OPERATOR_NAME} and is currently managed as an independent online business based in Maharashtra, India.`,
  },
];

export default function AboutPage() {
  return (
    <PublicPageShell
      eyebrow="About us"
      title="What ShareVerse is and who operates it."
      intro="This page gives users, payment providers, and partners a simple overview of the ShareVerse platform and the public contact details behind it."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {aboutHighlights.map((item) => (
          <article
            key={item.title}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6"
          >
            <h2 className="text-xl font-semibold text-slate-950">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{item.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Public contact details
        </p>
        <div className="mt-4 space-y-2 text-sm leading-7 text-slate-600 md:text-base">
          <p>
            <span className="font-semibold text-slate-900">Operator:</span> {BUSINESS_OPERATOR_NAME}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Email:</span> {SUPPORT_EMAIL}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Phone:</span> {SUPPORT_PHONE}
          </p>
          <p className="text-sm text-slate-500">
            Registered address is shared only during verification or formal compliance review when required.
          </p>
        </div>
      </div>
    </PublicPageShell>
  );
}
