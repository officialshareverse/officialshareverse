import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
// useIsMobile hook removed since it was unused
import SubscriptionLogo from "../components/SubscriptionLogo";
import { useToast } from "../components/ToastProvider";
import { ShieldIcon, LoadingSpinner } from "../components/UiIcons";
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
import { trackGroupJoined, trackPurchase } from "../utils/analytics";

export default function GroupDetails({ isAuth }) {
  const { groupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

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
      fetchGroup();
    }
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
          `Rs ${res.data?.charged_amount || group.join_price || group.price_per_slot} charged → Status: Held → Waiting for access confirmation.${successFeeNote}${successNote}`.trim(),
          { title: "Joined split" }
        );
      } else {
        const successFeeNote =
          Number(res.data?.platform_fee_amount || 0) > 0
            ? ` This included a 5% platform fee of Rs ${Number(res.data?.platform_fee_amount || 0).toFixed(2)}.`
            : "";
        toast.success(
          `Contribution reserved → Status: Held → Waiting for group completion.${successFeeNote}`.trim(),
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
    <div className="min-h-screen bg-white pb-32">
      {/* Top Navigation */}
      <div className="flex sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 items-center justify-between">
        <button 
          onClick={() => navigate("/groups")}
          className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          ← Back to Explore
        </button>
        <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Group Details</span>
      </div>

      <div className="max-w-2xl mx-auto flex flex-col">
        
        {/* Hero Section (No boxes on mobile) */}
        <div className="px-4 sm:px-6 pt-6 sm:pt-10 pb-6 sm:bg-white sm:rounded-3xl sm:p-8 sm:shadow-sm sm:border sm:border-slate-100 sm:mb-6">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mb-4 overflow-hidden rounded-xl">
            <SubscriptionLogo name={planName} size="100%" className="w-full h-full object-cover" />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${modePillClass}`}>
              {modePillText}
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-wider font-bold uppercase ${statusBg} ${statusTextClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`}></span>
              {statusText}
            </div>
            <div className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] tracking-wider uppercase">
              {planMeta.category}
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
            {planName} Split Group
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">
            {group.mode === "sharing"
              ? "Join this existing plan and get access immediately after the host confirms."
              : "Contribute to this new plan. Purchase happens once all slots are filled."}
          </p>

          {/* Host Profile */}
          <div className="mt-6 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-500 uppercase tracking-wider">
              {getInitials(ownerName)}
            </span>
            <div className="flex flex-col justify-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Hosted by</p>
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-bold text-slate-900">{ownerName}</p>
                <span className="text-[12px] font-semibold text-amber-500">
                  ★ {hostReputation.rating}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Card (Edge-to-edge on mobile) */}
        <div className="bg-gradient-to-br from-teal-700 to-emerald-600 sm:rounded-3xl px-5 py-6 sm:p-8 text-white relative overflow-hidden sm:mx-6 sm:mb-6">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-900 opacity-20 rounded-full -ml-12 -mb-12 blur-xl"></div>
          
          <div className="relative z-10">
            <p className="text-[11px] font-bold tracking-widest uppercase opacity-80 mb-1">
              {payNowLabel}
            </p>
            <p className="text-4xl sm:text-5xl font-bold leading-none tracking-tight">
              {formatCurrency(joinPrice)}
            </p>
            <p className="text-[13px] text-teal-50 font-medium opacity-90 mt-3 max-w-[280px]">
              {group.mode === "sharing" 
                ? "Charged from your wallet instantly when you join."
                : "Reserved safely until the buy-together flow completes."}
            </p>
          </div>
        </div>

        {/* Breakdown Details (Clean list, no boxes) */}
        <div className="px-4 sm:px-6 py-2">
          <div className="flex flex-row justify-between items-center py-4 border-b border-slate-100">
            <div>
              <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Plan Contribution</p>
              <p className="text-[13px] text-slate-400 mt-0.5">Platform Fee: {formatCurrency(platformFee)}</p>
            </div>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(subtotal)}</p>
          </div>

          <div className="flex flex-row justify-between items-center py-4 border-b border-slate-100">
            <div>
              <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                {group.mode === "group_buy" ? "Members needed" : "Slots left"}
              </p>
              <p className="text-[13px] text-slate-400 mt-0.5">{filledSlots}/{totalSlots} filled</p>
            </div>
            <p className="text-lg font-bold text-slate-900">{remainingSlots}</p>
          </div>

          <div className="flex flex-row justify-between items-center py-4 border-b border-slate-100">
            <div>
              <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Current Cycle</p>
              <p className="text-[13px] text-slate-400 mt-0.5 max-w-[200px]">
                {group.pricing_note ? "Proration applied." : "Matches current cycle."}
              </p>
            </div>
            <p className="text-[15px] font-bold text-slate-900 text-right">{cycleLabel || "Dates shared later"}</p>
          </div>
        </div>

        {/* Buyer Protection (Clean section, no boxes) */}
        <div className="px-4 sm:px-6 py-6 sm:bg-white sm:rounded-3xl sm:p-6 sm:shadow-sm sm:border sm:border-slate-100 sm:mx-6 sm:mt-6">
          <div className="flex items-center gap-2 mb-6">
            <ShieldIcon className="w-5 h-5 text-emerald-500" />
            <h3 className="text-[15px] font-bold text-slate-900">How your money is protected</h3>
          </div>
          
          <div className="flex flex-col gap-5 relative">
            <div className="absolute left-[11px] top-[24px] bottom-[24px] w-[2px] bg-slate-100"></div>
            
            <div className="flex items-start gap-4 relative z-10">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 border-[3px] border-white text-[10px] font-bold text-slate-500">1</span>
              <div className="pt-0.5">
                <p className="text-[14px] font-bold text-slate-900">{formatCurrency(joinPrice)} held safely</p>
                <p className="text-[13px] text-slate-500 mt-0.5">Your funds are kept secure in ShareVerse escrow.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 relative z-10">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 border-[3px] border-white text-[10px] font-bold text-slate-500">2</span>
              <div className="pt-0.5">
                <p className="text-[14px] font-bold text-slate-900">{group.mode === "sharing" ? "Host shares access" : "Host completes purchase"}</p>
                <p className="text-[13px] text-slate-500 mt-0.5">The host provides the necessary credentials or invites.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 relative z-10">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 border-[3px] border-white text-[10px] font-bold text-emerald-700">3</span>
              <div className="pt-0.5">
                <p className="text-[14px] font-bold text-emerald-800">You confirm & funds release</p>
                <p className="text-[13px] text-emerald-700/80 mt-0.5">Only after you confirm working access does the host get paid.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-amber-50 p-4 border border-amber-100">
            <p className="text-[12px] font-medium text-amber-800 leading-relaxed">
              If the host doesn't deliver or credentials don't work, you can report an issue and your funds will be fully refunded to your wallet.
            </p>
          </div>
        </div>

      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-xl border-t border-slate-200 z-30 flex items-center justify-center">
        <div className="w-full max-w-2xl flex gap-3">
          <button 
            onClick={() => navigate("/groups")}
            className="hidden sm:block flex-1 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-[15px] hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          {group.is_joined ? (
            <button 
              onClick={() => { window.location.href = `/groups/${group.id}/chat`; }}
              className="flex-1 py-3.5 rounded-xl bg-teal-800 text-white font-bold text-[15px] shadow-md flex items-center justify-center gap-2 hover:bg-teal-900 transition-colors active:scale-[0.98]"
            >
              Open Chat
            </button>
          ) : (
            <button 
              onClick={handleJoin}
              disabled={joining || group.is_joinable === false}
              className="flex-1 py-3.5 rounded-xl bg-teal-800 text-white font-bold text-[15px] shadow-md flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-teal-900 transition-colors active:scale-[0.98]"
            >
              {joining ? (
                <>
                  <LoadingSpinner className="w-4 h-4" /> Processing...
                </>
              ) : (
                <>
                  Confirm and Join • {formatCurrency(joinPrice)}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
