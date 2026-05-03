import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import API from "../api/axios";
import { getAuthToken } from "../auth/session";
import { useToast } from "../components/ToastProvider";
import {
  CheckCircleIcon,
  LoadingSpinner,
  ShieldIcon,
  SparkIcon,
} from "../components/UiIcons";

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

export default function InviteLanding() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const isAuthenticated = Boolean(getAuthToken());
  const redirectPath = useMemo(() => `/invite/${token}`, [token]);

  useEffect(() => {
    let isMounted = true;

    const fetchInviteInfo = async () => {
      try {
        setLoading(true);
        const response = await API.get(`invite/info/?token=${encodeURIComponent(token)}`);
        if (!isMounted) {
          return;
        }
        setInviteInfo(response.data || null);
        setError("");
      } catch (fetchError) {
        console.error(fetchError);
        if (!isMounted) {
          return;
        }
        setError(fetchError.response?.data?.error || "This invite link is invalid or has expired.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (token) {
      void fetchInviteInfo();
      return () => {
        isMounted = false;
      };
    }

    setLoading(false);
    setError("This invite link is missing.");

    return () => {
      isMounted = false;
    };
  }, [token]);

  const joinGroup = async () => {
    try {
      setJoining(true);
      setError("");
      await API.post("invite/accept/", { token });
      toast.success("You joined the group successfully.", { title: "Welcome in" });
      navigate("/groups", { replace: true });
    } catch (joinError) {
      console.error(joinError);
      const nextError = joinError.response?.data?.error || "We could not join that group right now.";
      setError(nextError);
      if (joinError.response?.status === 401) {
        navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`);
        return;
      }
      toast.error(nextError, { title: "Join failed" });
    } finally {
      setJoining(false);
    }
  };

  const sendToAuth = (path) => {
    navigate(`${path}?redirect=${encodeURIComponent(redirectPath)}`);
  };

  return (
    <div className="sv-page">
      <div className="sv-container max-w-5xl">
        <section className="sv-dark-hero sv-reveal sv-invite-landing-shell">
          <div className="sv-invite-landing-copy">
            <p className="sv-eyebrow-on-dark">Group invite</p>
            <h1 className="sv-display-on-dark mt-3">
              {loading
                ? "Loading your ShareVerse invite..."
                : inviteInfo
                  ? `You're invited to join ${inviteInfo.subscription_name}`
                  : "This invite link is no longer available"}
            </h1>
            <p className="sv-invite-landing-text">
              {loading
                ? "Checking the group details so you can decide whether to join."
                : inviteInfo
                  ? "Review the group, check the current status, and join with one tap if the invite is still open."
                  : "Invite links can expire, hit their use limit, or be turned off by the owner."}
            </p>

            <div className="sv-invite-landing-chips">
              <span className="sv-chip-dark">
                <SparkIcon className="h-3.5 w-3.5" />
                Public invite page
              </span>
              <span className="sv-chip-dark">
                <ShieldIcon className="h-3.5 w-3.5" />
                Auth required only to join
              </span>
            </div>
          </div>

          <div className="sv-card sv-invite-landing-card">
            {loading ? (
              <div className="sv-invite-loading">
                <LoadingSpinner />
                <span>Loading invite details...</span>
              </div>
            ) : inviteInfo ? (
              <>
                <div className="sv-invite-summary">
                  <div className="sv-invite-summary-row">
                    <span>Subscription</span>
                    <strong>{inviteInfo.subscription_name}</strong>
                  </div>
                  <div className="sv-invite-summary-row">
                    <span>Hosted by</span>
                    <strong>{inviteInfo.owner_username}</strong>
                  </div>
                  <div className="sv-invite-summary-row">
                    <span>Group mode</span>
                    <strong>{inviteInfo.mode_label}</strong>
                  </div>
                  <div className="sv-invite-summary-row">
                    <span>Status</span>
                    <strong>{inviteInfo.status_label}</strong>
                  </div>
                  <div className="sv-invite-summary-row">
                    <span>Slots available</span>
                    <strong>{inviteInfo.slots_remaining}</strong>
                  </div>
                  <div className="sv-invite-summary-row">
                    <span>Join price</span>
                    <strong>{formatCurrency(inviteInfo.join_price)}</strong>
                  </div>
                </div>

                {inviteInfo.pricing_note ? (
                  <div className="sv-invite-inline-note">
                    <CheckCircleIcon className="h-4 w-4" />
                    <span>{inviteInfo.pricing_note}</span>
                  </div>
                ) : null}

                {error ? (
                  <div className="sv-referral-alert is-error">
                    <strong>Invite needs attention</strong>
                    <span>{error}</span>
                  </div>
                ) : null}

                {isAuthenticated ? (
                  <div className="sv-invite-actions">
                    <button
                      type="button"
                      className="sv-btn-primary"
                      onClick={() => {
                        void joinGroup();
                      }}
                      disabled={!inviteInfo.is_joinable || joining}
                    >
                      {joining ? (
                        <>
                          <LoadingSpinner />
                          Joining...
                        </>
                      ) : (
                        <>
                          <SparkIcon className="h-4 w-4" />
                          Join this group
                        </>
                      )}
                    </button>
                    {!inviteInfo.is_joinable && inviteInfo.join_disabled_reason ? (
                      <p className="sv-invite-disabled-note">{inviteInfo.join_disabled_reason}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="sv-invite-actions">
                    <button type="button" className="sv-btn-primary" onClick={() => sendToAuth("/signup")}>
                      Sign up to join
                    </button>
                    <button type="button" className="sv-btn-secondary" onClick={() => sendToAuth("/login")}>
                      Log in to join
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="sv-invite-empty">
                <p>{error || "This invite link is not available anymore."}</p>
                <span>
                  {isAuthenticated ? (
                    <Link to="/groups">Browse other groups instead.</Link>
                  ) : (
                    <Link to="/">Head back to ShareVerse.</Link>
                  )}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
