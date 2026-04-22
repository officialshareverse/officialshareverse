export function getInitialEditForm(group, detail = null) {
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

export function getInitialProofForm(detail = null) {
  return {
    purchase_reference: detail?.purchase_proof?.purchase_reference || "",
    purchase_notes: detail?.purchase_proof?.purchase_notes || "",
    purchase_proof: null,
  };
}

export function getInitialReviewForm(review = null) {
  return {
    rating: review?.rating || 5,
    comment: review?.comment || "",
  };
}

export function getReviewKey(groupId, userId) {
  return `${groupId}:${userId}`;
}

export function canDeleteGroup(group) {
  return group.filled_slots === 0;
}

export function canCloseGroup(group) {
  if (group.status === "closed" || group.filled_slots === 0) {
    return false;
  }

  if (group.mode === "group_buy" && group.status !== "active") {
    return false;
  }

  return true;
}

export function getLifecycleNote(group) {
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

export function getEscrowLabel(member, groupStatus = "") {
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

export function getActionError(errorData, fallbackMessage) {
  if (!errorData || typeof errorData !== "object") {
    return fallbackMessage;
  }

  if (typeof errorData.error === "string" && errorData.error.trim()) {
    return errorData.error;
  }

  const firstField = Object.values(errorData)[0];
  if (Array.isArray(firstField) && firstField.length > 0) {
    return firstField[0];
  }

  if (typeof firstField === "string" && firstField.trim()) {
    return firstField;
  }

  return fallbackMessage;
}
