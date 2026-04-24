import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import API from "../api/axios";
import { useToast } from "./ToastProvider";
import {
  CheckCircleIcon,
  LinkIcon,
  LoadingSpinner,
  SparkIcon,
} from "./UiIcons";
import ShareActions from "./ShareActions";

function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Never";
  }

  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InviteShareModal({ group, onClose }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [selectedLinkId, setSelectedLinkId] = useState(null);
  const [maxUses, setMaxUses] = useState("");
  const [expiresHours, setExpiresHours] = useState("");
  const [copied, setCopied] = useState(false);

  const groupId = group?.id;

  useEffect(() => {
    if (!groupId || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [groupId]);

  useEffect(() => {
    if (!groupId || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [groupId, onClose]);

  useEffect(() => {
    if (!groupId) {
      return;
    }

    let isMounted = true;

    const fetchGroupDetail = async () => {
      try {
        setLoading(true);
        const response = await API.get(`my-groups/${groupId}/`);
        if (!isMounted) {
          return;
        }

        const activeLinks = Array.isArray(response.data?.invite_links) ? response.data.invite_links : [];
        setDetail(response.data || null);
        setLinks(activeLinks);
        setSelectedLinkId((current) => current || activeLinks[0]?.id || null);
      } catch (error) {
        console.error(error);
        if (isMounted) {
          toast.error("We could not load this group's invite links right now.", {
            title: "Invite links unavailable",
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchGroupDetail();

    return () => {
      isMounted = false;
    };
  }, [groupId, toast]);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  const selectedLink = useMemo(() => {
    if (!links.length) {
      return null;
    }

    return links.find((link) => link.id === selectedLinkId) || links[0];
  }, [links, selectedLinkId]);

  const groupName = detail?.subscription_name || group?.subscription_name || "this group";
  const remainingSlots = Number(detail?.remaining_slots ?? group?.remaining_slots ?? 0);
  const canGenerate = Boolean(groupId) && detail?.status !== "closed" && remainingSlots > 0;

  if (!groupId || typeof document === "undefined") {
    return null;
  }

  const copySelectedLink = async () => {
    if (!selectedLink?.invite_url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedLink.invite_url);
      setCopied(true);
      toast.success("Link copied!", { title: "Copied" });
    } catch {
      toast.error("We could not copy that invite link right now.", { title: "Copy failed" });
    }
  };

  const generateInviteLink = async () => {
    if (!groupId) {
      return;
    }

    try {
      setGenerating(true);
      const payload = { group_id: groupId };
      if (maxUses.trim()) {
        payload.max_uses = Number(maxUses);
      }
      if (expiresHours.trim()) {
        payload.expires_in_hours = Number(expiresHours);
      }

      const response = await API.post("invite/generate/", payload);
      const nextLink = response.data;
      setLinks((current) => [nextLink, ...current.filter((item) => item.id !== nextLink.id)]);
      setSelectedLinkId(nextLink.id);
      setMaxUses("");
      setExpiresHours("");
      toast.success("Invite link created and ready to share.", { title: "Invite ready" });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || "We could not create an invite link right now.", {
        title: "Invite failed",
      });
    } finally {
      setGenerating(false);
    }
  };

  const deactivateInviteLink = async (linkId) => {
    try {
      setDeactivatingId(linkId);
      await API.post(`invite/${linkId}/deactivate/`);
      const remainingLinks = links.filter((link) => link.id !== linkId);
      setLinks(remainingLinks);
      setSelectedLinkId((current) => {
        if (current !== linkId) {
          return current;
        }

        return remainingLinks[0]?.id || null;
      });
      toast.info("Invite link deactivated.", { title: "Invite updated" });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || "We could not deactivate that invite link.", {
        title: "Deactivate failed",
      });
    } finally {
      setDeactivatingId(null);
    }
  };

  return createPortal(
    <div className="sv-modal-backdrop" role="presentation">
      <button type="button" className="sv-drawer-overlay" aria-label="Close invite modal" onClick={onClose} />

      <section className="sv-confirm-modal sv-invite-modal" role="dialog" aria-modal="true">
        <div className="sv-invite-modal-header">
          <div>
            <p className="sv-eyebrow">Invite members</p>
            <h2 className="sv-title mt-2">Share {groupName}</h2>
            <p className="sv-invite-modal-subtitle">
              Generate a link, share it anywhere, and keep an eye on which invite is still active.
            </p>
          </div>
          <button type="button" className="sv-drawer-close" onClick={onClose}>
            Done
          </button>
        </div>

        {loading ? (
          <div className="sv-invite-loading">
            <LoadingSpinner />
            <span>Loading active invite links...</span>
          </div>
        ) : (
          <>
            <div className="sv-invite-generator">
              <div className="sv-invite-generator-copy">
                <p className="sv-invite-generator-title">Create a fresh share link</p>
                <p className="sv-invite-generator-note">
                  {canGenerate
                    ? `${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} still open in this group.`
                    : "This group cannot create new invite links right now."}
                </p>
              </div>

              <div className="sv-invite-generator-grid">
                <label className="sv-profile-field">
                  <span className="sv-profile-field-label">Max uses</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={maxUses}
                    onChange={(event) => setMaxUses(event.target.value)}
                    className="sv-input"
                    disabled={!canGenerate || generating}
                  />
                </label>

                <label className="sv-profile-field">
                  <span className="sv-profile-field-label">Expires in hours</span>
                  <input
                    type="number"
                    min="1"
                    max="720"
                    placeholder="Never"
                    value={expiresHours}
                    onChange={(event) => setExpiresHours(event.target.value)}
                    className="sv-input"
                    disabled={!canGenerate || generating}
                  />
                </label>
              </div>

              <button
                type="button"
                className="sv-btn-primary"
                onClick={generateInviteLink}
                disabled={!canGenerate || generating}
              >
                {generating ? (
                  <>
                    <LoadingSpinner />
                    Generating...
                  </>
                ) : (
                  <>
                    <SparkIcon className="h-4 w-4" />
                    Generate invite link
                  </>
                )}
              </button>
            </div>

            {selectedLink ? (
              <div className="sv-invite-link-panel">
                <div className="sv-invite-link-row">
                  <label className="sv-profile-field flex-1">
                    <span className="sv-profile-field-label">Selected invite URL</span>
                    <input type="text" readOnly value={selectedLink.invite_url} className="sv-input" />
                  </label>

                  <button
                    type="button"
                    className={`sv-share-btn sv-share-btn--copy ${copied ? "is-copied" : ""}`}
                    onClick={() => {
                      void copySelectedLink();
                    }}
                  >
                    {copied ? <CheckCircleIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                    <span>{copied ? "Copied" : "Copy link"}</span>
                  </button>
                </div>

                <ShareActions
                  url={selectedLink.invite_url}
                  title={`Share ${groupName} invite`}
                  text={`Join my ${groupName} group on ShareVerse and split the cost! ${selectedLink.invite_url}`}
                  copyLabel="Copy link"
                  copySuccessMessage="Link copied!"
                  qrTitle="Scan this QR code to open the invite landing page instantly."
                  className="mt-4"
                />
              </div>
            ) : (
              <div className="sv-invite-empty">
                <p>No active invite links yet.</p>
                <span>Generate one above and it will appear here with quick share actions.</span>
              </div>
            )}

            <div className="sv-invite-links-list">
              <div className="sv-invite-links-heading">
                <p className="sv-invite-generator-title">Active links</p>
                <p className="sv-invite-generator-note">Select one to share it, or deactivate links you no longer need.</p>
              </div>

              {links.length ? (
                <div className="sv-invite-links-items">
                  {links.map((link) => (
                    <article
                      key={link.id}
                      className={`sv-invite-link-card ${selectedLink?.id === link.id ? "is-selected" : ""}`}
                    >
                      <button
                        type="button"
                        className="sv-invite-link-select"
                        onClick={() => setSelectedLinkId(link.id)}
                      >
                        <div>
                          <p className="sv-invite-link-label">
                            {link.max_uses ? `${link.use_count}/${link.max_uses} uses` : `${link.use_count} uses`}
                          </p>
                          <p className="sv-invite-link-meta">
                            Expires {link.expires_at ? formatDateTime(link.expires_at) : "Never"} | Created {formatDateTime(link.created_at)}
                          </p>
                        </div>
                        <span className="sv-invite-link-token">{String(link.token).slice(0, 8)}</span>
                      </button>

                      <button
                        type="button"
                        className="sv-btn-secondary"
                        onClick={() => {
                          void deactivateInviteLink(link.id);
                        }}
                        disabled={deactivatingId === link.id}
                      >
                        {deactivatingId === link.id ? "Deactivating..." : "Deactivate"}
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>,
    document.body
  );
}
