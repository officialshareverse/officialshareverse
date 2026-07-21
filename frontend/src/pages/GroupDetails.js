import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { getPaginatedItems } from "../api/pagination";
import SubscriptionLogo from "../components/SubscriptionLogo";
import { useToast } from "../components/ToastProvider";
import {
  CheckCircleIcon,
  ClockIcon,
  LoadingSpinner,
  ShieldIcon,
  StarIcon,
  WalletIcon,
} from "../components/UiIcons";
import {
  getPlanMeta,
  formatCurrency,
  formatDate,
  getInitials,
  formatHostDisplayName,
  buildHostReputation,
} from "../utils/groupHelpers";
import { trackGroupJoined, trackPurchase } from "../utils/analytics";

/* -------------------------------------------------------------------------- */
/*  helpers                                                                    */
/* -------------------------------------------------------------------------- */

function toAmount(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

function getStatusMeta(group) {
  if (group.status === "active") {
    return {
      label: "Active",
      badgeClass: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      dotClass: "bg-emerald-500",
    };
  }
  if (["closed", "refunded", "refunding", "failed"].includes(group.status)) {
    return {
      label: group.status_label || "Closed",
      badgeClass: "bg-slate-100 text-slate-600 ring-slate-200",
      dotClass: "bg-slate-400",
    };
  }
  if (["awaiting_purchase", "proof_submitted", "purchasing"].includes(group.status)) {
    return {
      label: group.status_label || "In progress",
      badgeClass: "bg-amber-50 text-amber-800 ring-amber-200",
      dotClass: "bg-amber-500",
    };
  }
  return {
    label: group.status_label || "Open slots",
    badgeClass: "bg-sky-50 text-sky-800 ring-sky-200",
    dotClass: "bg-sky-500",
  };
}

/* -------------------------------------------------------------------------- */
/*  inline icon set (self-contained, no new UiIcons deps)                      */
/* -------------------------------------------------------------------------- */

function LockIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function ShareIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}
function UsersIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M22 19v-1a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6" />
    </svg>
  );
}
function ChevronRightIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function VerifiedBadge({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 1.5l2.4 1.9 3.1-.2 1 3 2.7 1.6-1 3 1 3-2.7 1.6-1 3-3.1-.2L12 23.5l-2.4-1.9-3.1.2-1-3L2.8 17l1-3-1-3 2.7-1.6 1-3 3.1.2z" />
      <path d="M8.5 12.2l2.2 2.2 4.3-4.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  escrow timeline step                                                       */
/* -------------------------------------------------------------------------- */

function EscrowStep({ icon, title, body, state }) {
  // state: "done" | "active" | "upcoming"
  const ring =
    state === "active"
      ? "bg-teal-600 text-white ring-4 ring-teal-100 shadow-lg shadow-teal-600/25"
      : state === "done"
        ? "bg-emerald-100 text-emerald-700 ring-4 ring-white"
        : "bg-slate-100 text-slate-400 ring-4 ring-white";

  const titleColor =
    state === "active" ? "text-teal-900" : state === "done" ? "text-slate-950" : "text-slate-700";
  const bodyColor =
    state === "active" ? "text-teal-700" : "text-slate-500";

  return (
    <div className="relative grid grid-cols-[44px_1fr] gap-4">
      <span className={`relative z-[1] flex h-11 w-11 items-center justify-center rounded-full transition-all ${ring}`}>
        {icon}
      </span>
      <div className="pb-6 pt-0.5">
        <p className={`text-[15px] font-black leading-6 ${titleColor}`}>{title}</p>
        <p className={`mt-1 text-[13px] leading-6 ${bodyColor}`}>{body}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  avatar stack                                                               */
/* -------------------------------------------------------------------------- */

function AvatarStack({ count, ownerInitials }) {
  const shown = Math.min(count, 4);
  const extra = Math.max(count - shown, 0);
  const palette = ["bg-teal-100 text-teal-800", "bg-amber-100 text-amber-800", "bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800"];
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {ownerInitials && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white ring-2 ring-white">
            {ownerInitials}
          </span>
        )}
        {Array.from({ length: Math.max(shown - 1, 0) }).map((_, i) => (
          <span
            key={i}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black ring-2 ring-white ${palette[i % palette.length]}`}
          >
            {String.fromCharCode(65 + i)}
          </span>
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-2 text-[12px] font-bold text-slate-500">+{extra} more</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  main component                                                             */
/* -------------------------------------------------------------------------- */

export default function GroupDetails({ isAuth }) {
  const { groupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [group, setGroup] = useState(location.state?.group || null);
  const [loading, setLoading] = useState(!group);
  const [joining, setJoining] = useState(false);
  const [waitlisting, setWaitlisting] = useState(false);
  const [joinError, setJoinError] = useState(null);

  useEffect(() => {
    if (group) return;
    const fetchGroup = async () => {
      try {
        const res = await API.get("groups/", { params: { page_size: 100 } });
        const found = getPaginatedItems(res.data).find((item) => String(item.id) === String(groupId));
        if (found) {
          setGroup(found);
        } else {
          toast.error("Group not found or no longer available.");
          navigate("/groups");
        }
      } catch (err) {
        toast.error("Failed to load group details.");
        navigate("/groups");
      } finally {
        setLoading(false);
      }
    };
    void fetchGroup();
  }, [group, groupId, navigate, toast]);

  const handleJoin = async () => {
    if (!isAuth) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (!group) return;
    setJoining(true);
    try {
      const res = await API.post("join-group/", { group_id: group.id });
      trackGroupJoined(group, res.data || {});
      trackPurchase(group, res.data || {});
      if (group.mode === "sharing") {
        const successNote = res.data?.pricing_note ? ` ${res.data.pricing_note}` : "";
        const successFeeNote =
          Number(res.data?.platform_fee_amount || 0) > 0
            ? ` This included a 5% platform fee of Rs ${Number(res.data?.platform_fee_amount || 0).toFixed(2)}.`
            : "";
        toast.success(
          `Rs ${res.data?.charged_amount || group.join_price || group.price_per_slot} charged -> Status: Held -> Waiting for access confirmation.${successFeeNote}${successNote}`.trim(),
          { title: "Joined split" }
        );
      } else {
        const successFeeNote =
          Number(res.data?.platform_fee_amount || 0) > 0
            ? ` This included a 5% platform fee of Rs ${Number(res.data?.platform_fee_amount || 0).toFixed(2)}.`
            : "";
        toast.success(
          `Contribution reserved -> Status: Held -> Waiting for group completion.${successFeeNote}`.trim(),
          { title: "Joined group" }
        );
      }
      window.location.href = `/groups/${group.id}/chat`;
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to join group.";
      toast.error(msg, { title: "Couldn't join group" });
      if (err.response?.status === 409) {
        setJoinError(msg);
      }
    } finally {
      setJoining(false);
    }
  };

  const handleJoinWaitlist = async () => {
    try {
      setWaitlisting(true);
      await API.post(`groups/${group.id}/waitlist/join/`);
      toast.success("Added to the waitlist. You'll be auto-joined if a spot opens up.");
      // Refresh the group to update waitlist_count.
      const res = await API.get("groups/", { params: { page_size: 100 } });
      const found = getPaginatedItems(res.data).find((item) => String(item.id) === String(groupId));
      if (found) {
        setGroup(found);
      }
      setJoinError(null);
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to join waitlist.";
      toast.error(msg);
    } finally {
      setWaitlisting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-50">
        <LoadingSpinner className="h-8 w-8 text-slate-400" />
      </div>
    );
  }
  if (!group) return null;

  /* ---- derived values (unchanged logic) ---- */
  const planName = group.subscription_name || group.subscription || "ShareVerse split";
  const planMeta = getPlanMeta(planName);
  const ownerName = formatHostDisplayName(group.owner_name);
  const hostReputation = buildHostReputation(group.owner_rating, group.owner_review_count);
  const ownerInitials = getInitials(ownerName);

  const totalSlots = toAmount(group.total_slots);
  const filledSlots = toAmount(group.filled_slots);
  const remainingSlots = Math.max(toAmount(group.remaining_slots, totalSlots - filledSlots), 0);
  const progressPercent = totalSlots > 0 ? Math.min(100, Math.round((filledSlots / totalSlots) * 100)) : 0;
  const cycleLabel = [formatDate(group.start_date), formatDate(group.end_date)].filter(Boolean).join(" → ");

  const platformFee = toAmount(group.platform_fee_amount ?? group.platform_fee);
  const joinPrice = toAmount(group.join_price, toAmount(group.price_per_slot) + platformFee);
  const subtotal = toAmount(group.join_subtotal, Math.max(joinPrice - platformFee, 0));

  const isSharing = group.mode === "sharing";
  const statusMeta = getStatusMeta(group);
  const modeLabel = isSharing ? "Share existing plan" : "Buy together";
  const titleSuffix = isSharing ? "Split Group" : "Group Purchase";

  const paymentLabel = !isSharing
    ? "Contribution reserved today"
    : group.is_prorated
      ? "Pay for remaining cycle"
      : "Pay to join this cycle";
  const paymentBody = isSharing
    ? "Charged from your wallet when you join. Funds stay held until access is confirmed."
    : "Reserved in escrow while the group fills and the host completes the purchase.";
  const cycleHelper = group.pricing_note || group.is_prorated ? "Proration applied" : "Full access window";

  const fullOrClosed = remainingSlots <= 0 || ["closed", "refunded", "refunding", "failed"].includes(group.status);
  const joinDisabled = joining || group.is_joinable === false || fullOrClosed;
  const joinLabel = isAuth ? "Confirm & Join" : "Login to Join";

  const fillState = (() => {
    if (progressPercent >= 100) return { color: "bg-emerald-500", text: "Full" };
    if (progressPercent >= 60) return { color: "bg-teal-500", text: "Almost full" };
    return { color: "bg-sky-500", text: "Filling" };
  })();

  return (
    <div className="min-h-screen bg-slate-50 pb-[140px] text-slate-950">
      {/* ---------------------------------------------------------------- sticky header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-3 py-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/groups")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2 text-[15px] font-black text-slate-700 active:scale-95 active:bg-slate-100"
            aria-label="Back to explore"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            <span className="hidden xs:inline">Explore</span>
          </button>
          <p className="truncate text-[14px] font-black text-slate-950">{planName}</p>
          <span className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-95">
            <ShareIcon className="h-4 w-4" />
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl">
        {/* ------------------------------------------------------------ hero */}
        <section className="bg-white px-4 pb-5 pt-4">
          <div className="flex items-start gap-3.5">
            <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SubscriptionLogo name={planName} size="100%" className="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{planMeta.category}</p>
              <h1 className="mt-1 text-[19px] font-black leading-6 text-slate-950">
                {planName} <span className="text-slate-400">{titleSuffix}</span>
              </h1>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
                {isSharing
                  ? "Join an active plan — access after host confirms."
                  : "Pool funds now — host buys once the group fills."}
              </p>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
                <span className="text-[20px] font-black leading-none">{remainingSlots}</span>
              </div>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-teal-600">spots left</p>
            </div>
          </div>

          {/* badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-teal-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-teal-800 ring-1 ring-teal-100">
              {modeLabel}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] ring-1 ${statusMeta.badgeClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
              {statusMeta.label}
            </span>
          </div>
        </section>

        {/* ------------------------------------------------------------ price hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-teal-700 to-teal-800 px-5 py-6 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                <WalletIcon className="h-4 w-4" />
              </span>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-100">{paymentLabel}</p>
            </div>
            <p className="mt-3 text-[42px] font-black leading-none tracking-tight">{formatCurrency(joinPrice)}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold text-teal-50">
              <span>Plan {formatCurrency(subtotal)}</span>
              <span className="text-teal-300">•</span>
              <span>Fee {formatCurrency(platformFee)}</span>
              <span className="text-teal-300">•</span>
              <span>from wallet</span>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-teal-100/90">{paymentBody}</p>
          </div>
        </section>

        {/* ------------------------------------------------------------ host trust card */}
        <section className="bg-white px-4 py-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="flex items-center gap-3">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[14px] font-black uppercase text-white">
                {ownerInitials}
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                  <VerifiedBadge className="h-5 w-5 text-teal-600" />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Hosted by</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-[16px] font-black text-slate-950">{ownerName}</p>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] font-bold text-slate-500">
                  {hostReputation ? (
                    <>
                      <span className="inline-flex items-center gap-0.5 text-amber-600">
                        <StarIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                        {hostReputation.rating}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>{hostReputation.reviewCount} review{hostReputation.reviewCount === 1 ? "" : "s"}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">New host — no reviews yet</span>
                  )}
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Verified
                  </span>
                </div>
              </div>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300" />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ escrow timeline */}
        <section className="bg-white px-4 pb-7 pt-1">
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-black leading-5 text-slate-950">Escrow protection</h2>
              <p className="text-[11px] font-semibold text-slate-400">Your money is safe until you confirm access</p>
            </div>
          </div>

          <div className="relative mt-5 px-1">
            <div className="absolute left-[22px] top-3 bottom-9 w-0.5 bg-gradient-to-b from-slate-200 via-slate-200 to-emerald-200" aria-hidden="true" />
            <EscrowStep
              icon={<LockIcon className="h-5 w-5" />}
              title={`${formatCurrency(joinPrice)} held in escrow`}
              body="Funds are locked the moment you join — the host cannot access them yet."
              state="done"
            />
            <EscrowStep
              icon={isSharing ? <ShareIcon className="h-5 w-5" /> : <CheckCircleIcon className="h-5 w-5" />}
              title={isSharing ? "Host shares access" : "Host completes purchase"}
              body={isSharing ? "The host shares the invite, credentials, or next access step." : "The host buys the plan within 6h and uploads proof of purchase."}
              state="upcoming"
            />
            <EscrowStep
              icon={<CheckCircleIcon className="h-5 w-5" />}
              title="You confirm & host gets paid"
              body="Only after you confirm working access does the host receive the payout."
              state="active"
            />
          </div>

          <div className="mt-2 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <span className="mt-0.5 text-amber-600">
              <ShieldIcon className="h-4 w-4" />
            </span>
            <p className="text-[12.5px] font-semibold leading-5 text-amber-900">
              Credentials don't work or host doesn't deliver? Report an issue and your funds are refunded to your wallet.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------ members + fill */}
        <section className="bg-white px-4 pb-5 pt-1">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-slate-500" />
                <p className="text-[12px] font-black uppercase tracking-[0.12em] text-slate-500">Members</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${fillState.text === "Full" ? "bg-emerald-50 text-emerald-700" : fillState.text === "Almost full" ? "bg-teal-50 text-teal-700" : "bg-sky-50 text-sky-700"}`}>
                {fillState.text}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <AvatarStack count={filledSlots} ownerInitials={ownerInitials} />
              <p className="text-[13px] font-black text-slate-950">
                {filledSlots}<span className="text-slate-400">/{totalSlots}</span>
                {group.waitlist_count > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">
                    +{group.waitlist_count} waiting
                  </span>
                )}
              </p>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <span className={`block h-full rounded-full transition-all ${fillState.color}`} style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="mt-2 text-[11px] font-semibold text-slate-400">{progressPercent}% filled</p>
          </div>
        </section>

        {/* ------------------------------------------------------------ cycle + next step */}
        <section className="bg-white px-4 pb-6 pt-1">
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-slate-500" />
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Current cycle</p>
              </div>
              <p className="mt-2 text-[15px] font-black leading-6 text-slate-950">{cycleLabel || "Dates pending"}</p>
              <p className="mt-0.5 text-[12px] font-semibold text-slate-500">{cycleHelper}</p>
            </div>

            <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-teal-600" />
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-teal-700">What happens next</p>
              </div>
              <p className="mt-2 text-[14px] font-black leading-5 text-slate-950">{group.next_action || "Host coordinates access"}</p>
              <p className="mt-0.5 text-[12px] font-semibold text-slate-500">Confirm before payout — your money stays protected.</p>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------------------------------------------------------- sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5">
          {group.is_joined ? (
            <button
              type="button"
              onClick={() => { window.location.href = `/groups/${group.id}/chat`; }}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-[16px] font-black text-white shadow-lg shadow-teal-700/25 transition-transform active:scale-[0.98]"
            >
              Open Chat
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate("/groups")}
                className="hidden min-h-14 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-[15px] font-black text-slate-600 active:scale-[0.98] sm:flex"
              >
                Cancel
              </button>
              {joinError?.includes("waitlist") ? (
                <button
                  type="button"
                  onClick={handleJoinWaitlist}
                  disabled={waitlisting}
                  className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 text-[16px] font-black text-white shadow-lg shadow-amber-600/25 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                >
                  {waitlisting ? (
                    <>
                      <LoadingSpinner className="h-4 w-4" />
                      Adding...
                    </>
                  ) : (
                    "Join waitlist"
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joinDisabled}
                  className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-[16px] font-black text-white shadow-lg shadow-teal-700/25 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                >
                  {joining ? (
                    <>
                      <LoadingSpinner className="h-4 w-4" />
                      Processing…
                    </>
                  ) : fullOrClosed ? (
                    "No seats available"
                  ) : (
                    <>
                      {joinLabel}
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[13px]">
                        {formatCurrency(joinPrice)}
                      </span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
