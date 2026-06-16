import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
// useIsMobile hook removed since it was unused
import SubscriptionLogo from "../components/SubscriptionLogo";
import { useToast } from "../components/ToastProvider";
import { CheckCircleIcon, ShieldIcon, LoadingSpinner } from "../components/UiIcons";
import {
  getPlanMeta,
  formatCurrency,
  formatDate,
  getInitials,
  formatHostDisplayName,
  getMockReputation
} from "../utils/groupHelpers";

// We'll reuse the sleek MobileJoinConfirmModal for the final payment step
// Wait, if it's already a full page, do we need the modal?
// The user approved the plan where the bottom bar triggers the exact same sleek Join Confirmation Modal.
// However, the modal is defined in Groups.js. I should probably just implement the Join flow right here on the page to avoid importing a modal from a page component.
// Actually, it's easier to just recreate the Join Confirmation Modal here if needed, OR just have the "Join" button on this page DO the joining directly! The user's exact wording: "redirect it to a dedicated page containing all the information of that split".
// If the page contains ALL the info, then the page *is* the confirmation.
// Let's make the "Join" button at the bottom of GroupDetails.js just call the join API directly.

import API from "../api/axios";

export default function GroupDetails() {
  const { groupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [group, setGroup] = useState(location.state?.group || null);
  const [loading, setLoading] = useState(!group);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!group) {
      // Try to fetch it if we don't have it in state
      const fetchGroup = async () => {
        try {
          // Attempt to fetch from available groups
          const res = await API.get("groups/", { params: { page_size: 100 } });
          const found = res.data.results.find((g) => String(g.id) === String(groupId));
          if (found) {
            setGroup(found);
          } else {
            addToast("Group not found or no longer available.", "error");
            navigate("/groups");
          }
        } catch (err) {
          addToast("Failed to load group details.", "error");
          navigate("/groups");
        } finally {
          setLoading(false);
        }
      };
      fetchGroup();
    }
  }, [group, groupId, navigate, addToast]);

  const handleJoin = async () => {
    if (!group) return;
    setJoining(true);
    try {
      const res = await API.post("join-group/", { group_id: group.id });
      if (group.mode === "sharing") {
        const successNote = res.data?.pricing_note ? ` ${res.data.pricing_note}` : "";
        const successFeeNote =
          Number(res.data?.platform_fee_amount || 0) > 0
            ? ` This included a 5% platform fee of Rs ${Number(res.data?.platform_fee_amount || 0).toFixed(2)}.`
            : "";
        addToast(
          `Rs ${res.data?.charged_amount || group.join_price || group.price_per_slot} charged → Status: Held → Waiting for access confirmation.${successFeeNote}${successNote}`.trim(),
          "success"
        );
      } else {
        const successFeeNote =
          Number(res.data?.platform_fee_amount || 0) > 0
            ? ` This included a 5% platform fee of Rs ${Number(res.data?.platform_fee_amount || 0).toFixed(2)}.`
            : "";
        addToast(
          `Contribution reserved → Status: Held → Waiting for group completion.${successFeeNote}`.trim(),
          "success"
        );
      }
      navigate(`/groups/${group.id}/chat`);
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to join group.";
      addToast(msg, "error");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50">
        <LoadingSpinner className="w-8 h-8 text-slate-400" />
      </div>
    );
  }

  if (!group) return null;

  const planName = group.subscription_name || group.subscription;
  const planMeta = getPlanMeta(planName);
  const ownerName = formatHostDisplayName(group.owner_name);
  const hostReputation = getMockReputation(group.owner_name);
  
  const totalSlots = Number(group.total_slots || 0);
  const filledSlots = Number(group.filled_slots || 0);
  const remainingSlots = Math.max(Number(group.remaining_slots ?? (totalSlots - filledSlots)) || 0, 0);
  const cycleLabel = [formatDate(group.start_date), formatDate(group.end_date)].filter(Boolean).join(" - ");

  const isSharing = group.mode === "sharing";
  const modePillText = isSharing ? "SHARE EXISTING PLAN" : "BUY NEW PLAN";
  const modePillClass = isSharing 
    ? "bg-emerald-100 text-emerald-800" 
    : "bg-amber-100 text-amber-800";

  let statusText = String(group.status_label || "").toUpperCase();
  let statusBg = "bg-blue-100";
  let statusTextClass = "text-blue-800";
  let statusDotClass = "bg-blue-600";
  if (group.status === "active") {
    statusBg = "bg-emerald-100";
    statusTextClass = "text-emerald-800";
    statusDotClass = "bg-emerald-600";
  } else if (group.status === "closed" || group.status === "refunded") {
    statusBg = "bg-slate-200";
    statusTextClass = "text-slate-600";
    statusDotClass = "bg-slate-500";
  }

  const joinPrice = Number(group.join_price || 0);
  const platformFee = Number(group.platform_fee || 0);
  const subtotal = joinPrice - platformFee;

  const payNowLabel = group.mode === "group_buy"
    ? "CONTRIBUTE NOW"
    : group.is_prorated
      ? "PAY NOW FOR THE REMAINING CYCLE"
      : "PAY NOW";

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Top Navigation */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
        <button 
          onClick={() => navigate("/groups")}
          className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          ← Back to Explore
        </button>
        <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Group Details</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 flex flex-col gap-6">
        
        {/* Hero Info Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-white shadow-md border border-slate-50 flex items-center justify-center p-1.5 sm:p-2 mb-4 sm:mb-6">
            <SubscriptionLogo name={planName} size="100%" className="w-full h-full rounded-xl" />
          </div>

          <div className="flex flex-wrap gap-2.5 mb-6">
            <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${modePillClass}`}>
              {modePillText}
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] tracking-wider font-bold uppercase ${statusBg} ${statusTextClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`}></span>
              {statusText}
            </div>
            <div className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-800 font-bold text-[10px] tracking-wider uppercase">
              {planMeta.category}
            </div>
          </div>

          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 leading-tight">
            {planName} Split Group
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            {group.mode === "sharing"
              ? "Join this existing plan and get access immediately after the host confirms."
              : "Contribute to this new plan. Purchase happens once all slots are filled."}
          </p>

          {/* Host Mini Profile inside Hero */}
          <div className="mt-6 sm:mt-8 flex items-center gap-3 sm:gap-4 pt-5 sm:pt-6 border-t border-slate-100">
            <span className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] sm:text-[14px] font-bold text-slate-500 uppercase tracking-wider">
              {getInitials(ownerName)}
            </span>
            <div className="flex flex-col justify-center">
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Hosted by</p>
              <p className="text-[15px] font-bold text-slate-900">{ownerName}</p>
              <p className="text-[13px] font-semibold text-amber-500 mt-0.5">
                ★ {hostReputation.rating} • {hostReputation.hostedCount} groups hosted
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Card (Gradient) */}
        <div className="bg-gradient-to-br from-teal-700 to-emerald-600 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-900 opacity-20 rounded-full -ml-12 -mb-12 blur-xl"></div>
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase opacity-80 mb-2">
                {payNowLabel}
              </p>
              <p className="text-3xl sm:text-5xl font-bold leading-none tracking-tight">
                {formatCurrency(joinPrice)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[13px] text-teal-50 font-medium opacity-90 max-w-[200px] sm:ml-auto">
                {group.mode === "sharing" 
                  ? "Charged from your wallet instantly when you join."
                  : "Reserved safely until the buy-together flow completes."}
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown & Cycle Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
            <p className="text-[11px] sm:text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1">Plan Contribution</p>
            <p className="text-base sm:text-lg font-bold text-slate-900">{formatCurrency(subtotal)}</p>
            <p className="text-[12px] text-slate-400 mt-3 border-t border-slate-50 pt-3 flex justify-between">
              <span>Platform Fee</span>
              <span className="font-semibold text-slate-600">{formatCurrency(platformFee)}</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
            <p className="text-[11px] sm:text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {group.mode === "group_buy" ? "Members needed" : "Slots left"}
            </p>
            <p className="text-base sm:text-lg font-bold text-slate-900">{remainingSlots} slot{remainingSlots !== 1 ? "s" : ""}</p>
            <p className="text-[12px] text-slate-400 mt-3 border-t border-slate-50 pt-3 flex justify-between">
              <span>Total capacity</span>
              <span className="font-semibold text-slate-600">{filledSlots}/{totalSlots} filled</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 sm:col-span-2">
            <p className="text-[11px] sm:text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1">Current Cycle</p>
            <p className="text-[15px] font-bold text-slate-900 mt-1">{cycleLabel || "Dates shared after join"}</p>
            <p className="text-[13px] text-slate-500 mt-1.5">
              {group.pricing_note ? "Proration is already applied to this price." : "Matches the current plan cycle."}
            </p>
          </div>
        </div>

        {/* Buyer Protection */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 mt-2">
          <div className="flex items-center gap-2 mb-5 sm:mb-6">
            <ShieldIcon className="w-5 h-5 text-emerald-500" />
            <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-900">How your money is protected</h3>
          </div>
          
          <div className="flex flex-col gap-4 relative">
            <div className="absolute left-[15px] top-[24px] bottom-[24px] w-[2px] bg-slate-100"></div>
            
            <div className="flex items-start gap-4 relative z-10">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 border-4 border-white text-[12px] font-bold text-slate-500 shadow-sm">1</span>
              <div className="pt-1.5">
                <p className="text-[14px] font-bold text-slate-900">{formatCurrency(joinPrice)} held safely</p>
                <p className="text-[13px] text-slate-500 mt-0.5">Your funds are kept secure in ShareVerse escrow.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 relative z-10">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 border-4 border-white text-[12px] font-bold text-slate-500 shadow-sm">2</span>
              <div className="pt-1.5">
                <p className="text-[14px] font-bold text-slate-900">{group.mode === "sharing" ? "Host shares access" : "Host completes purchase"}</p>
                <p className="text-[13px] text-slate-500 mt-0.5">The host provides the necessary credentials or invites.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 relative z-10">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 border-4 border-white text-[12px] font-bold text-emerald-700 shadow-sm">3</span>
              <div className="pt-1.5">
                <p className="text-[14px] font-bold text-emerald-800">You confirm & funds release</p>
                <p className="text-[13px] text-emerald-700/80 mt-0.5">Only after you confirm working access does the host get paid.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-amber-50 p-4 border border-amber-100">
            <p className="text-[13px] font-semibold text-amber-800 leading-relaxed">
              If the host doesn't deliver or credentials don't work, you can report an issue and your funds will be fully refunded to your wallet.
            </p>
          </div>
        </div>

      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-30 flex items-center justify-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="w-full max-w-2xl flex gap-3">
          <button 
            onClick={() => navigate("/groups")}
            className="hidden sm:block flex-1 py-4 rounded-2xl border border-slate-200 bg-white text-slate-700 font-bold text-[15px] hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleJoin}
            disabled={joining || !group.is_joinable}
            className="flex-1 py-4 rounded-2xl bg-teal-800 text-white font-bold text-[16px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-teal-900 transition-colors active:scale-[0.98]"
          >
            {joining ? (
              <>
                <LoadingSpinner className="w-5 h-5" /> Processing...
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-5 h-5" />
                Confirm and Join • {formatCurrency(joinPrice)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
