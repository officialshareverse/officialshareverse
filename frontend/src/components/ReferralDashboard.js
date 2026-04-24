import { useEffect, useMemo, useState } from "react";

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
    <section className="sv-card sv-reveal sv-referral-panel">
      <div className="sv-referral-header">
        <div>
          <p className="sv-eyebrow">Referrals</p>
          <h2 className="sv-title mt-2">Invite friends and earn wallet credit</h2>
          <p className="sv-referral-subtitle">
            Share your code or signup link. Rewards land after your referral signs up and joins their first group.
          </p>
        </div>
        <span className="sv-chip">
          {loading ? "Loading" : `${referrals.length} referral${referrals.length === 1 ? "" : "s"}`}
        </span>
      </div>

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
          <div className="sv-referral-code-card">
            <div>
              <p className="sv-referral-code-label">Your referral code</p>
              <h3 className="sv-referral-code-value">{data?.code || "Not available"}</h3>
            </div>
            <button
              type="button"
              className={`sv-share-btn sv-share-btn--copy ${copiedCode ? "is-copied" : ""}`}
              onClick={() => {
                void copyCode();
              }}
            >
              {copiedCode ? <CheckCircleIcon className="h-4 w-4" /> : <SparkIcon className="h-4 w-4" />}
              <span>{copiedCode ? "Copied" : "Copy code"}</span>
            </button>
          </div>

          <div className="sv-referral-stats">
            <ReferralStat label="Total referrals" value={data?.total_referrals || 0} />
            <ReferralStat label="Successful referrals" value={data?.successful_referrals || 0} />
            <ReferralStat label="Rewards earned" value={formatCurrency(data?.total_rewards_earned || 0)} />
          </div>

          <ShareActions
            url={signupUrl}
            title="ShareVerse referral signup"
            text={`Sign up on ShareVerse using my referral code and we both get wallet credit! ${signupUrl}`}
            copyLabel="Copy signup link"
            copySuccessMessage="Signup link copied!"
            qrTitle="Scan this code to open the ShareVerse signup page with your referral code already filled in."
            className="mt-5"
          />

          <div className="sv-referral-list">
            <div className="sv-referral-list-header">
              <p className="sv-referral-list-title">Referral activity</p>
              <p className="sv-referral-list-note">Track who signed up, who joined, and which rewards have already landed.</p>
            </div>

            {referrals.length ? (
              <div className="sv-referral-items">
                {referrals.map((referral) => (
                  <article key={referral.id} className="sv-referral-item">
                    <div>
                      <p className="sv-referral-item-name">@{referral.referred_username}</p>
                      <p className="sv-referral-item-date">{formatDate(referral.created_at)}</p>
                    </div>
                    <div className="sv-referral-item-meta">
                      <span className={`sv-referral-status is-${referral.status}`}>
                        {getStatusLabel(referral.status)}
                      </span>
                      <strong>{referral.reward_given ? formatCurrency(referral.reward_amount) : "Pending"}</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="sv-referral-empty">
                <p>No referrals yet.</p>
                <span>Your signup link is ready whenever you want to share it.</span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ReferralStat({ label, value }) {
  return (
    <div className="sv-referral-stat">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
