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
  getMockReputation,
} from "../utils/groupHelpers";
import { trackGroupJoined, trackPurchase } from "../utils/analytics";

function toAmount(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

function getStatusMeta(group) {
  if (group.status === "active") {
    return {
      label: "Active",
      badgeClass: "bg-emerald-50 text-emerald-800",
      dotClass: "bg-emerald-500",
    };
  }

  if (["closed", "refunded", "refunding", "failed"].includes(group.status)) {
    return {
      label: group.status_label || "Closed",
      badgeClass: "bg-slate-100 text-slate-600",
      dotClass: "bg-slate-400",
    };
  }

  if (["awaiting_purchase", "proof_submitted", "purchasing"].includes(group.status)) {
    return {
      label: group.status_label || "In progress",
      badgeClass: "bg-amber-50 text-amber-800",
      dotClass: "bg-amber-500",
    };
  }

  return {
    label: group.status_label || "Open slots",
    badgeClass: "bg-sky-50 text-sky-800",
    dotClass: "bg-sky-500",
  };
}

function DetailRow({ label, helper, value }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-100 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        {helper ? <p className="mt-1 text-[13px] leading-5 text-slate-400">{helper}</p> : null}
      </div>
      <p className="max-w-[9.5rem] text-right text-[18px] font-black leading-6 text-slate-950">{value}</p>
    </div>
  );
}

function ProtectionStep({ number, title, body, active }) {
  return (
    <div className="relative grid grid-cols-[32px_1fr] gap-3">
      <span
        className={`relative z-[1] flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black ${
          active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
        }`}
      >
        {number}
      </span>
      <div className="pb-5">
        <p className={`text-[16px] font-black leading-6 ${active ? "text-emerald-800" : "text-slate-950"}`}>{title}</p>
        <p className={`mt-1 text-[14px] leading-6 ${active ? "text-emerald-700" : "text-slate-500"}`}>{body}</p>
      </div>
    </div>
  );
}

