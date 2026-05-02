export function canDeleteSplit(group) {
  return Number(group?.filled_slots || 0) === 0;
}

export function canCloseSplit(group) {
  if (!group || group.status === "closed" || Number(group.filled_slots || 0) === 0) {
    return false;
  }

  if (group.mode === "group_buy" && group.status !== "active") {
    return false;
  }

  return true;
}

export function getLifecycleNote(group) {
  if (!group) {
    return "";
  }

  if (group.status === "closed") {
    return "Closed splits stay in your workspace and no longer accept new joins.";
  }

  if (group.status === "refunded") {
    return "This buy-together split was refunded, so held member funds have already been returned.";
  }

  if (canDeleteSplit(group)) {
    return "This split is still empty, so you can delete it completely.";
  }

  if (group.mode === "group_buy" && group.status === "proof_submitted") {
    return "Proof is uploaded. Members can now confirm access or report an issue before payout is released.";
  }

  if (group.mode === "group_buy" && group.status === "disputed") {
    return "A member reported an access issue. Payout is paused until the issue is resolved or funds are refunded.";
  }

  if (group.mode === "group_buy" && group.status !== "active") {
    return "This buy-together split must complete or refund before it can be closed.";
  }

  if (canCloseSplit(group)) {
    return "Closing stops new joins and keeps the split in your records.";
  }

  return "Manage invites, members, and split updates from here.";
}

export function hasActionRequired(group) {
  if (!group) {
    return false;
  }

  return Boolean(
    group.can_submit_proof ||
      group.can_activate ||
      group.can_refund ||
      Number(group.reported_issues || 0) > 0 ||
      Number(group.remaining_confirmations || 0) > 0 ||
      (group.next_action && String(group.next_action).trim())
  );
}

export function matchesHostedSplitFilter(group, filterKey) {
  if (!group) {
    return false;
  }

  if (filterKey === "all") {
    return true;
  }
  if (filterKey === "action_needed") {
    return hasActionRequired(group);
  }
  if (filterKey === "sharing") {
    return group.mode === "sharing";
  }
  if (filterKey === "group_buy") {
    return group.mode === "group_buy";
  }
  if (filterKey === "closed") {
    return ["closed", "refunded", "failed"].includes(group.status);
  }
  return true;
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
