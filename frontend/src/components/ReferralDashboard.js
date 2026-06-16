import { useEffect, useMemo, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";

import API from "../api/axios";
import { useToast } from "./ToastProvider";
import { CheckCircleIcon, LoadingSpinner, SparkIcon } from "./UiIcons";
import ShareActions from "./ShareActions";

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatusLabel(status) {
  if (status === "rewarded") {
    return "Rewarded";
  }
  if (status === "joined_group") {
    return "Joined first group";
  }
  return "Signed up";
}

export default function ReferralDashboard() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    let isMounted = true;

    const fetchReferralData = async () => {
      try {
        setLoading(true);
        const response = await API.get("referral/my-code/");
        if (!isMounted) {
          return;
        }
        setData(response.data || null);
        setError("");
      } catch (fetchError) {
        console.error(fetchError);
        if (!isMounted) {
          return;
        }
        setError("We could not load your referral details right now.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchReferralData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!copiedCode) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedCode(false);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedCode]);

  const referrals = useMemo(
    () => (Array.isArray(data?.referrals) ? data.referrals : []),
    [data?.referrals]
  );

  const signupUrl = useMemo(() => {
    if (!data?.code || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/signup?ref=${encodeURIComponent(data.code)}`;
  }, [data?.code]);

  const copyCode = async () => {
    if (!data?.code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(data.code);
      setCopiedCode(true);
      toast.success("Referral code copied!", { title: "Copied" });
    } catch {
      toast.error("We could not copy your referral code right now.", { title: "Copy failed" });
    }
  };

  return (
    <section className={isMobile ? "bg-white p-5 rounded-[32px] shadow-sm border border-slate-100 relative" : "sv-card sv-reveal sv-referral-panel"}>
      {isMobile ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[20px] font-black text-slate-900 leading-tight">Your dashboard</h2>
            <span className="bg-teal-50 text-teal-600 text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-full">
              {loading ? "..." : `${referrals.length} total`}
            </span>
          </div>
          <p className="text-slate-500 text-[13px] leading-relaxed">
            Track your invites, copy your code, and monitor your rewards below.
          </p>
        </div>
      ) : (
        <div className="sv-referral-header">
          <div>
            <p className="sv-eyebrow">Referrals</p>
            <h2 className="sv-title mt-2">Invite friends and earn join-only bonus credit</h2>
            <p className="sv-referral-subtitle">
              Share your code or signup link. Rewards land as non-withdrawable bonus credit after your referral signs up and completes their first eligible join with a join subtotal of at least Rs 150.
            </p>
          </div>
          <span className="sv-chip">
            {loading ? "Loading" : `${referrals.length} referral${referrals.length === 1 ? "" : "s"}`}
          </span>
        </div>
      )}

      {loading ? (
        <div className="sv-referral-loading">
          <LoadingSpinner />
          <span>Loading your referral dashboard...</span>
        </div>
      ) : error ? (
        <div className="sv-referral-alert is-error">
          <strong>Referral details unavailable</strong>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className={isMobile ? "bg-slate-900 rounded-[24px] p-5 mb-6 flex flex-col gap-4 text-white shadow-md relative overflow-hidden" : "sv-referral-code-card"}>
            {isMobile && <div className="absolute top-0 right-0 p-12 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl pointer-events-none"></div>}
            <div className={isMobile ? "relative z-10" : ""}>
              <p className={isMobile ? "text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-1" : "sv-referral-code-label"}>Your referral code</p>
              <h3 className={isMobile ? "text-3xl font-black tracking-wider text-teal-300" : "sv-referral-code-value"}>{data?.code || "Not available"}</h3>
            </div>
            <button
              type="button"
              className={isMobile ? `flex items-center justify-center gap-2 py-3 px-4 rounded-[16px] font-bold text-[13px] transition-all relative z-10 ${copiedCode ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'bg-white text-slate-900 border border-transparent active:scale-95'}` : `sv-share-btn sv-share-btn--copy ${copiedCode ? "is-copied" : ""}`}
              onClick={() => {
                void copyCode();
              }}
            >
              {copiedCode ? <CheckCircleIcon className="h-4 w-4" /> : <SparkIcon className="h-4 w-4" />}
              <span>{copiedCode ? "Copied" : "Copy code"}</span>
            </button>
          </div>

          <div className={isMobile ? "grid grid-cols-2 gap-3 mb-6" : "sv-referral-stats"}>
            <ReferralStat label="Total referrals" value={data?.total_referrals || 0} isMobile={isMobile} />
            <ReferralStat label="Successful" value={data?.successful_referrals || 0} isMobile={isMobile} />
            <div className={isMobile ? "col-span-2" : ""}>
              <ReferralStat label="Rewards earned" value={formatCurrency(data?.total_rewards_earned || 0)} isMobile={isMobile} />
            </div>
          </div>

          <ShareActions
            url={signupUrl}
            title="ShareVerse referral signup"
            text={`Sign up on ShareVerse using my referral code. Rewards apply after your first eligible join of Rs 150 or more, and bonus credit can be used only to join groups. ${signupUrl}`}
            copyLabel="Copy signup link"
            copySuccessMessage="Signup link copied!"
            qrTitle="Scan this code to open the ShareVerse signup page with your referral code already filled in."
            className="mt-5"
          />

          <div className={isMobile ? "mt-2" : "sv-referral-list"}>
            <div className={isMobile ? "mb-4" : "sv-referral-list-header"}>
              <p className={isMobile ? "text-[16px] font-bold text-slate-900" : "sv-referral-list-title"}>Referral activity</p>
              {!isMobile && <p className="sv-referral-list-note">Track who signed up, who joined, and which rewards have already landed.</p>}
            </div>

            {referrals.length ? (
              <div className={isMobile ? "space-y-3" : "sv-referral-items"}>
                {referrals.map((referral) => (
                  <article key={referral.id} className={isMobile ? "bg-slate-50 border border-slate-100 rounded-[20px] p-4 flex flex-wrap items-center justify-between gap-3" : "sv-referral-item"}>
                    <div>
                      <p className={isMobile ? "text-[14px] font-bold text-slate-900 mb-0.5" : "sv-referral-item-name"}>@{referral.referred_username}</p>
                      <p className={isMobile ? "text-[11px] font-medium text-slate-400" : "sv-referral-item-date"}>{formatDate(referral.created_at)}</p>
                    </div>
                    <div className={isMobile ? "flex flex-col items-end gap-1 text-right" : "sv-referral-item-meta"}>
                      <span className={isMobile ? `text-[10px] font-extrabold uppercase tracking-widest ${referral.status === 'rewarded' ? 'text-teal-600' : 'text-slate-400'}` : `sv-referral-status is-${referral.status}`}>
                        {getStatusLabel(referral.status)}
                      </span>
                      <strong className={isMobile ? `text-[14px] font-black ${referral.reward_given ? 'text-slate-900' : 'text-slate-400'}` : ""}>{referral.reward_given ? formatCurrency(referral.reward_amount) : "Pending"}</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={isMobile ? "text-center py-8 bg-slate-50 rounded-[20px] border border-slate-100 px-4" : "sv-referral-empty"}>
                <p className={isMobile ? "text-[14px] font-bold text-slate-900 mb-1" : ""}>No referrals yet.</p>
                <span className={isMobile ? "text-[12px] text-slate-500 leading-relaxed block" : ""}>Your signup link is ready whenever you want to share it.</span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ReferralStat({ label, value, isMobile }) {
  return (
    <div className={isMobile ? "bg-slate-50 border border-slate-100 rounded-[20px] p-4 flex flex-col items-center justify-center text-center" : "sv-referral-stat"}>
      <p className={isMobile ? "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1" : ""}>{label}</p>
      <strong className={isMobile ? "text-[22px] font-black text-slate-900" : ""}>{value}</strong>
    </div>
  );
}