export default function GroupDetails({ isAuth }) {
  const { groupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [group, setGroup] = useState(location.state?.group || null);
  const [loading, setLoading] = useState(!group);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (group) {
      return;
    }

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
    } finally {
      setJoining(false);
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

  const planName = group.subscription_name || group.subscription || "ShareVerse split";
  const planMeta = getPlanMeta(planName);
  const ownerName = formatHostDisplayName(group.owner_name);
  const hostReputation = getMockReputation(group.owner_name);

  const totalSlots = toAmount(group.total_slots);
  const filledSlots = toAmount(group.filled_slots);
  const remainingSlots = Math.max(toAmount(group.remaining_slots, totalSlots - filledSlots), 0);
  const progressPercent = totalSlots > 0 ? Math.min(100, Math.round((filledSlots / totalSlots) * 100)) : 0;
  const cycleLabel = [formatDate(group.start_date), formatDate(group.end_date)].filter(Boolean).join(" - ");

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
  const cycleHelper = group.pricing_note || group.is_prorated ? "Proration applied." : "Matches the listed access window.";
  const fullOrClosed = remainingSlots <= 0 || ["closed", "refunded", "refunding", "failed"].includes(group.status);
  const joinDisabled = joining || group.is_joinable === false || fullOrClosed;
  const joinLabel = isAuth ? "Confirm and Join" : "Login to Join";

  return (
    <div className="min-h-screen bg-slate-50 pb-[112px] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/groups")}
            className="inline-flex min-h-10 items-center gap-2 text-[15px] font-black text-slate-700 active:text-slate-950"
          >
            <span aria-hidden="true">&larr;</span>
            Back
          </button>
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Group details</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl bg-white sm:mt-4 sm:rounded-lg sm:border sm:border-slate-200 sm:shadow-sm">
        <section className="px-5 pb-6 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <SubscriptionLogo name={planName} size="100%" className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{planMeta.category}</p>
                <p className="mt-1 truncate text-[15px] font-black text-slate-950">{planName}</p>
              </div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-right">
              <p className="text-[20px] font-black leading-none text-emerald-800">{remainingSlots}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">left</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-800">
              {modeLabel}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${statusMeta.badgeClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
              {statusMeta.label}
            </span>
          </div>

          <h1 className="mt-5 text-[31px] font-black leading-[1.08] text-slate-950 sm:text-[36px]">
            {planName} {titleSuffix}
          </h1>
          <p className="mt-4 text-[17px] leading-7 text-slate-500">
            {isSharing
              ? "Join this existing plan and get access after the host confirms."
              : "Join the pool now. The host buys once the group is ready."}
          </p>

          <div className="mt-6 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[15px] font-black uppercase text-slate-600">
              {getInitials(ownerName)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Hosted by</p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate text-[17px] font-black text-slate-950">{ownerName}</p>
                <span className="inline-flex items-center gap-1 text-[13px] font-black text-amber-600">
                  <StarIcon className="h-4 w-4" strokeWidth={2.1} />
                  {hostReputation.rating}
                </span>
                <span className="text-[12px] font-bold text-slate-400">{hostReputation.hostedCount} hosted</span>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-teal-700 px-5 py-7 text-white">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
              <WalletIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-teal-100">{paymentLabel}</p>
              <p className="mt-3 text-[44px] font-black leading-none text-white sm:text-[52px]">{formatCurrency(joinPrice)}</p>
              <p className="mt-4 max-w-md text-[15px] leading-6 text-teal-50">{paymentBody}</p>
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-2">
          <DetailRow
            label="Plan contribution"
            helper={`Platform fee: ${formatCurrency(platformFee)}`}
            value={formatCurrency(subtotal)}
          />
          <DetailRow
            label={isSharing ? "Seats left" : "Members needed"}
            helper={`${filledSlots}/${totalSlots} filled`}
            value={remainingSlots}
          />
          <DetailRow label="Current cycle" helper={cycleHelper} value={cycleLabel || "Dates pending"} />

          <div className="py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Group fill</p>
              <p className="text-[13px] font-black text-slate-700">{progressPercent}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-teal-600" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </section>

        <section className="mt-2 bg-white px-5 pb-8 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <h2 className="text-[21px] font-black leading-7 text-slate-950">How your money is protected</h2>
          </div>

          <div className="relative mt-7">
            <div className="absolute left-[13px] top-7 bottom-8 w-px bg-slate-200" aria-hidden="true" />
            <ProtectionStep
              number="1"
              title={`${formatCurrency(joinPrice)} held safely`}
              body="Your funds are kept secure in ShareVerse escrow."
            />
            <ProtectionStep
              number="2"
              title={isSharing ? "Host shares access" : "Host completes purchase"}
              body={isSharing ? "The host shares the invite, credentials, or next access step." : "The host buys the plan and shares proof or access details."}
            />
            <ProtectionStep
              number="3"
              title="You confirm and funds release"
              body="Only after you confirm working access does the host get paid."
              active
            />
          </div>

          <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-4">
            <p className="text-[14px] font-semibold leading-6 text-amber-900">
              If the host does not deliver or credentials do not work, you can report an issue and your funds can be refunded to your wallet.
            </p>
          </div>
        </section>

        <section className="bg-slate-50 px-5 py-5 sm:rounded-b-lg">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <ClockIcon className="h-5 w-5 text-slate-500" />
              <p className="mt-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Next step</p>
              <p className="mt-1 text-[14px] font-black leading-5 text-slate-950">{group.next_action || "Host coordinates access"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
              <p className="mt-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Access flow</p>
              <p className="mt-1 text-[14px] font-black leading-5 text-slate-950">Confirm before payout</p>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-3">
          <button
            type="button"
            onClick={() => navigate("/groups")}
            className="hidden min-h-12 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[15px] font-black text-slate-700 sm:flex"
          >
            Cancel
          </button>
          {group.is_joined ? (
            <button
              type="button"
              onClick={() => {
                window.location.href = `/groups/${group.id}/chat`;
              }}
              className="flex min-h-14 flex-1 items-center justify-center rounded-lg bg-teal-800 px-4 text-[16px] font-black text-white shadow-lg shadow-teal-900/20 active:scale-[0.99]"
            >
              Open Chat
            </button>
          ) : (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joinDisabled}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 text-[16px] font-black text-white shadow-lg shadow-teal-900/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
            >
              {joining ? (
                <>
                  <LoadingSpinner className="h-4 w-4" />
                  Processing...
                </>
              ) : fullOrClosed ? (
                "No seats available"
              ) : (
                `${joinLabel} - ${formatCurrency(joinPrice)}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
