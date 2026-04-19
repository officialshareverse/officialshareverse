import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import { revealGroupCredentials } from "../api/credentials";

function getInitialEditForm(group, detail = null) {
  return {
    subscription_name: detail?.subscription_name || group.subscription_name || "",
    total_slots: String(detail?.total_slots ?? group.total_slots ?? ""),
    price_per_slot: String(detail?.price_per_slot ?? group.price_per_slot ?? ""),
    access_identifier: "",
    access_password: "",
    access_notes: "",
    start_date: detail?.start_date || group.start_date || "",
    end_date: detail?.end_date || group.end_date || "",
  };
}

function getInitialProofForm(detail = null) {
  return {
    purchase_reference: detail?.purchase_proof?.purchase_reference || "",
    purchase_notes: detail?.purchase_proof?.purchase_notes || "",
    purchase_proof: null,
  };
}

function getInitialReviewForm(review = null) {
  return {
    rating: review?.rating || 5,
    comment: review?.comment || "",
  };
}

function getReviewKey(groupId, userId) {
  return `${groupId}:${userId}`;
}

function canDeleteGroup(group) {
  return group.filled_slots === 0;
}

function canCloseGroup(group) {
  if (group.status === "closed" || group.filled_slots === 0) {
    return false;
  }

  if (group.mode === "group_buy" && group.status !== "active") {
    return false;
  }

  return true;
}

function getLifecycleNote(group) {
  if (group.status === "closed") {
    return "Closed groups stay in your workspace for record-keeping and no longer accept new joins.";
  }

  if (group.status === "refunded") {
    return "This buy-together group timed out or was canceled, and held member funds have already been returned.";
  }

  if (canDeleteGroup(group)) {
    return "This group is still empty, so you can delete it completely.";
  }

  if (group.mode === "group_buy" && group.status === "proof_submitted") {
    return "Purchase proof is uploaded. Members can confirm access or report a problem, and escrow releases automatically when everyone confirms or the clean confirmation window ends.";
  }

  if (group.mode === "group_buy" && group.status === "disputed") {
    return "A member reported an access problem. Payout is paused until the issue is resolved or you refund the group.";
  }

  if (group.mode === "group_buy" && group.status !== "active") {
    return "This buy-together group has member commitments, so it must complete or refund before it can be closed.";
  }

  if (canCloseGroup(group)) {
    return "Closing stops new joins and marks the group as owner-closed.";
  }

  return null;
}

