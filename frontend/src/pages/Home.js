import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return `Rs ${numeric.toFixed(2)}`;
}

function getModeLabel(mode) {
  return mode === "group_buy" ? "Buy together" : "Sharing";
}

export default function Home() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      try {
        const [groupsRes, dashboardRes] = await Promise.all([
          API.get("groups/"),
          API.get("dashboard/"),
        ]);

        if (!isMounted) {
          return;
        }

        setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
        setDashboard(dashboardRes.data || null);
      } catch (err) {
        console.error("Home load error:", err);
        if (isMounted) {
          setError("We could not load your latest activity, but you can still explore the platform.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  const ownerSummary = dashboard?.owner_summary || {};
  const notifications = Array.isArray(dashboard?.notifications) ? dashboard.notifications : [];
  const memberships = Array.isArray(dashboard?.groups) ? dashboard.groups : [];
  const unreadNotifications = notifications.filter((item) => !item.is_read).length;
  const membershipNeedsAttention = memberships.filter(
    (group) => group.access_confirmation_required || group.has_reported_access_issue
  ).length;

  const primaryCard = useMemo(() => {
    if (ownerSummary.buy_together_waiting > 0) {
      return {
        label: "Action waiting",
        title: "One of your buy-together groups is ready for the next step.",
        body: "Open My Groups to upload proof, coordinate access, or move payout forward.",
        cta: "Open My Groups",
        onClick: () => navigate("/my-shared"),
      };
    }

    if (membershipNeedsAttention > 0) {
      return {
        label: "Member follow-up",
        title: "A joined group needs your response.",
        body: "Confirm access or review the latest issue update from your memberships.",
        cta: "Review My Groups",
        onClick: () => navigate("/my-shared"),
      };
    }

    if (groups.length > 0) {
      return {
        label: "Explore now",
        title: "Open groups are ready to browse.",
        body: "See active cost-splitting groups and buy-together groups before you decide where to join.",
        cta: "Browse Groups",
        onClick: () => navigate("/groups"),
      };
    }

    return {
      label: "Get started",
      title: "Create your first group on ShareVerse.",
      body: "Start with a digital plan you already manage or open a buy-together group and invite members.",
      cta: "Create Group",
      onClick: () => navigate("/create"),
    };
  }, [groups.length, membershipNeedsAttention, navigate, ownerSummary.buy_together_waiting]);

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center text-slate-600 shadow-sm">
          Loading home...
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl space-y-6">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="sv-light-hero">
            <p className="sv-eyebrow">Home</p>
            <h1 className="sv-display mt-4 max-w-3xl">
              ShareVerse helps people split the cost of digital plans and buy together with less friction.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
              Coordinate shared costs for a subscription, course, membership, or software plan you already manage, or create a buy-together group that fills
              before the purchase happens. Wallet balance, member confirmations, group chat, and
              notifications stay connected in one flow.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <PrimaryButton onClick={() => navigate("/groups")}>Browse groups</PrimaryButton>
              <SecondaryButton onClick={() => navigate("/create")}>Create group</SecondaryButton>
              <SecondaryButton onClick={() => navigate("/my-shared")}>My groups</SecondaryButton>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <MiniTag>Split existing plan costs</MiniTag>
              <MiniTag>Buy together with a group</MiniTag>
              <MiniTag>Digital plan coordination</MiniTag>
              <MiniTag>Chat and confirmations</MiniTag>
            </div>
          </div>

          <aside className="sv-card">
            <p className="sv-eyebrow">Your snapshot</p>
            <div className="mt-4 space-y-3">
              <SummaryRow label="Wallet balance" value={formatCurrency(dashboard?.wallet_balance)} />
              <SummaryRow label="Groups joined" value={dashboard?.groups_joined || 0} />
              <SummaryRow label="Groups created" value={ownerSummary.total_groups_created || 0} />
              <SummaryRow label="Unread updates" value={unreadNotifications} />
            </div>

            <div className="mt-6 rounded-[28px] bg-[linear-gradient(135deg,#0f172a_0%,#132033_55%,#0f766e_100%)] p-5 text-white shadow-[0_20px_44px_rgba(15,23,42,0.18)]">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-300">{primaryCard.label}</p>
              <h2 className="mt-3 text-2xl font-bold leading-tight md:text-[1.85rem]">
                {primaryCard.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{primaryCard.body}</p>
              <button
                onClick={primaryCard.onClick}
                className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                {primaryCard.cta}
              </button>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <ExplainCard
            eyebrow="Existing plans"
            title="Open a plan, course, or tool you already manage"
            body="Create a cost-splitting group, set the number of spots, and let members join with clear participation terms. Access stays coordinated privately by the owner."
          />
          <ExplainCard
            eyebrow="Buy together"
            title="Fill the group first, then complete the purchase"
            body="Members join the group, funds are held, and the purchase moves forward only after the group is full and access is confirmed."
          />
          <ExplainCard
            eyebrow="Support"
            title="Keep everything organized in one place"
            body="Chat with group members, track notifications, review confirmations, and manage wallet activity without leaving the platform."
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <FlowCard
            eyebrow="How existing-plan groups work"
            title="For plans, courses, tools, or memberships that already exist"
            steps={[
              "Create a group for the digital plan you already manage.",
              "Members join available spots and pay from their wallet.",
              "You coordinate participation privately and keep the group active from My Groups.",
            ]}
          />
          <FlowCard
            eyebrow="How buy together works"
            title="For digital plans the group wants to activate together"
            steps={[
              "Create a buy-together group with the required number of members.",
              "Members join first and funds stay held until the group is full.",
              "The purchaser completes the plan, coordinates access off-platform, and payout releases after confirmations.",
            ]}
          />
        </section>

        <section className="sv-card">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Open groups</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">A simple preview of what is active now</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Use Browse Groups to search and join. Home keeps this preview lightweight on purpose.
              </p>
            </div>

            <SecondaryButton onClick={() => navigate("/groups")}>Browse all groups</SecondaryButton>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {groups.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600 md:col-span-3">
                No open groups are live right now. You can create the first one from the Create Group page.
              </div>
            ) : (
              groups.slice(0, 3).map((group) => (
                <PreviewCard
                  key={group.id}
                  subscriptionName={group.subscription_name}
                  ownerName={group.owner_name}
                  modeLabel={getModeLabel(group.mode)}
                  joinPrice={group.join_price}
                  pricePerSlot={group.price_per_slot}
                  isProrated={group.is_prorated}
                  seats={`${group.filled_slots}/${group.total_slots}`}
                  statusLabel={group.status_label}
                  pricingNote={group.pricing_note}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="sv-btn-primary"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="sv-btn-secondary"
    >
      {children}
    </button>
  );
}

function MiniTag({ children }) {
  return (
    <span className="sv-chip normal-case tracking-[0.04em]">
      {children}
    </span>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ExplainCard({ eyebrow, title, body }) {
  return (
    <article className="sv-card-solid">
      <p className="sv-eyebrow">{eyebrow}</p>
      <h2 className="sv-title mt-3">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
    </article>
  );
}

function FlowCard({ eyebrow, title, steps }) {
  return (
    <section className="sv-card">
      <p className="sv-eyebrow">{eyebrow}</p>
      <h2 className="sv-title mt-2">
        {title}
      </h2>
      <div className="mt-5 space-y-4">
        {steps.map((step, index) => (
          <div key={step} className="flex items-start gap-4 rounded-2xl bg-slate-50 px-4 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {index + 1}
            </div>
            <p className="text-sm leading-7 text-slate-700">{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PreviewCard({
  subscriptionName,
  ownerName,
  modeLabel,
  joinPrice,
  pricePerSlot,
  isProrated,
  seats,
  statusLabel,
  pricingNote,
}) {
  const priceToShow = isProrated ? joinPrice : pricePerSlot;

  return (
    <article className="sv-soft-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{subscriptionName}</h3>
          <p className="mt-1 text-sm text-slate-500">Hosted by {ownerName}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {modeLabel}
        </span>
      </div>

      <div className="mt-5 space-y-2">
        <SummaryRow label={isProrated ? "Current join price" : "Price per member"} value={formatCurrency(priceToShow)} />
        <SummaryRow label="Seats filled" value={seats} />
        <SummaryRow label="Stage" value={statusLabel} />
      </div>

      {pricingNote ? <p className="mt-4 text-xs leading-6 text-emerald-700">{pricingNote}</p> : null}
    </article>
  );
}