export default function MyShared() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const [groups, setGroups] = useState([]);
  const [joinedGroups, setJoinedGroups] = useState([]);
  const [filter, setFilter] = useState("all");
  const [details, setDetails] = useState({});
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [closingId, setClosingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [refundingId, setRefundingId] = useState(null);
  const [submittingProofId, setSubmittingProofId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [reportingIssueId, setReportingIssueId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [proofForms, setProofForms] = useState({});
  const [revealedCredentials, setRevealedCredentials] = useState({});
  const [revealingGroupId, setRevealingGroupId] = useState(null);
  const [reviewForms, setReviewForms] = useState({});
  const [submittingReviewKey, setSubmittingReviewKey] = useState("");
  const [expandedJoinedGroupId, setExpandedJoinedGroupId] = useState(null);

  const storeDetail = (groupId, detail, resetProofForm = false) => {
    setDetails((current) => ({
      ...current,
      [groupId]: detail,
    }));
    setProofForms((current) => {
      if (current[groupId] && !resetProofForm) {
        return current;
      }

      return {
        ...current,
        [groupId]: getInitialProofForm(detail),
      };
    });
  };

  const fetchGroups = async () => {
    try {
      const res = await API.get("my-groups/");
      setGroups(res.data);
      return res.data;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const fetchJoinedGroups = async () => {
    try {
      const res = await API.get("dashboard/");
      const nextGroups = res.data?.groups || [];
      setJoinedGroups(nextGroups);
      return nextGroups;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchJoinedGroups();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (event) => setIsMobile(event.matches);
    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const filteredGroups = useMemo(() => {
    if (filter === "all") {
      return groups;
    }
    return groups.filter((group) => group.mode === filter);
  }, [filter, groups]);

  const totals = useMemo(() => {
    return groups.reduce(
      (acc, group) => {
        acc.created += 1;
        acc.revenue += Number(group.owner_revenue || 0);
        acc.held += Number(group.held_amount || 0);
        if (
          group.mode === "group_buy" &&
          !["active", "closed", "refunding", "refunded", "failed"].includes(group.status)
        ) {
          acc.buyWaiting += 1;
        }
        if (group.mode === "sharing") {
          acc.sharing += 1;
        }
        return acc;
      },
      { created: 0, revenue: 0, held: 0, buyWaiting: 0, sharing: 0 }
    );
  }, [groups]);

  const joinedSummary = useMemo(() => {
    return joinedGroups.reduce(
      (acc, group) => {
        acc.joined += 1;
        if (group.status === "active") {
          acc.active += 1;
        }
        if (group.credentials?.available) {
          acc.readyAccess += 1;
        }
        return acc;
      },
      { joined: 0, active: 0, readyAccess: 0 }
    );
  }, [joinedGroups]);

  const summaryCards = useMemo(() => {
    if (isMobile) {
      return [
        { label: "Created", value: totals.created },
        { label: "Joined", value: joinedSummary.joined },
        { label: "Revenue", value: `Rs ${totals.revenue.toFixed(2)}`, highlight: true },
      ];
    }

    return [
      { label: "Groups created", value: totals.created },
      { label: "Groups joined", value: joinedSummary.joined },
      { label: "Sharing revenue", value: `Rs ${totals.revenue.toFixed(2)}`, highlight: true },
      { label: "Held in escrow", value: `Rs ${totals.held.toFixed(2)}` },
      { label: "Buy-together waiting", value: totals.buyWaiting },
      { label: "Active memberships", value: joinedSummary.active },
    ];
  }, [isMobile, joinedSummary.active, joinedSummary.joined, totals.buyWaiting, totals.created, totals.held, totals.revenue]);

  const toggleDetails = async (groupId) => {
    if (details[groupId]) {
      setDetails((current) => {
        const next = { ...current };
        delete next[groupId];
        return next;
      });
      return;
    }

    try {
      setLoadingDetailId(groupId);
      const res = await API.get(`my-groups/${groupId}/`);
      storeDetail(groupId, res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to load group details");
    } finally {
      setLoadingDetailId(null);
    }
  };

  const openProofPanel = async (groupId) => {
    if (details[groupId]) {
      return;
    }

    try {
      setLoadingDetailId(groupId);
      const res = await API.get(`my-groups/${groupId}/`);
      storeDetail(groupId, res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to load the proof upload panel");
    } finally {
      setLoadingDetailId(null);
    }
  };

  const confirmMemberAccess = async (groupId) => {
    try {
      setConfirmingId(groupId);
      const response = await API.post(`groups/${groupId}/confirm-access/`);
      const joinedRes = await API.get("dashboard/");
      setJoinedGroups(joinedRes.data?.groups || []);
      alert(response.data?.message || "Access confirmed successfully");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to confirm access");
    } finally {
      setConfirmingId(null);
    }
  };

  const reportAccessIssue = async (groupId) => {
    const details = window.prompt(
      "What went wrong with the access you received?",
      "I did not receive the credentials yet."
    );

    if (!details || !details.trim()) {
      return;
    }

    try {
      setReportingIssueId(groupId);
      const response = await API.post(`groups/${groupId}/report-access-issue/`, {
        details: details.trim(),
      });
      const joinedRes = await API.get("dashboard/");
      setJoinedGroups(joinedRes.data?.groups || []);
      alert(response.data?.message || "Access issue reported");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to report the access issue");
    } finally {
      setReportingIssueId(null);
    }
  };

  const refundGroup = async (group) => {
    const confirmed = window.confirm(
      "Refund all held member contributions for this buy-together group?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setRefundingId(group.id);
      await API.post(`my-groups/${group.id}/refund/`);
      const [groupsRes, detailRes, joinedRes] = await Promise.all([
        API.get("my-groups/"),
        API.get(`my-groups/${group.id}/`),
        API.get("dashboard/"),
      ]);
      setGroups(groupsRes.data);
      storeDetail(group.id, detailRes.data, true);
      setJoinedGroups(joinedRes.data?.groups || []);
      alert("Held member funds refunded successfully");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to refund held funds");
    } finally {
      setRefundingId(null);
    }
  };

  const closeGroup = async (group) => {
    const confirmed = window.confirm(
      "Close this group? It will stay in your workspace, but new members will no longer be able to join."
    );

    if (!confirmed) {
      return;
    }

    try {
      setClosingId(group.id);
      await API.post(`my-groups/${group.id}/close/`);

      const [groupsRes, detailRes] = await Promise.all([
        API.get("my-groups/"),
        API.get(`my-groups/${group.id}/`),
      ]);

      setGroups(groupsRes.data);
      storeDetail(group.id, detailRes.data, true);
      setEditingId(null);
      setEditForm(null);
      alert("Group closed successfully");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to close group");
    } finally {
      setClosingId(null);
    }
  };

  const deleteGroup = async (group) => {
    const confirmed = window.confirm(
      "Delete this empty group? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(group.id);
      await API.delete(`my-groups/${group.id}/`);

      setGroups((current) => current.filter((item) => item.id !== group.id));
      setDetails((current) => {
        const next = { ...current };
        delete next[group.id];
        return next;
      });
      setProofForms((current) => {
        const next = { ...current };
        delete next[group.id];
        return next;
      });

      if (editingId === group.id) {
        setEditingId(null);
        setEditForm(null);
      }

      alert("Group deleted successfully");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to delete group");
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = async (group) => {
    let detail = details[group.id];

    if (!detail) {
      try {
        setLoadingDetailId(group.id);
        const res = await API.get(`my-groups/${group.id}/`);
        detail = res.data;
        storeDetail(group.id, res.data);
      } catch (err) {
        console.error(err);
        alert("Failed to load group details");
        return;
      } finally {
        setLoadingDetailId(null);
      }
    }

    setEditingId(group.id);
    setEditForm(getInitialEditForm(group, detail));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleEditChange = (e) => {
    setEditForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  };

  const saveGroup = async (group) => {
    try {
      setSavingId(group.id);
      const payload = {
        subscription_name: editForm.subscription_name,
        total_slots: editForm.total_slots,
        price_per_slot: editForm.price_per_slot,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
      };

      const hasCredentialChanges =
        Boolean(editForm.access_identifier?.trim()) ||
        Boolean(editForm.access_password?.trim()) ||
        Boolean(editForm.access_notes?.trim());

      if (group.mode === "sharing" && hasCredentialChanges) {
        const hasIdentifier = Boolean(editForm.access_identifier?.trim());
        const hasPassword = Boolean(editForm.access_password?.trim());
        const hasNotes = Boolean(editForm.access_notes?.trim());

        if (hasIdentifier !== hasPassword) {
          alert("To update credentials, provide both login identifier and password.");
          setSavingId(null);
          return;
        }

        if (hasIdentifier && hasPassword) {
          payload.access_identifier = editForm.access_identifier;
          payload.access_password = editForm.access_password;
          payload.access_notes = editForm.access_notes;
        } else if (hasNotes) {
          payload.access_notes = editForm.access_notes;
        }
      }

      await API.patch(`my-groups/${group.id}/`, payload);

      const groupsRes = await API.get("my-groups/");
      setGroups(groupsRes.data);

      if (details[group.id]) {
        const detailRes = await API.get(`my-groups/${group.id}/`);
        storeDetail(group.id, detailRes.data, true);
      }

      setEditingId(null);
      setEditForm(null);
      alert("Group updated successfully");
    } catch (err) {
      console.error(err);
      const errorData = err.response?.data;
      const firstError = errorData && typeof errorData === "object"
        ? Object.values(errorData)[0]
        : null;
      alert(Array.isArray(firstError) ? firstError[0] : "Failed to update group");
    } finally {
      setSavingId(null);
    }
  };

  const revealCredentials = async (groupId) => {
    try {
      setRevealingGroupId(groupId);
      const credentials = await revealGroupCredentials(groupId);
      setRevealedCredentials((current) => ({
        ...current,
        [groupId]: credentials,
      }));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to reveal credentials");
    } finally {
      setRevealingGroupId(null);
    }
  };

  const handleProofChange = (groupId, field, value) => {
    setProofForms((current) => ({
      ...current,
      [groupId]: {
        ...(current[groupId] || getInitialProofForm(details[groupId])),
        [field]: value,
      },
    }));
  };

  const handleReviewChange = (groupId, userId, field, value, existingReview = null) => {
    const reviewKey = getReviewKey(groupId, userId);
    setReviewForms((current) => ({
      ...current,
      [reviewKey]: {
        ...(current[reviewKey] || getInitialReviewForm(existingReview)),
        [field]: value,
      },
    }));
  };

  const submitReview = async ({ groupId, reviewedUserId, existingReview = null, refreshDetail = false }) => {
    const reviewKey = getReviewKey(groupId, reviewedUserId);
    const currentForm = reviewForms[reviewKey] || getInitialReviewForm(existingReview);

    try {
      setSubmittingReviewKey(reviewKey);
      const response = await API.post(`groups/${groupId}/reviews/`, {
        reviewed_user_id: reviewedUserId,
        rating: Number(currentForm.rating),
        comment: currentForm.comment.trim(),
      });

      if (refreshDetail) {
        const detailRes = await API.get(`my-groups/${groupId}/`);
        storeDetail(groupId, detailRes.data);
      } else {
        const joinedRes = await API.get("dashboard/");
        setJoinedGroups(joinedRes.data?.groups || []);
      }

      setReviewForms((current) => ({
        ...current,
        [reviewKey]: getInitialReviewForm(response.data?.review),
      }));
      alert(response.data?.message || "Rating saved successfully");
    } catch (err) {
      console.error(err);
      const errorData = err.response?.data;
      const firstError =
        errorData && typeof errorData === "object" ? Object.values(errorData)[0] : null;
      alert(
        Array.isArray(firstError)
          ? firstError[0]
          : err.response?.data?.error || "Failed to save your rating"
      );
    } finally {
      setSubmittingReviewKey("");
    }
  };

  const submitPurchaseProof = async (groupId) => {
    const currentProofForm = proofForms[groupId] || getInitialProofForm(details[groupId]);

    if (!currentProofForm.purchase_proof) {
      alert("Select a proof file before uploading.");
      return;
    }

    try {
      setSubmittingProofId(groupId);
      const formData = new FormData();
      formData.append("purchase_proof", currentProofForm.purchase_proof);
      if (currentProofForm.purchase_reference?.trim()) {
        formData.append("purchase_reference", currentProofForm.purchase_reference.trim());
      }
      if (currentProofForm.purchase_notes?.trim()) {
        formData.append("purchase_notes", currentProofForm.purchase_notes.trim());
      }

      await API.post(`my-groups/${groupId}/submit-proof/`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const [groupsRes, detailRes] = await Promise.all([
        API.get("my-groups/"),
        API.get(`my-groups/${groupId}/`),
      ]);
      setGroups(groupsRes.data);
      storeDetail(groupId, detailRes.data, true);
      alert("Purchase proof uploaded successfully");
    } catch (err) {
      console.error(err);
      const errorData = err.response?.data;
      const firstError = errorData && typeof errorData === "object"
        ? Object.values(errorData)[0]
        : null;
      alert(Array.isArray(firstError) ? firstError[0] : err.response?.data?.error || "Failed to upload purchase proof");
    } finally {
      setSubmittingProofId(null);
    }
  };

  return (
    <div style={{ ...container, ...(isMobile ? containerMobile : {}) }}>
      <div style={{ ...pageShell, ...(isMobile ? pageShellMobile : {}) }}>
      <div style={{ ...hero, ...(isMobile ? heroMobile : {}) }}>
        <p style={eyebrow}>My splits</p>
        <h2 style={{ ...heroTitle, ...(isMobile ? heroTitleMobile : {}) }}>See the splits you created and the splits you joined</h2>
        {!isMobile ? (
        <p style={heroText}>
          Manage the splits you host, keep track of your memberships, and follow access status from one place.
        </p>
        ) : null}
      </div>

      <div style={{ ...statsGrid, ...(isMobile ? statsGridMobile : {}) }}>
        {summaryCards.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} highlight={item.highlight} compact={isMobile} />
        ))}
      </div>

      <div style={{ ...sectionHeader, ...(isMobile ? sectionHeaderMobile : {}) }}>
        <div>
          <p style={sectionEyebrow}>Created splits</p>
          <h3 style={{ ...sectionTitle, ...(isMobile ? sectionTitleMobile : {}) }}>Splits you host</h3>
        </div>
        {!isMobile ? (
          <p style={sectionText}>Your owner tools stay here, including proof upload, member-confirmation tracking, refunds, edits, closure, and cleanup.</p>
        ) : null}
      </div>

      <div style={{ ...filterRow, ...(isMobile ? filterRowMobile : {}) }}>
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")} compact={isMobile}>All</FilterButton>
        <FilterButton active={filter === "sharing"} onClick={() => setFilter("sharing")} compact={isMobile}>{isMobile ? "Sharing" : "Share existing plan"}</FilterButton>
        <FilterButton active={filter === "group_buy"} onClick={() => setFilter("group_buy")} compact={isMobile}>Buy together</FilterButton>
      </div>

      {filteredGroups.length === 0 ? (
        <p>No groups created yet.</p>
      ) : (
        filteredGroups.map((group) => {
          const detail = details[group.id];
          const isEditing = editingId === group.id;
          const hasMembers = group.filled_slots > 0;
          const lifecycleNote = getLifecycleNote(group);
          const proofForm = proofForms[group.id] || getInitialProofForm(detail);
          const showAdvancedOwnerActions = !isMobile || Boolean(detail) || isEditing;

          return (
            <div key={group.id} style={{ ...card, ...(isMobile ? cardMobile : {}) }}>
              <div style={{ ...cardHeader, ...(isMobile ? cardHeaderMobile : {}) }}>
                <div>
                  <h3 style={{ margin: 0 }}>{group.subscription_name}</h3>
                  <p style={cardSubheading}>{group.mode_label}</p>
                </div>
                <span style={badge}>{group.status_label}</span>
              </div>

              <div style={{ ...factsRow, ...(isMobile ? factsRowMobile : {}) }}>
                <FactPill label="Per member" value={`Rs ${group.price_per_slot}`} />
                <FactPill label="Filled" value={`${group.filled_slots} / ${group.total_slots}`} />
                {!isMobile ? (
                <FactPill
                  label={group.mode === "group_buy" ? "Paid" : "Revenue"}
                  value={group.mode === "group_buy" ? `${group.paid_members} / ${group.total_slots}` : `Rs ${group.owner_revenue}`}
                />
                ) : null}
                {!isMobile ? (
                <FactPill
                  label={group.mode === "group_buy" ? "Held" : "Window"}
                  value={group.mode === "group_buy" ? `Rs ${group.held_amount || "0.00"}` : `${group.start_date} to ${group.end_date}`}
                  tone={group.mode === "group_buy" ? "warning" : "default"}
                />
                ) : null}
                {group.unread_chat_count ? (
                  <FactPill label="Chat" value={`${group.unread_chat_count} new`} tone="accent" />
                ) : null}
              </div>

              <p style={descriptionText}>{group.next_action}</p>
              {!isMobile ? (
              <p style={metaLine}>
                Created {new Date(group.created_at).toLocaleDateString()}
                {group.mode === "group_buy" ? " | Buy-together timeline" : " | Sharing timeline"}
              </p>
              ) : null}
              {!isMobile && lifecycleNote ? <p style={managementNote(group.status === "closed")}>{lifecycleNote}</p> : null}
              {!isMobile && group.mode === "group_buy" && group.can_submit_proof ? (
                <p style={proofReadyNotice}>
                  {group.has_purchase_proof
                    ? "Purchase proof is ready to manage below."
                    : "All members have joined. Upload purchase proof to move this group into member confirmation."}
                </p>
              ) : null}

              <div style={progressBar}>
                <div
                  style={{
                    ...progressFill,
                    width: `${group.progress_percent}%`,
                  }}
                />
              </div>

              <div style={{ ...actionRow, ...(isMobile ? actionRowMobile : {}) }}>
                <button style={{ ...secondaryButton, ...(isMobile ? actionButtonMobile : {}) }} onClick={() => toggleDetails(group.id)}>
                  {loadingDetailId === group.id ? "Loading..." : detail ? (isMobile ? "Hide details" : "Hide members") : (isMobile ? "Manage" : "View members")}
                </button>

                {hasMembers ? (
                  <button
                    style={{ ...secondaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                    onClick={() => navigate(`/groups/${group.id}/chat`)}
                  >
                    {group.unread_chat_count ? (isMobile ? `Chat (${group.unread_chat_count})` : `Open group chat (${group.unread_chat_count} new)`) : isMobile ? "Chat" : "Open group chat"}
                  </button>
                ) : null}

                {!isEditing && group.mode === "group_buy" && group.can_submit_proof ? (
                  <button
                    style={{ ...primaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                    onClick={() => openProofPanel(group.id)}
                    disabled={loadingDetailId === group.id}
                  >
                    {loadingDetailId === group.id
                      ? "Opening..."
                      : group.has_purchase_proof
                        ? isMobile ? "Proof" : "Manage proof"
                        : isMobile ? "Upload proof" : "Upload purchase proof"}
                  </button>
                ) : null}

                {isEditing ? (
                  <>
                    <button
                      style={{ ...secondaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                      onClick={cancelEditing}
                      disabled={savingId === group.id}
                    >
                      Cancel edit
                    </button>
                    <button
                      style={{ ...primaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                      onClick={() => saveGroup(group)}
                      disabled={savingId === group.id}
                    >
                      {savingId === group.id ? "Saving..." : "Save changes"}
                    </button>
                  </>
                ) : (
                  showAdvancedOwnerActions && group.status !== "closed" ? (
                    <button style={{ ...secondaryButton, ...(isMobile ? actionButtonMobile : {}) }} onClick={() => startEditing(group)}>
                      Edit group
                    </button>
                  ) : null
                )}

                {showAdvancedOwnerActions && !isEditing && detail?.can_refund ? (
                  <button
                    style={{ ...dangerButton, ...(isMobile ? actionButtonMobile : {}) }}
                    onClick={() => refundGroup(group)}
                    disabled={refundingId === group.id}
                  >
                    {refundingId === group.id ? "Refunding..." : "Refund members"}
                  </button>
                ) : null}

                {showAdvancedOwnerActions && !isEditing && canCloseGroup(group) ? (
                  <button
                    style={{ ...warningButton, ...(isMobile ? actionButtonMobile : {}) }}
                    onClick={() => closeGroup(group)}
                    disabled={closingId === group.id}
                  >
                    {closingId === group.id ? "Closing..." : "Close group"}
                  </button>
                ) : null}

                {showAdvancedOwnerActions && !isEditing && canDeleteGroup(group) ? (
                  <button
                    style={{ ...dangerButton, ...(isMobile ? actionButtonMobile : {}) }}
                    onClick={() => deleteGroup(group)}
                    disabled={deletingId === group.id}
                  >
                    {deletingId === group.id ? "Deleting..." : "Delete empty group"}
                  </button>
                ) : null}
              </div>

              {isEditing ? (
                <div style={editPanel}>
                  <div style={editPanelHeader}>
                    <h4 style={{ margin: 0 }}>Edit group details</h4>
                    <p style={subtleText}>
                      Core commercial fields lock once members join to avoid breaking existing joins and payments.
                    </p>
                  </div>

                  <div style={formGrid}>
                    <label style={field}>
                      <span style={fieldLabel}>Subscription name</span>
                      <input
                        type="text"
                        name="subscription_name"
                        value={editForm.subscription_name}
                        onChange={handleEditChange}
                        disabled={hasMembers}
                        style={input(hasMembers)}
                      />
                    </label>

                    <label style={field}>
                      <span style={fieldLabel}>Total slots</span>
                      <input
                        type="number"
                        name="total_slots"
                        min={group.filled_slots || 1}
                        value={editForm.total_slots}
                        onChange={handleEditChange}
                        style={input(false)}
                      />
                    </label>

                    <label style={field}>
                      <span style={fieldLabel}>
                        {group.mode === "sharing" ? "Price per slot" : "Contribution per member"}
                      </span>
                      <input
                        type="number"
                        name="price_per_slot"
                        min="1"
                        step="0.01"
                        value={editForm.price_per_slot}
                        onChange={handleEditChange}
                        disabled={hasMembers}
                        style={input(hasMembers)}
                      />
                    </label>

                    <label style={field}>
                      <span style={fieldLabel}>Start date</span>
                      <input
                        type="date"
                        name="start_date"
                        value={editForm.start_date}
                        onChange={handleEditChange}
                        style={input(false)}
                      />
                    </label>

                    <label style={field}>
                      <span style={fieldLabel}>End date</span>
                      <input
                        type="date"
                        name="end_date"
                        value={editForm.end_date}
                        onChange={handleEditChange}
                        style={input(false)}
                      />
                    </label>
                  </div>

                  {group.mode === "sharing" ? (
                    <div style={credentialEditPanel}>
                      <div style={editPanelHeader}>
                        <h4 style={{ margin: 0 }}>Member access credentials</h4>
                        <p style={subtleText}>
                          Add new values here only when credentials change. If you leave all three fields blank, existing credentials stay unchanged.
                        </p>
                      </div>

                      <div style={formGrid}>
                        <label style={field}>
                          <span style={fieldLabel}>Login email or username</span>
                          <input
                            type="text"
                            name="access_identifier"
                            value={editForm.access_identifier}
                            onChange={handleEditChange}
                            style={input(false)}
                          />
                        </label>

                        <label style={field}>
                          <span style={fieldLabel}>Password</span>
                          <input
                            type="text"
                            name="access_password"
                            value={editForm.access_password}
                            onChange={handleEditChange}
                            style={input(false)}
                          />
                        </label>

                        <label style={{ ...field, gridColumn: "1 / -1" }}>
                          <span style={fieldLabel}>Access notes</span>
                          <textarea
                            name="access_notes"
                            value={editForm.access_notes}
                            onChange={handleEditChange}
                            style={textarea}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {hasMembers ? (
                    <p style={lockedNote}>
                      Members have already joined this group, so subscription name and price are locked. You can still update the shared access credentials if they change.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {detail ? (
                <div style={{ ...detailPanel, ...(isMobile ? detailPanelMobile : {}) }}>
                  <div style={{ ...detailGridLayout, ...(isMobile ? detailGridLayoutMobile : {}) }}>
                    <div style={{ ...detailSectionCard, ...(isMobile ? detailSectionCardMobile : {}) }}>
                      <div style={detailSectionHeader}>
                        <div>
                          <p style={detailEyebrow}>Overview</p>
                          <h4 style={{ ...detailSectionTitle, ...(isMobile ? detailSectionTitleMobile : {}) }}>Group snapshot</h4>
                        </div>
                      </div>

                      <div style={{ ...detailStats, ...(isMobile ? detailStatsMobile : {}) }}>
                        <MetricBlock label={isMobile ? "Filled" : "Filled members"} value={`${detail.filled_slots} / ${detail.total_slots}`} />
                        {!isMobile ? (
                          <MetricBlock label="Paid members" value={`${detail.paid_members} / ${detail.total_slots}`} />
                        ) : null}
                        <MetricBlock label={isMobile ? "Stage" : "Current stage"} value={detail.status_label} />
                        <MetricBlock
                          label={detail.mode === "group_buy" ? (isMobile ? "Released" : "Released amount") : (isMobile ? "Revenue" : "Released amount")}
                          value={detail.mode === "group_buy" ? `Rs ${detail.released_amount}` : `Rs ${detail.owner_revenue}`}
                        />
                        {detail.mode === "group_buy" ? (
                          <>
                            <MetricBlock label={isMobile ? "Confirmed" : "Confirmed access"} value={`${detail.confirmed_members} / ${detail.paid_members}`} />
                            {!isMobile ? (
                              <>
                                <MetricBlock label="Reported issues" value={detail.reported_issues} />
                                <MetricBlock label="Held amount" value={`Rs ${detail.held_amount}`} />
                              </>
                            ) : null}
                          </>
                        ) : null}
                      </div>

                      {detail.mode === "group_buy" ? (
                        <div style={{ ...buyTogetherNotice, marginBottom: 0 }}>
                          <p style={buyTogetherNoticeTitle}>Buy-together escrow</p>
                          <p style={{ ...subtleText, ...(isMobile ? subtleTextCompact : {}) }}>
                            Holds stay protected until proof is uploaded and members confirm access or raise an issue.
                          </p>
                          {!isMobile ? (
                            <>
                              <p style={subtleText}>
                                Confirmation deadline: {detail.purchase_deadline_at ? new Date(detail.purchase_deadline_at).toLocaleString() : "Not set yet"}
                              </p>
                              <p style={subtleText}>
                                Remaining confirmations: {detail.remaining_confirmations}
                              </p>
                            </>
                          ) : detail.purchase_deadline_at ? (
                            <p style={{ ...subtleText, ...(isMobile ? subtleTextCompact : {}) }}>
                              Deadline: {new Date(detail.purchase_deadline_at).toLocaleDateString()}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p style={{ ...subtleText, ...(isMobile ? subtleTextCompact : {}) }}>
                          Use this space to manage your group, keep access coordination clear, and watch for member confirmations before payouts reach your wallet.
                        </p>
                      )}
                    </div>

                    {detail.mode === "group_buy" ? (
                      <div style={{ ...detailSectionCard, ...(isMobile ? detailSectionCardMobile : {}) }}>
                        <div style={detailSectionHeader}>
                          <div>
                            <p style={detailEyebrow}>Proof</p>
                            <h4 style={{ ...detailSectionTitle, ...(isMobile ? detailSectionTitleMobile : {}) }}>Purchase details</h4>
                          </div>
                        </div>

                        <p style={{ ...subtleText, ...(isMobile ? subtleTextCompact : {}) }}>
                          {isMobile
                            ? "Upload proof after purchase so member confirmations can begin."
                            : "Upload an invoice, receipt, or screenshot after you buy the subscription. Payout stays protected until confirmations are complete."}
                        </p>

                        {detail.purchase_proof?.available ? (
                          <div style={proofSummary}>
                            <p style={proofMeta}>
                              Uploaded: {detail.purchase_proof.submitted_at ? new Date(detail.purchase_proof.submitted_at).toLocaleString() : "Just now"}
                            </p>
                            {detail.purchase_proof.purchase_reference ? (
                              <p style={proofMeta}>Reference: {detail.purchase_proof.purchase_reference}</p>
                            ) : null}
                            {!isMobile && detail.purchase_proof.purchase_notes ? (
                              <p style={proofMeta}>Notes: {detail.purchase_proof.purchase_notes}</p>
                            ) : null}
                            {detail.purchase_proof.file_url ? (
                              <a
                                href={detail.purchase_proof.file_url}
                                target="_blank"
                                rel="noreferrer"
                                style={proofLink}
                              >
                                Open uploaded proof
                              </a>
                            ) : null}
                          </div>
                        ) : (
                          <p style={proofWarning}>
                            No proof uploaded yet. If the purchase deadline passes first, member funds are refunded automatically.
                          </p>
                        )}

                        {detail.status === "proof_submitted" && detail.remaining_confirmations > 0 ? (
                          <p style={proofPending}>
                            Waiting for {detail.remaining_confirmations} member confirmation(s). Auto-release will happen only if the window ends without a dispute.
                          </p>
                        ) : null}

                        {detail.status === "disputed" ? (
                          <p style={proofWarning}>
                            {detail.reported_issues} member(s) reported an access issue. Payout is paused until the issue is resolved or refunded.
                          </p>
                        ) : null}

                        {detail.status === "active" ? (
                          <p style={proofApproved}>
                            All confirmations are complete and the escrow payout has already been released.
                          </p>
                        ) : null}

                        {detail.can_submit_proof ? (
                          <div style={proofFormCard}>
                            <div style={formGrid}>
                              <label style={field}>
                                <span style={fieldLabel}>Purchase reference</span>
                                <input
                                  type="text"
                                  value={proofForm.purchase_reference}
                                  onChange={(e) => handleProofChange(group.id, "purchase_reference", e.target.value)}
                                  style={input(false)}
                                />
                              </label>

                              <label style={field}>
                                <span style={fieldLabel}>Proof file</span>
                                <input
                                  type="file"
                                  accept="image/*,.pdf,.txt"
                                  onChange={(e) => handleProofChange(group.id, "purchase_proof", e.target.files?.[0] || null)}
                                  style={fileInput}
                                />
                              </label>

                              <label style={{ ...field, gridColumn: "1 / -1" }}>
                                <span style={fieldLabel}>Notes for the group</span>
                                <textarea
                                  value={proofForm.purchase_notes}
                                  onChange={(e) => handleProofChange(group.id, "purchase_notes", e.target.value)}
                                  style={textarea}
                                />
                              </label>
                            </div>

                            <div style={{ ...actionRow, ...(isMobile ? actionRowMobile : {}) }}>
                              <button
                                style={{ ...primaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                                onClick={() => submitPurchaseProof(group.id)}
                                disabled={submittingProofId === group.id}
                              >
                                {submittingProofId === group.id ? "Uploading..." : detail.purchase_proof?.available ? "Replace proof" : "Upload proof"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : detail.credentials ? (
                      <div style={{ ...detailSectionCard, ...(isMobile ? detailSectionCardMobile : {}) }}>
                        <div style={detailSectionHeader}>
                          <div>
                            <p style={detailEyebrow}>Access</p>
                            <h4 style={{ ...detailSectionTitle, ...(isMobile ? detailSectionTitleMobile : {}) }}>Owner credential panel</h4>
                          </div>
                        </div>

                        <div style={{ ...ownerCredentialCard, marginBottom: 0 }}>
                          <p style={ownerCredentialEyebrow}>Shared access</p>
                          {detail.credentials.available ? (
                            revealedCredentials[group.id] ? (
                              <>
                                <p style={ownerCredentialLine}>
                                  Login: <strong>{revealedCredentials[group.id].login_identifier}</strong>
                                </p>
                                <p style={ownerCredentialLine}>
                                  Password: <strong>{revealedCredentials[group.id].password}</strong>
                                </p>
                                {revealedCredentials[group.id].notes ? (
                                  <p style={subtleText}>Notes: {revealedCredentials[group.id].notes}</p>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <p style={subtleText}>{detail.credentials.message}</p>
                                <button
                                  style={primaryButton}
                                  onClick={() => revealCredentials(group.id)}
                                  disabled={revealingGroupId === group.id}
                                >
                                  {revealingGroupId === group.id ? "Revealing..." : "Reveal once"}
                                </button>
                              </>
                            )
                          ) : (
                            <p style={subtleText}>Add the subscription login details so you can manage the sharing plan cleanly.</p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div style={{ ...detailSectionCard, ...(isMobile ? detailSectionCardMobile : {}), gridColumn: "1 / -1" }}>
                      <div style={detailSectionHeader}>
                        <div>
                          <p style={detailEyebrow}>Members</p>
                          <h4 style={{ ...detailSectionTitle, ...(isMobile ? detailSectionTitleMobile : {}) }}>People in this group</h4>
                        </div>
                      </div>

                      {detail.members.length === 0 ? (
                        <p style={subtleText}>No members have joined yet.</p>
                      ) : (
                        <div style={membersList}>
                          {detail.members.map((member) => {
                            const memberLabel = getEscrowLabel(member, detail.status);
                            const reviewKey = getReviewKey(detail.id, member.user_id);
                            const reviewForm =
                              reviewForms[reviewKey] || getInitialReviewForm(member.rating?.my_review);

                            return (
                              <div key={member.id} style={{ ...memberRow, ...(isMobile ? memberRowMobile : {}) }}>
                                <div style={{ flex: 1 }}>
                                  <p style={memberName}>{member.username}</p>
                                  {!isMobile ? (
                                    <p style={memberMeta}>Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                                  ) : null}
                                  <p style={memberMeta}>Charged Rs {member.charged_amount || group.price_per_slot}</p>
                                  {!isMobile ? (
                                    <p style={memberMeta}>
                                      {member.rating?.average_rating
                                        ? `${member.rating.average_rating.toFixed(1)} / 5 from ${member.rating.review_count} review${member.rating.review_count === 1 ? "" : "s"}`
                                        : "No ratings yet"}
                                    </p>
                                  ) : null}
                                  {member.access_issue_reported && member.access_issue_notes ? (
                                    <p style={memberIssueText}>Reported issue: {member.access_issue_notes}</p>
                                  ) : null}
                                  {detail.can_rate_members ? (
                                    <div style={reviewCard}>
                                      <p style={reviewTitle}>Rate this member</p>
                                      <StarPicker
                                        value={Number(reviewForm.rating)}
                                        onChange={(value) =>
                                          handleReviewChange(
                                            detail.id,
                                            member.user_id,
                                            "rating",
                                            value,
                                            member.rating?.my_review
                                          )
                                        }
                                      />
                                      <textarea
                                        style={reviewTextarea}
                                        value={reviewForm.comment}
                                        onChange={(event) =>
                                          handleReviewChange(
                                            detail.id,
                                            member.user_id,
                                            "comment",
                                            event.target.value,
                                            member.rating?.my_review
                                          )
                                        }
                                        placeholder="How was this member to coordinate with?"
                                      />
                                      <button
                                        style={secondaryButton}
                                        onClick={() =>
                                          submitReview({
                                            groupId: detail.id,
                                            reviewedUserId: member.user_id,
                                            existingReview: member.rating?.my_review,
                                            refreshDetail: true,
                                          })
                                        }
                                        disabled={submittingReviewKey === reviewKey}
                                      >
                                        {submittingReviewKey === reviewKey
                                          ? "Saving..."
                                          : member.rating?.my_review
                                            ? "Update rating"
                                            : "Save rating"}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                                <div style={{ textAlign: isMobile ? "left" : "right", width: isMobile ? "100%" : "auto" }}>
                                  <span style={memberStatus(memberLabel)}>
                                    {memberLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      )}

      <div style={{ ...joinedSectionHeader, ...(isMobile ? sectionHeaderMobile : {}) }}>
        <div>
          <p style={sectionEyebrow}>Joined groups</p>
          <h3 style={{ ...sectionTitle, ...(isMobile ? sectionTitleMobile : {}) }}>Subscriptions you are part of</h3>
        </div>
        {!isMobile ? (
          <p style={sectionText}>This section shows the groups you joined as a member, including join status, confirmations, and owner coordination updates.</p>
        ) : null}
      </div>

      {joinedGroups.length === 0 ? (
        <p>You have not joined any groups yet.</p>
      ) : (
        <div style={{ ...joinedGrid, ...(isMobile ? joinedGridMobile : {}) }}>
          {joinedGroups.map((group) => {
            const reviewTarget = group.owner_rating;
            const reviewKey = getReviewKey(group.id, group.owner_id);
            const reviewForm =
              reviewForms[reviewKey] || getInitialReviewForm(reviewTarget?.my_review);
            const isJoinedExpanded = expandedJoinedGroupId === group.id;

            return (
              <div key={group.id} style={{ ...joinedCard, ...(isMobile ? joinedCardMobile : {}) }}>
                <div style={{ ...cardHeader, ...(isMobile ? cardHeaderMobile : {}) }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{group.subscription_name}</h3>
                    <p style={cardSubheading}>{group.mode_label}</p>
                  </div>
                  <span style={badge}>{group.status_label}</span>
                </div>

                <div style={{ ...factsRow, ...(isMobile ? factsRowMobile : {}) }}>
                  {!isMobile ? <FactPill label="Role" value="Member" /> : null}
                  <FactPill
                    label={group.is_prorated ? "You paid" : "Per member"}
                    value={`Rs ${group.charged_amount || group.price_per_slot}`}
                  />
                  {group.unread_chat_count ? (
                    <FactPill label="Chat" value={`${group.unread_chat_count} new`} tone="accent" />
                  ) : null}
                </div>

                {group.is_prorated && group.pricing_note ? (
                  <p style={{ ...subtleText, ...(isMobile ? subtleTextCompact : {}), marginTop: "12px" }}>
                    {group.pricing_note} Full cycle price: Rs {group.price_per_slot}.
                  </p>
                ) : null}

                <div style={{ ...actionRow, ...(isMobile ? actionRowMobile : {}), marginTop: "16px" }}>
                  <button
                    style={{ ...secondaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                    onClick={() => navigate(`/groups/${group.id}/chat`)}
                  >
                    {group.unread_chat_count ? (isMobile ? `Chat (${group.unread_chat_count})` : `Open group chat (${group.unread_chat_count} new)`) : isMobile ? "Open chat" : "Open group chat"}
                  </button>
                  {isMobile ? (
                    <button
                      style={{ ...secondaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                      onClick={() => setExpandedJoinedGroupId((current) => (current === group.id ? null : group.id))}
                    >
                      {isJoinedExpanded ? "Less details" : "More details"}
                    </button>
                  ) : null}
                </div>

                {!isMobile || isJoinedExpanded ? (
                <div style={{ ...reviewCard, ...(isMobile ? reviewCardMobile : {}) }}>
                  <p style={reviewTitle}>Rate the creator</p>
                  <p style={subtleText}>
                    {group.owner_name}
                    {reviewTarget?.average_rating
                      ? ` | ${reviewTarget.average_rating.toFixed(1)} / 5 from ${reviewTarget.review_count} review${reviewTarget.review_count === 1 ? "" : "s"}`
                      : " | No ratings yet"}
                  </p>
                  {reviewTarget?.can_review ? (
                    <>
                      <StarPicker
                        value={Number(reviewForm.rating)}
                        onChange={(value) =>
                          handleReviewChange(
                            group.id,
                            group.owner_id,
                            "rating",
                            value,
                            reviewTarget?.my_review
                          )
                        }
                      />
                      <textarea
                        style={reviewTextarea}
                        value={reviewForm.comment}
                        onChange={(event) =>
                          handleReviewChange(
                            group.id,
                            group.owner_id,
                            "comment",
                            event.target.value,
                            reviewTarget?.my_review
                          )
                        }
                        placeholder="How was the creator to coordinate with?"
                      />
                      <button
                        style={secondaryButton}
                        onClick={() =>
                          submitReview({
                            groupId: group.id,
                            reviewedUserId: group.owner_id,
                            existingReview: reviewTarget?.my_review,
                          })
                        }
                        disabled={submittingReviewKey === reviewKey}
                      >
                        {submittingReviewKey === reviewKey
                          ? "Saving..."
                          : reviewTarget?.my_review
                            ? "Update rating"
                            : "Save rating"}
                      </button>
                    </>
                  ) : group.status === "active" || group.status === "closed" ? (
                    <p style={proofApproved}>Your rating is already saved for this group experience.</p>
                  ) : (
                    <p style={subtleText}>Ratings open after the group becomes active.</p>
                  )}
                </div>
                ) : null}

                <div style={{ ...memberAccessCard(false), ...(isMobile ? memberAccessCardMobile : {}) }}>
                  <p style={ownerCredentialEyebrow}>
                    {group.mode === "group_buy" ? "Buy-together access" : "Access coordination"}
                  </p>
                  {group.mode === "group_buy" ? (
                    <>
                      <p style={{ ...subtleText, ...(isMobile ? subtleTextCompact : {}) }}>
                        {group.status === "awaiting_purchase"
                          ? "The creator still needs to buy the subscription and coordinate access."
                          : group.status === "proof_submitted"
                            ? "The creator says access has been coordinated off-platform. Confirm when you receive it."
                            : group.status === "disputed"
                              ? "An access issue was reported. Payout is paused while the creator resolves it or refunds the group."
                            : group.status === "active"
                              ? "Your confirmation was collected and the buy-together group is active."
                              : "Access is being coordinated by the group creator."}
                      </p>
                      {!isMobile || isJoinedExpanded ? (
                      <p style={subtleText}>
                        Confirmed members: {group.confirmed_members || 0}
                        {group.remaining_confirmations !== undefined ? ` | Remaining: ${group.remaining_confirmations}` : ""}
                      </p>
                      ) : null}
                      {(!isMobile || isJoinedExpanded) && group.reported_issues ? (
                        <p style={subtleText}>Reported issues: {group.reported_issues}</p>
                      ) : null}
                      {group.has_reported_access_issue && !group.has_confirmed_access ? (
                        <p style={proofWarning}>
                          You reported an access issue. Confirm once it is fixed, or wait for the creator to refund the group.
                        </p>
                      ) : null}
                      {group.status === "disputed" && !group.has_reported_access_issue ? (
                        <p style={proofWarning}>
                          Payout is paused because a member reported an access issue.
                        </p>
                      ) : null}
                      {group.access_confirmation_required ? (
                        group.has_confirmed_access ? (
                          <p style={proofApproved}>You already confirmed that you received access.</p>
                        ) : (
                          <div style={{ ...actionRow, ...(isMobile ? actionRowMobile : {}) }}>
                            <button
                              style={{ ...primaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                              onClick={() => confirmMemberAccess(group.id)}
                              disabled={confirmingId === group.id}
                            >
                              {confirmingId === group.id
                                ? "Confirming..."
                                : group.has_reported_access_issue
                                  ? "Issue fixed, confirm access"
                                  : "I received access"}
                            </button>
                            {group.can_report_access_issue ? (
                              <button
                                style={{ ...dangerButton, ...(isMobile ? actionButtonMobile : {}) }}
                                onClick={() => reportAccessIssue(group.id)}
                                disabled={reportingIssueId === group.id}
                              >
                                {reportingIssueId === group.id ? "Reporting..." : "Report issue"}
                              </button>
                            ) : null}
                          </div>
                        )
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p style={{ ...subtleText, ...(isMobile ? subtleTextCompact : {}) }}>
                        Access is coordinated privately by the host after you join.
                      </p>
                      {!isMobile || isJoinedExpanded ? (
                      <p style={subtleText}>
                        Confirm access once the host has set you up. The host payout is released only after your confirmation.
                      </p>
                      ) : null}
                      {group.access_confirmation_required ? (
                        group.has_confirmed_access ? (
                          <p style={proofApproved}>You already confirmed that you received access.</p>
                        ) : (
                          <div style={{ ...actionRow, ...(isMobile ? actionRowMobile : {}) }}>
                            <button
                              style={{ ...primaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                              onClick={() => confirmMemberAccess(group.id)}
                              disabled={confirmingId === group.id}
                            >
                              {confirmingId === group.id ? "Confirming..." : "I received access"}
                            </button>
                          </div>
                        )
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight = false, compact = false }) {
  return (
    <div style={{ ...summaryCard, ...(compact ? summaryCardMobile : {}) }}>
      <p style={{ ...summaryLabel, ...(compact ? summaryLabelMobile : {}) }}>{label}</p>
      <p style={{ ...summaryValue, ...(compact ? summaryValueMobile : {}), color: highlight ? "#047857" : "#0f172a" }}>{value}</p>
    </div>
  );
}

function FilterButton({ active, onClick, children, compact = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...filterButton,
        ...(compact ? filterButtonCompact : {}),
        background: active ? "#0f172a" : "#e2e8f0",
        color: active ? "#fff" : "#0f172a",
      }}
    >
      {children}
    </button>
  );
}

function MetricBlock({ label, value }) {
  return (
    <div style={metricBlock}>
      <p style={summaryLabel}>{label}</p>
      <p style={metricValue}>{value}</p>
    </div>
  );
}

function FactPill({ label, value, tone = "default" }) {
  return (
    <div
      style={{
        ...factPill,
        ...(tone === "accent" ? factPillAccent : {}),
        ...(tone === "warning" ? factPillWarning : {}),
      }}
    >
      <span style={factLabel}>{label}</span>
      <strong style={factValue}>{value}</strong>
    </div>
  );
}

function StarPicker({ value, onChange }) {
  return (
    <div style={starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          style={starButton(star <= value)}
        >
          {star}
        </button>
      ))}
    </div>
  );
}

function getEscrowLabel(member, groupStatus = "") {
  if (member.escrow_status === "released") {
    return "Funds released";
  }

  if (member.escrow_status === "refunded") {
    return "Refunded";
  }

  if (member.access_issue_reported) {
    return "Access issue reported";
  }

  if (member.access_confirmed) {
    return "Access confirmed";
  }

  if ((groupStatus === "proof_submitted" || groupStatus === "disputed") && member.has_paid) {
    return "Awaiting confirmation";
  }

  if (member.escrow_status === "held" && member.has_paid) {
    return "Awaiting access confirmation";
  }

  if (member.has_paid) {
    return "Held in escrow";
  }

  return "Awaiting payment";
}

const container = {
  padding: "28px 22px 56px",
  background: "radial-gradient(circle at top left, rgba(15,118,110,0.10), transparent 28%), radial-gradient(circle at bottom right, rgba(187,122,20,0.10), transparent 24%), linear-gradient(180deg, #f7f2e9 0%, #eef3f6 100%)",
  minHeight: "100vh",
};

const pageShell = {
  maxWidth: "1240px",
  margin: "0 auto",
};

const containerMobile = {
  padding: "16px 14px 34px",
};

const pageShellMobile = {
  maxWidth: "100%",
};

const hero = {
  background: "linear-gradient(145deg, #0f172a 0%, #162033 50%, #0f766e 100%)",
  color: "#fff",
  borderRadius: "32px",
  padding: "28px",
  marginBottom: "24px",
  boxShadow: "0 34px 90px rgba(15, 23, 42, 0.20)",
};

const heroMobile = {
  borderRadius: "24px",
  padding: "18px 16px",
  marginBottom: "18px",
};

const eyebrow = {
  margin: 0,
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "#fbbf24",
};

const heroText = {
  margin: 0,
  color: "#cbd5e1",
};

const heroTitle = {
  margin: "10px 0 8px",
  fontSize: "40px",
  lineHeight: 1,
  fontWeight: 800,
};

const heroTitleMobile = {
  fontSize: "28px",
  lineHeight: 1.05,
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "26px",
};

const statsGridMobile = {
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
  marginBottom: "18px",
};

const summaryCard = {
  background: "rgba(255,255,255,0.82)",
  borderRadius: "24px",
  padding: "18px 18px 16px",
  boxShadow: "0 22px 60px rgba(15, 23, 42, 0.08)",
  border: "1px solid rgba(255,255,255,0.72)",
  backdropFilter: "blur(12px)",
};

const summaryCardMobile = {
  borderRadius: "18px",
  padding: "12px 12px 11px",
};

const summaryLabel = {
  margin: 0,
  color: "#64748b",
  fontSize: "13px",
};

const summaryLabelMobile = {
  fontSize: "10px",
  lineHeight: 1.4,
};

const summaryValue = {
  margin: "8px 0 0",
  fontSize: "30px",
  fontWeight: 700,
};

const summaryValueMobile = {
  marginTop: "6px",
  fontSize: "18px",
};

const filterRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginBottom: "22px",
};

const filterRowMobile = {
  gap: "8px",
  marginBottom: "18px",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: "14px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const sectionHeaderMobile = {
  marginBottom: "12px",
};

const joinedSectionHeader = {
  ...sectionHeader,
  marginTop: "28px",
};

const sectionEyebrow = {
  margin: 0,
  color: "#64748b",
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
};

const sectionTitle = {
  margin: "6px 0 0",
  color: "#0f172a",
  fontSize: "26px",
  lineHeight: 1.05,
  fontWeight: 800,
};

const sectionTitleMobile = {
  fontSize: "22px",
};

const sectionText = {
  margin: 0,
  color: "#64748b",
  maxWidth: "540px",
};

const filterButton = {
  border: "none",
  borderRadius: "999px",
  padding: "10px 16px",
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
};

const filterButtonCompact = {
  padding: "9px 12px",
  fontSize: "12px",
};

const card = {
  padding: "20px",
  marginBottom: "16px",
  borderRadius: "28px",
  background: "rgba(255,255,255,0.82)",
  boxShadow: "0 24px 68px rgba(15, 23, 42, 0.08)",
  border: "1px solid rgba(255,255,255,0.74)",
  backdropFilter: "blur(12px)",
};

const cardMobile = {
  padding: "16px",
  marginBottom: "12px",
  borderRadius: "22px",
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "8px",
};

const cardHeaderMobile = {
  alignItems: "flex-start",
};

const badge = {
  background: "rgba(15, 23, 42, 0.06)",
  color: "#0f172a",
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
};

const subtleText = {
  margin: "4px 0",
  color: "#64748b",
};

const subtleTextCompact = {
  fontSize: "13px",
  lineHeight: 1.55,
};

const cardSubheading = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: "14px",
};

const descriptionText = {
  margin: "14px 0 10px",
  color: "#334155",
  fontWeight: 500,
};

const managementNote = (isClosed) => ({
  margin: "12px 0 0",
  color: isClosed ? "#9a3412" : "#475569",
  background: isClosed ? "#ffedd5" : "#f8fafc",
  borderRadius: "12px",
  padding: "10px 12px",
});

const factsRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "14px",
};

const factsRowMobile = {
  gap: "8px",
  marginTop: "12px",
};

const factPill = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
};

const factPillAccent = {
  background: "#ecfeff",
  border: "1px solid #a5f3fc",
};

const factPillWarning = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
};

const factLabel = {
  color: "#64748b",
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const factValue = {
  color: "#0f172a",
  fontSize: "13px",
};

const metaLine = {
  margin: "10px 0 0",
  fontSize: "13px",
  color: "#64748b",
};

const metricBlock = {
  background: "rgba(255,255,255,0.76)",
  borderRadius: "18px",
  padding: "12px",
  border: "1px solid rgba(148, 163, 184, 0.14)",
};

const metricValue = {
  margin: "8px 0 0",
  fontWeight: 700,
  color: "#0f172a",
};

const progressBar = {
  height: "8px",
  background: "#e2e8f0",
  borderRadius: "5px",
  marginTop: "12px",
};

const progressFill = {
  height: "100%",
  background: "#22c55e",
  borderRadius: "5px",
};

const actionRow = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
};

const actionRowMobile = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "8px",
};

const actionButtonMobile = {
  width: "100%",
};

const secondaryButton = {
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(255,255,255,0.88)",
  color: "#0f172a",
  borderRadius: "999px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const primaryButton = {
  border: "none",
  background: "linear-gradient(135deg, #0f172a 0%, #1f3a4a 100%)",
  color: "#fff",
  borderRadius: "999px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.14)",
};

const warningButton = {
  border: "none",
  background: "#b45309",
  color: "#fff",
  borderRadius: "999px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButton = {
  border: "1px solid #fecaca",
  background: "rgba(255, 241, 242, 0.9)",
  color: "#b91c1c",
  borderRadius: "999px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const editPanel = {
  marginTop: "16px",
  borderTop: "1px solid #e2e8f0",
  paddingTop: "16px",
};

const credentialEditPanel = {
  marginTop: "16px",
  padding: "16px",
  borderRadius: "18px",
  background: "rgba(239, 246, 255, 0.86)",
  border: "1px solid rgba(191, 219, 254, 0.9)",
};

const editPanelHeader = {
  marginBottom: "14px",
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const fieldLabel = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#334155",
};

const input = (disabled) => ({
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: disabled ? "#e2e8f0" : "rgba(255,255,255,0.9)",
  color: disabled ? "#64748b" : "#0f172a",
});

const textarea = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "90px",
  padding: "10px 12px",
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(255,255,255,0.9)",
  color: "#0f172a",
  resize: "vertical",
};

const fileInput = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px dashed #94a3b8",
  background: "#fff",
  color: "#0f172a",
};

const lockedNote = {
  marginTop: "12px",
  fontSize: "13px",
  color: "#92400e",
  background: "#fef3c7",
  borderRadius: "10px",
  padding: "10px 12px",
};

const detailPanel = {
  marginTop: "18px",
  borderTop: "1px solid #e2e8f0",
  paddingTop: "18px",
};

const detailPanelMobile = {
  marginTop: "14px",
  paddingTop: "14px",
};

const joinedGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
};

const joinedGridMobile = {
  gridTemplateColumns: "1fr",
  gap: "12px",
};

const joinedCard = {
  padding: "20px",
  borderRadius: "20px",
  background: "#fff",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.06)",
  border: "1px solid #e2e8f0",
};

const joinedCardMobile = {
  padding: "16px",
  borderRadius: "22px",
};

const ownerCredentialCard = {
  marginBottom: "14px",
  padding: "14px",
  borderRadius: "12px",
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
};

const ownerCredentialEyebrow = {
  margin: "0 0 10px",
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "#047857",
};

const ownerCredentialLine = {
  margin: "0 0 8px",
  color: "#0f172a",
  wordBreak: "break-word",
};

const memberAccessCard = (available) => ({
  marginTop: "16px",
  padding: "14px",
  borderRadius: "12px",
  background: available ? "#ecfdf5" : "#fff7ed",
  border: `1px solid ${available ? "#a7f3d0" : "#fed7aa"}`,
});

const memberAccessCardMobile = {
  marginTop: "14px",
  padding: "12px",
  borderRadius: "14px",
};

const reviewCard = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "14px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const reviewCardMobile = {
  marginTop: "14px",
  padding: "12px",
};

const reviewTitle = {
  margin: "0 0 8px",
  color: "#0f172a",
  fontWeight: 700,
};

const reviewTextarea = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "82px",
  marginTop: "10px",
  marginBottom: "10px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  resize: "vertical",
};

const starRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const starButton = (active) => ({
  border: "1px solid #cbd5e1",
  background: active ? "#fef3c7" : "#fff",
  color: active ? "#b45309" : "#94a3b8",
  borderRadius: "10px",
  padding: "8px 10px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: 1,
});

const detailStats = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px",
  marginTop: "14px",
};

const detailStatsMobile = {
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
};

const detailGridLayout = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
};

const detailGridLayoutMobile = {
  gridTemplateColumns: "1fr",
  gap: "12px",
};

const detailSectionCard = {
  borderRadius: "24px",
  border: "1px solid rgba(255,255,255,0.74)",
  background: "rgba(255,255,255,0.78)",
  padding: "18px",
  backdropFilter: "blur(10px)",
};

const detailSectionCardMobile = {
  borderRadius: "18px",
  padding: "14px",
};

const detailSectionHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const detailEyebrow = {
  margin: 0,
  fontSize: "11px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#64748b",
};

const detailSectionTitle = {
  margin: "6px 0 0",
  color: "#0f172a",
  fontSize: "22px",
  lineHeight: 1.08,
  fontWeight: 800,
};

const detailSectionTitleMobile = {
  fontSize: "18px",
};

const buyTogetherNotice = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "12px",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
};

const buyTogetherNoticeTitle = {
  margin: "0 0 8px",
  color: "#1d4ed8",
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  fontWeight: 700,
};

const proofSummary = {
  display: "grid",
  gap: "6px",
  marginTop: "12px",
  marginBottom: "12px",
};

const proofMeta = {
  margin: 0,
  color: "#7c2d12",
};

const proofWarning = {
  margin: "10px 0 0",
  color: "#9a3412",
  background: "#ffedd5",
  borderRadius: "10px",
  padding: "10px 12px",
};

const proofReadyNotice = {
  margin: "12px 0 0",
  color: "#92400e",
  background: "#fef3c7",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "14px",
  lineHeight: 1.6,
};

const proofPending = {
  margin: "10px 0 0",
  color: "#1d4ed8",
  background: "#dbeafe",
  borderRadius: "10px",
  padding: "10px 12px",
};

const proofApproved = {
  margin: "10px 0 0",
  color: "#166534",
  background: "#dcfce7",
  borderRadius: "10px",
  padding: "10px 12px",
};

const memberIssueText = {
  margin: "6px 0 0",
  color: "#9a3412",
  fontSize: "13px",
  maxWidth: "420px",
};

const proofFormCard = {
  marginTop: "14px",
  paddingTop: "14px",
  borderTop: "1px solid #fdba74",
};

const proofLink = {
  color: "#0f766e",
  fontWeight: 700,
  textDecoration: "none",
};

const memberRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "14px 0",
  borderBottom: "1px solid #e2e8f0",
};

const memberRowMobile = {
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "10px",
};

const membersList = {
  marginTop: "6px",
};

const memberName = {
  margin: 0,
  fontWeight: 700,
  color: "#0f172a",
};

const memberMeta = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "13px",
};

const memberStatus = (paidOrLabel) => {
  if (paidOrLabel === "Funds released") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderRadius: "999px",
      padding: "6px 10px",
      fontSize: "12px",
      fontWeight: 700,
    };
  }

  if (paidOrLabel === "Refunded") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      borderRadius: "999px",
      padding: "6px 10px",
      fontSize: "12px",
      fontWeight: 700,
    };
  }

  if (paidOrLabel === "Held in escrow") {
    return {
      background: "#fef3c7",
      color: "#92400e",
      borderRadius: "999px",
      padding: "6px 10px",
      fontSize: "12px",
      fontWeight: 700,
    };
  }

  if (paidOrLabel === "Access confirmed") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderRadius: "999px",
      padding: "6px 10px",
      fontSize: "12px",
      fontWeight: 700,
    };
  }

  if (paidOrLabel === "Access issue reported") {
    return {
      background: "#ffedd5",
      color: "#9a3412",
      borderRadius: "999px",
      padding: "6px 10px",
      fontSize: "12px",
      fontWeight: 700,
    };
  }

  if (paidOrLabel === "Awaiting confirmation") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      borderRadius: "999px",
      padding: "6px 10px",
      fontSize: "12px",
      fontWeight: 700,
    };
  }

  if (paidOrLabel === "Awaiting payment") {
    return {
      background: "#e2e8f0",
      color: "#475569",
      borderRadius: "999px",
      padding: "6px 10px",
      fontSize: "12px",
      fontWeight: 700,
    };
  }

  return {
    background: paidOrLabel ? "#dcfce7" : "#fef3c7",
    color: paidOrLabel ? "#166534" : "#92400e",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
  };
};
