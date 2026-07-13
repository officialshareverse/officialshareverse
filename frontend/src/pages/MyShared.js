import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

import ActionDialog from "../components/ActionDialog";
import Drawer from "../components/Drawer";
import EmptyState from "../components/EmptyState";
import FirstVisitHint from "../components/FirstVisitHint";
import InviteShareModal from "../components/InviteShareModal";
import SubscriptionLogo from "../components/SubscriptionLogo";
import Tooltip from "../components/Tooltip";
import { SkeletonList } from "../components/SkeletonFactory";
import { useToast } from "../components/ToastProvider";
import useIsMobile from "../hooks/useIsMobile";
import { trackSubscriptionActivated } from "../utils/analytics";
import {
  ChatIcon,
  ClockIcon,
  LayersIcon,
  ShareIcon,
  ShieldIcon,
  SparkIcon,
  WalletIcon,
} from "../components/UiIcons";
import {
  canCloseGroup,
  canDeleteGroup,
  getActionError,
  getEscrowLabel,
  getInitialEditForm,
  getInitialProofForm,
  getInitialReviewForm,
  getLifecycleNote,
  getReviewKey,
} from "./mySharedUtils";
import {
  MobileDrawerAction,
  FilterButton,
  MetricBlock,
  FactPill,
  StarPicker,
  actionButtonMobile,
  actionRow,
  actionRowMobile,
  badge,
  buyTogetherNotice,
  buyTogetherNoticeTitle,
  card,
  cardMobile,
  cardSubheading,
  container,
  containerMobile,

  dangerButton,
  descriptionText,
  detailEyebrow,
  detailGridLayout,
  detailGridLayoutMobile,
  detailPanel,
  detailPanelMobile,
  detailSectionCard,
  detailSectionCardMobile,
  detailSectionHeader,
  detailSectionTitle,
  detailSectionTitleMobile,
  detailStats,
  detailStatsMobile,
  editPanel,
  editPanelHeader,
  factsRow,
  factsRowMobile,
  field,
  fieldLabel,
  fileInput,
  filterRow,
  filterRowMobile,
  formGrid,
  input,
  joinedCard,
  joinedCardMobile,
  joinedGrid,
  joinedGridMobile,
  joinedSectionHeader,
  lockedNote,
  managementNote,
  memberAccessCard,
  memberAccessCardMobile,
  memberIssueText,
  memberMeta,
  memberName,
  memberRow,
  memberRowMobile,
  membersList,
  memberStatus,
  metaLine,
  ownerCredentialEyebrow,
  pageShell,
  pageShellMobile,
  primaryButton,
  progressBar,
  progressFill,
  proofApproved,
  proofFormCard,
  proofLink,
  proofMeta,
  proofPending,
  proofReadyNotice,
  proofSummary,
  proofWarning,
  reviewCard,
  reviewCardMobile,
  reviewTextarea,
  reviewTitle,
  secondaryButton,
  sectionEyebrow,
  sectionHeader,
  sectionHeaderMobile,
  sectionTitle,
  sectionTitleMobile,
  subtleText,
  subtleTextCompact,
  textarea,
  warningButton,
} from "./mySharedUi";

export default function MyShared() {
  const navigate = useNavigate();
  const toast = useToast();
  const isMobile = useIsMobile();
  const [groups, setGroups] = useState([]);
  const [joinedGroups, setJoinedGroups] = useState([]);
  const [page, setPage] = useState(1);
  const [joinedPage, setJoinedPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [primaryTab, setPrimaryTab] = useState("host");
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
  const [expandedGroups, setExpandedGroups] = useState({});
  const [proofForms, setProofForms] = useState({});

  const [reviewForms, setReviewForms] = useState({});
  const [submittingReviewKey, setSubmittingReviewKey] = useState("");
  const [visibleRatingForms, setVisibleRatingForms] = useState({});
  const [mobileOwnerActionGroupId, setMobileOwnerActionGroupId] = useState(null);
  const [mobileJoinedActionGroupId, setMobileJoinedActionGroupId] = useState(null);
  const [inviteModalGroup, setInviteModalGroup] = useState(null);
  const [actionDialog, setActionDialog] = useState({
    open: false,
    eyebrow: "Confirm action",
    title: "",
    description: "",
    confirmLabel: "Confirm",
    confirmPendingLabel: "Working...",
    cancelLabel: "Cancel",
    tone: "default",
    inputLabel: "",
    inputPlaceholder: "",
    inputValue: "",
    multiline: false,
    isSubmitting: false,
    onConfirm: null,
  });

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
    let isMounted = true;
    const fetchAll = async () => {
      await Promise.all([fetchGroups(), fetchJoinedGroups()]);
      if (isMounted) setLoading(false);
    };
    fetchAll();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileOwnerActionGroupId(null);
      setMobileJoinedActionGroupId(null);
    }
  }, [isMobile]);

  const filteredGroups = useMemo(() => {
    if (filter === "all") {
      return groups;
    }
    return groups.filter((group) => group.mode === filter);
  }, [filter, groups]);

  const displayedFilteredGroups = filteredGroups.slice(0, page * 50);
  const hasMoreGroups = displayedFilteredGroups.length < filteredGroups.length;

  const displayedJoinedGroups = joinedGroups.slice(0, joinedPage * 50);
  const hasMoreJoinedGroups = displayedJoinedGroups.length < joinedGroups.length;



  const activeMobileOwnerGroup = useMemo(
    () => groups.find((group) => group.id === mobileOwnerActionGroupId) || null,
    [groups, mobileOwnerActionGroupId]
  );

  const activeMobileOwnerDetail = activeMobileOwnerGroup
    ? details[activeMobileOwnerGroup.id]
    : null;

  const activeMobileJoinedGroup = useMemo(
    () => joinedGroups.find((group) => group.id === mobileJoinedActionGroupId) || null,
    [joinedGroups, mobileJoinedActionGroupId]
  );

  const activeMobileJoinedReviewTarget = activeMobileJoinedGroup?.owner_rating;
  const activeMobileJoinedReviewKey = activeMobileJoinedGroup
    ? getReviewKey(activeMobileJoinedGroup.id, activeMobileJoinedGroup.owner_id)
    : "";
  const activeMobileJoinedReviewForm =
    (activeMobileJoinedReviewKey && reviewForms[activeMobileJoinedReviewKey]) ||
    getInitialReviewForm(activeMobileJoinedReviewTarget?.my_review);

  const resetActionDialog = () => ({
    open: false,
    eyebrow: "Confirm action",
    title: "",
    description: "",
    confirmLabel: "Confirm",
    confirmPendingLabel: "Working...",
    cancelLabel: "Cancel",
    tone: "default",
    inputLabel: "",
    inputPlaceholder: "",
    inputValue: "",
    multiline: false,
    isSubmitting: false,
    onConfirm: null,
  });

  const closeActionDialog = () => {
    setActionDialog((current) => (current.isSubmitting ? current : resetActionDialog()));
  };

  const openActionDialog = (config) => {
    setActionDialog({
      ...resetActionDialog(),
      open: true,
      eyebrow: config.eyebrow || "Confirm action",
      title: config.title || "",
      description: config.description || "",
      confirmLabel: config.confirmLabel || "Confirm",
      confirmPendingLabel: config.confirmPendingLabel || "Working...",
      cancelLabel: config.cancelLabel || "Cancel",
      tone: config.tone || "default",
      inputLabel: config.inputLabel || "",
      inputPlaceholder: config.inputPlaceholder || "",
      inputValue: config.inputValue || "",
      multiline: Boolean(config.multiline),
      onConfirm: config.onConfirm || null,
    });
  };

  const handleDialogConfirm = async () => {
    if (!actionDialog.onConfirm) {
      closeActionDialog();
      return;
    }

    try {
      setActionDialog((current) => ({
        ...current,
        isSubmitting: true,
      }));

      const shouldClose = await actionDialog.onConfirm(actionDialog.inputValue);
      if (shouldClose !== false) {
        setActionDialog(resetActionDialog());
        return;
      }

      setActionDialog((current) => ({
        ...current,
        isSubmitting: false,
      }));
    } catch (error) {
      console.error(error);
      setActionDialog((current) => ({
        ...current,
        isSubmitting: false,
      }));
    }
  };

  const toggleDetails = async (groupId) => {
    if (expandedGroups[groupId]) {
      setExpandedGroups((current) => {
        const next = { ...current };
        delete next[groupId];
        return next;
      });
      return;
    }

    if (!details[groupId]) {
      try {
        setLoadingDetailId(groupId);
        const res = await API.get(`my-groups/${groupId}/`);
        storeDetail(groupId, res.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load group details");
        return;
      } finally {
        setLoadingDetailId(null);
      }
    }
    setExpandedGroups((current) => ({ ...current, [groupId]: true }));
  };

  const openProofPanel = async (groupId) => {
    if (!details[groupId]) {
      try {
        setLoadingDetailId(groupId);
        const res = await API.get(`my-groups/${groupId}/`);
        storeDetail(groupId, res.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load the proof upload panel");
        return;
      } finally {
        setLoadingDetailId(null);
      }
    }
    setExpandedGroups((current) => ({ ...current, [groupId]: true }));
  };

  const confirmMemberAccess = async (groupId) => {
    try {
      setConfirmingId(groupId);
      const response = await API.post(`groups/${groupId}/confirm-access/`);
      const joinedRes = await API.get("dashboard/");
      const updatedJoinedGroups = joinedRes.data?.groups || [];
      setJoinedGroups(updatedJoinedGroups);
      const activatedGroup =
        updatedJoinedGroups.find((group) => String(group.id) === String(groupId)) ||
        joinedGroups.find((group) => String(group.id) === String(groupId)) ||
        { id: groupId };
      trackSubscriptionActivated(activatedGroup);
      toast.success(response.data?.message || "Access confirmed successfully");
    } catch (err) {
      console.error(err);
      toast.error(getActionError(err.response?.data, "Failed to confirm access"));
    } finally {
      setConfirmingId(null);
    }
  };

  const requestAccessIssueReport = (groupId) => {
    openActionDialog({
      eyebrow: "Report issue",
      title: "Describe the access problem",
      description:
        "Share a short note so the host can fix the issue or refund the group if needed.",
      confirmLabel: "Send report",
      confirmPendingLabel: "Sending...",
      inputLabel: "Issue details",
      inputPlaceholder: "I did not receive the credentials yet.",
      inputValue: "I did not receive the credentials yet.",
      multiline: true,
      onConfirm: async (issueDetails) => {
        const nextDetails = issueDetails.trim();
        if (!nextDetails) {
          toast.warning("Add a short note before sending the report.");
          return false;
        }

        try {
          setReportingIssueId(groupId);
          const response = await API.post(`groups/${groupId}/report-access-issue/`, {
            details: nextDetails,
          });
          const joinedRes = await API.get("dashboard/");
          setJoinedGroups(joinedRes.data?.groups || []);
          toast.success(response.data?.message || "Access issue reported");
          return true;
        } catch (err) {
          console.error(err);
          toast.error(getActionError(err.response?.data, "Failed to report the access issue"));
          return false;
        } finally {
          setReportingIssueId(null);
        }
      },
    });
  };

  const requestRefundGroup = (group) => {
    openActionDialog({
      eyebrow: "Refund members",
      title: "Refund held contributions?",
      description: "This returns all held member contributions for the buy-together group.",
      confirmLabel: "Refund now",
      confirmPendingLabel: "Refunding...",
      tone: "danger",
      onConfirm: async () => {
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
          toast.success("Held member funds refunded successfully");
          return true;
        } catch (err) {
          console.error(err);
          toast.error(getActionError(err.response?.data, "Failed to refund held funds"));
          return false;
        } finally {
          setRefundingId(null);
        }
      },
    });
  };

  const requestCloseGroup = (group) => {
    openActionDialog({
      eyebrow: "Close split",
      title: "Close this split?",
      description:
        "The split will stay in your workspace, but new members will no longer be able to join.",
      confirmLabel: "Close split",
      confirmPendingLabel: "Closing...",
      onConfirm: async () => {
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
          toast.success("Group closed successfully");
          return true;
        } catch (err) {
          console.error(err);
          toast.error(getActionError(err.response?.data, "Failed to close group"));
          return false;
        } finally {
          setClosingId(null);
        }
      },
    });
  };

  const requestDeleteGroup = (group) => {
    openActionDialog({
      eyebrow: "Delete split",
      title: "Delete this empty split?",
      description: "This permanently removes the split and cannot be undone.",
      confirmLabel: "Delete split",
      confirmPendingLabel: "Deleting...",
      tone: "danger",
      onConfirm: async () => {
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

          toast.success("Group deleted successfully");
          return true;
        } catch (err) {
          console.error(err);
          toast.error(getActionError(err.response?.data, "Failed to delete group"));
          return false;
        } finally {
          setDeletingId(null);
        }
      },
    });
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
        toast.error("Failed to load group details");
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
          toast.warning("To update credentials, provide both login identifier and password.");
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
      toast.success("Group updated successfully");
    } catch (err) {
      console.error(err);
      toast.error(getActionError(err.response?.data, "Failed to update group"));
    } finally {
      setSavingId(null);
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
      toast.success(response.data?.message || "Rating saved successfully");
    } catch (err) {
      console.error(err);
      toast.error(getActionError(err.response?.data, "Failed to save your rating"));
    } finally {
      setSubmittingReviewKey("");
    }
  };

  const submitPurchaseProof = async (groupId) => {
    const currentProofForm = proofForms[groupId] || getInitialProofForm(details[groupId]);

    if (!currentProofForm.purchase_proof) {
      toast.warning("Select a proof file before uploading.");
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
      toast.success("Purchase proof uploaded successfully");
    } catch (err) {
      console.error(err);
      toast.error(getActionError(err.response?.data, "Failed to upload purchase proof"));
    } finally {
      setSubmittingProofId(null);
    }
  };

  const closeMobileOwnerActions = () => {
    setMobileOwnerActionGroupId(null);
  };

  const closeMobileJoinedActions = () => {
    setMobileJoinedActionGroupId(null);
  };

  const activeMobileOwnerLifecycleNote = activeMobileOwnerGroup
    ? getLifecycleNote(activeMobileOwnerGroup)
    : null;
  const activeMobileOwnerHasOpenSlots = activeMobileOwnerGroup
    ? Number(activeMobileOwnerGroup.total_slots || 0) > Number(activeMobileOwnerGroup.filled_slots || 0)
    : false;
  const activeMobileOwnerRemainingSlots = activeMobileOwnerGroup
    ? Math.max(0, Number(activeMobileOwnerGroup.total_slots || 0) - Number(activeMobileOwnerGroup.filled_slots || 0))
    : 0;

  return (
    <>
    <ActionDialog
      open={actionDialog.open}
      onClose={closeActionDialog}
      onConfirm={handleDialogConfirm}
      eyebrow={actionDialog.eyebrow}
      title={actionDialog.title}
      description={actionDialog.description}
      confirmLabel={actionDialog.confirmLabel}
      confirmPendingLabel={actionDialog.confirmPendingLabel}
      cancelLabel={actionDialog.cancelLabel}
      tone={actionDialog.tone}
      inputLabel={actionDialog.inputLabel}
      inputPlaceholder={actionDialog.inputPlaceholder}
      inputValue={actionDialog.inputValue}
      onInputChange={(value) =>
        setActionDialog((current) => ({
          ...current,
          inputValue: value,
        }))
      }
      confirmDisabled={Boolean(actionDialog.inputLabel) && !actionDialog.inputValue.trim()}
      multiline={actionDialog.multiline}
      isSubmitting={actionDialog.isSubmitting}
    />
    {inviteModalGroup ? (
      <InviteShareModal group={inviteModalGroup} onClose={() => setInviteModalGroup(null)} />
    ) : null}
    {isMobile && activeMobileOwnerGroup ? (
      <Drawer
        open={Boolean(activeMobileOwnerGroup)}
        onClose={closeMobileOwnerActions}
        eyebrow="Split actions"
        title={activeMobileOwnerGroup.subscription_name}
        description="Take owner actions without expanding every control inside the card."
        footer={(
          <p className="sv-drawer-footnote">
            {activeMobileOwnerLifecycleNote || (activeMobileOwnerDetail
              ? "Open Manage on the card if you want the full member list, proof panel, and inline forms."
              : "Open Manage on the card first if you need member details or refund controls before acting.")}
          </p>
        )}
        >
        <div className="sv-drawer-stack">
          {activeMobileOwnerGroup.status !== "closed" && activeMobileOwnerHasOpenSlots ? (
            <MobileDrawerAction
              icon={ShareIcon}
              label="Invite members"
              description="Generate a share link, WhatsApp message, or QR code for this split."
              meta={`${activeMobileOwnerRemainingSlots} slot${activeMobileOwnerRemainingSlots === 1 ? "" : "s"} open`}
              onClick={() => {
                closeMobileOwnerActions();
                setInviteModalGroup(activeMobileOwnerGroup);
              }}
            />
          ) : null}

          {activeMobileOwnerGroup.filled_slots > 0 ? (
            <MobileDrawerAction
              icon={ChatIcon}
              label="Open group chat"
              description="Reply to members and keep coordination in one place."
              meta={activeMobileOwnerGroup.unread_chat_count ? `${activeMobileOwnerGroup.unread_chat_count} new` : "Messages"}
              onClick={() => {
                closeMobileOwnerActions();
                navigate(`/groups/${activeMobileOwnerGroup.id}/chat`);
              }}
            />
          ) : null}

          {activeMobileOwnerGroup.mode === "group_buy" && activeMobileOwnerGroup.can_submit_proof ? (
            <MobileDrawerAction
              icon={SparkIcon}
              label={activeMobileOwnerGroup.has_purchase_proof ? "Manage purchase proof" : "Upload purchase proof"}
              description="Keep the buy-together proof flow moving from one place."
              meta={activeMobileOwnerGroup.has_purchase_proof ? "Ready" : "Needed"}
              onClick={() => {
                closeMobileOwnerActions();
                openProofPanel(activeMobileOwnerGroup.id);
              }}
            />
          ) : null}

          {activeMobileOwnerGroup.status !== "closed" ? (
            <MobileDrawerAction
              icon={LayersIcon}
              label="Edit split"
              description="Update the listing and adjust what is still allowed."
              onClick={() => {
                closeMobileOwnerActions();
                startEditing(activeMobileOwnerGroup);
              }}
            />
          ) : null}

          {activeMobileOwnerDetail?.can_refund ? (
            <MobileDrawerAction
              icon={WalletIcon}
              label="Refund members"
              description="Return held funds if the buy-together flow needs to stop."
              meta={refundingId === activeMobileOwnerGroup.id ? "Refunding" : "Available"}
              disabled={refundingId === activeMobileOwnerGroup.id}
              onClick={() => {
                closeMobileOwnerActions();
                requestRefundGroup(activeMobileOwnerGroup);
              }}
            />
          ) : null}

          {canCloseGroup(activeMobileOwnerGroup) ? (
            <MobileDrawerAction
              icon={ClockIcon}
              label="Close split"
              description="Stop new joins but keep the split in your workspace."
              meta={closingId === activeMobileOwnerGroup.id ? "Closing" : "Available"}
              disabled={closingId === activeMobileOwnerGroup.id}
              onClick={() => {
                closeMobileOwnerActions();
                requestCloseGroup(activeMobileOwnerGroup);
              }}
            />
          ) : null}

          {canDeleteGroup(activeMobileOwnerGroup) ? (
            <MobileDrawerAction
              icon={ShieldIcon}
              label="Delete empty split"
              description="Remove the split completely before anyone joins."
              meta={deletingId === activeMobileOwnerGroup.id ? "Deleting" : "Available"}
              disabled={deletingId === activeMobileOwnerGroup.id}
              onClick={() => {
                closeMobileOwnerActions();
                requestDeleteGroup(activeMobileOwnerGroup);
              }}
            />
          ) : null}
        </div>
      </Drawer>
    ) : null}

    {isMobile && activeMobileJoinedGroup ? (
      <Drawer
        open={Boolean(activeMobileJoinedGroup)}
        onClose={closeMobileJoinedActions}
        eyebrow="Member actions"
        title={activeMobileJoinedGroup.subscription_name}
        description="Handle access, creator rating, and follow-up actions without expanding the whole card."
        footer={(
          <p className="sv-drawer-footnote">
            Use chat for member coordination, then come back here when you need to confirm access or rate the creator.
          </p>
        )}
      >
        <div className="sv-drawer-stack">
          <MobileDrawerAction
            icon={ChatIcon}
            label="Open group chat"
            description="Message the creator or other members."
            meta={activeMobileJoinedGroup.unread_chat_count ? `${activeMobileJoinedGroup.unread_chat_count} new` : "Messages"}
            onClick={() => {
              closeMobileJoinedActions();
              navigate(`/groups/${activeMobileJoinedGroup.id}/chat`);
            }}
          />
        </div>

        <div style={{ ...reviewCard, marginTop: 0 }}>
          <p style={reviewTitle}>Rate the creator</p>
          <p style={subtleText}>
            {activeMobileJoinedGroup.owner_name}
            {activeMobileJoinedReviewTarget?.average_rating
              ? ` | ${activeMobileJoinedReviewTarget.average_rating.toFixed(1)} / 5 from ${activeMobileJoinedReviewTarget.review_count} review${activeMobileJoinedReviewTarget.review_count === 1 ? "" : "s"}`
              : " | No ratings yet"}
          </p>
          {activeMobileJoinedReviewTarget?.can_review ? (
            <>
              <StarPicker
                value={Number(activeMobileJoinedReviewForm.rating)}
                onChange={(value) =>
                  handleReviewChange(
                    activeMobileJoinedGroup.id,
                    activeMobileJoinedGroup.owner_id,
                    "rating",
                    value,
                    activeMobileJoinedReviewTarget?.my_review
                  )
                }
              />
              <textarea
                style={reviewTextarea}
                value={activeMobileJoinedReviewForm.comment}
                onChange={(event) =>
                  handleReviewChange(
                    activeMobileJoinedGroup.id,
                    activeMobileJoinedGroup.owner_id,
                    "comment",
                    event.target.value,
                    activeMobileJoinedReviewTarget?.my_review
                  )
                }
                placeholder="How was the creator to coordinate with?"
              />
              <button
                style={secondaryButton}
                onClick={() =>
                  submitReview({
                    groupId: activeMobileJoinedGroup.id,
                    reviewedUserId: activeMobileJoinedGroup.owner_id,
                    existingReview: activeMobileJoinedReviewTarget?.my_review,
                  })
                }
                disabled={submittingReviewKey === activeMobileJoinedReviewKey}
              >
                {submittingReviewKey === activeMobileJoinedReviewKey
                  ? "Saving..."
                  : activeMobileJoinedReviewTarget?.my_review
                    ? "Update rating"
                    : "Save rating"}
              </button>
            </>
          ) : activeMobileJoinedGroup.status === "active" || activeMobileJoinedGroup.status === "closed" ? (
            <p style={proofApproved}>Your rating is already saved for this group experience.</p>
          ) : (
            <p style={subtleText}>Ratings open after the group becomes active.</p>
          )}
        </div>

        <div style={{ ...memberAccessCard(false), marginTop: 0 }}>
          <p style={ownerCredentialEyebrow}>
            {activeMobileJoinedGroup.mode === "group_buy" ? "Buy-together access" : "Access coordination"}
          </p>
          {activeMobileJoinedGroup.mode === "group_buy" ? (
            <>
              <p style={{ ...subtleText, ...subtleTextCompact }}>
                {activeMobileJoinedGroup.status === "awaiting_purchase"
                  ? "The creator still needs to buy the subscription and coordinate access."
                  : activeMobileJoinedGroup.status === "proof_submitted"
                    ? "The creator says access has been coordinated off-platform. Confirm when you receive it."
                    : activeMobileJoinedGroup.status === "disputed"
                      ? "An access issue was reported. Payout is paused while the creator resolves it or refunds the group."
                      : activeMobileJoinedGroup.status === "active"
                        ? "Your confirmation was collected and the buy-together group is active."
                        : "Access is being coordinated by the group creator."}
              </p>
              <p style={subtleText}>
                Confirmed members: {activeMobileJoinedGroup.confirmed_members || 0}
                {activeMobileJoinedGroup.remaining_confirmations !== undefined
                  ? ` | Remaining: ${activeMobileJoinedGroup.remaining_confirmations}`
                  : ""}
              </p>
              {activeMobileJoinedGroup.reported_issues ? (
                <p style={subtleText}>Reported issues: {activeMobileJoinedGroup.reported_issues}</p>
              ) : null}
              {activeMobileJoinedGroup.has_reported_access_issue && !activeMobileJoinedGroup.has_confirmed_access ? (
                <p style={proofWarning}>
                  You reported an access issue. Confirm once it is fixed, or wait for the creator to refund the group.
                </p>
              ) : null}
              {activeMobileJoinedGroup.status === "disputed" && !activeMobileJoinedGroup.has_reported_access_issue ? (
                <p style={proofWarning}>
                  Payout is paused because a member reported an access issue.
                </p>
              ) : null}
              {activeMobileJoinedGroup.access_confirmation_required ? (
                activeMobileJoinedGroup.has_confirmed_access ? (
                  <p style={proofApproved}>You already confirmed that you received access.</p>
                ) : (
                  <div style={{ ...actionRow, ...actionRowMobile }}>
                    <button
                      style={{ ...primaryButton, ...actionButtonMobile }}
                      onClick={() => confirmMemberAccess(activeMobileJoinedGroup.id)}
                      disabled={confirmingId === activeMobileJoinedGroup.id}
                    >
                      {confirmingId === activeMobileJoinedGroup.id
                        ? "Confirming..."
                        : activeMobileJoinedGroup.has_reported_access_issue
                          ? "Issue fixed, confirm access"
                          : "I received access"}
                    </button>
                    {activeMobileJoinedGroup.can_report_access_issue ? (
                      <button
                        style={{ ...dangerButton, ...actionButtonMobile }}
                        onClick={() => requestAccessIssueReport(activeMobileJoinedGroup.id)}
                        disabled={reportingIssueId === activeMobileJoinedGroup.id}
                      >
                        {reportingIssueId === activeMobileJoinedGroup.id ? "Reporting..." : "Report issue"}
                      </button>
                    ) : null}
                  </div>
                )
              ) : null}
            </>
          ) : (
            <>
              <p style={{ ...subtleText, ...subtleTextCompact }}>
                Access is coordinated privately by the host after you join.
              </p>
              <p style={subtleText}>
                Confirm access once the host has set you up. The host payout is released only after your confirmation.
              </p>
              {activeMobileJoinedGroup.access_confirmation_required ? (
                activeMobileJoinedGroup.has_confirmed_access ? (
                  <p style={proofApproved}>You already confirmed that you received access.</p>
                ) : (
                  <div style={{ ...actionRow, ...actionRowMobile }}>
                    <button
                      style={{ ...primaryButton, ...actionButtonMobile }}
                      onClick={() => confirmMemberAccess(activeMobileJoinedGroup.id)}
                      disabled={confirmingId === activeMobileJoinedGroup.id}
                    >
                      {confirmingId === activeMobileJoinedGroup.id ? "Confirming..." : "I received access"}
                    </button>
                  </div>
                )
              ) : null}
            </>
          )}
        </div>
      </Drawer>
    ) : null}

    <div style={{ ...container, ...(isMobile ? containerMobile : {}) }}>
      <div style={{ ...pageShell, ...(isMobile ? pageShellMobile : {}) }}>
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 sm:pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          My Splits
        </h1>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <FirstVisitHint
          storageKey="my-splits-v1"
          title="Manage your created and joined groups"
          body="Groups you create or join appear here. Start by creating a split or exploring the marketplace."
        />
      </div>

      
      <div style={{ ...filterRow, ...(isMobile ? filterRowMobile : {}), marginBottom: "24px" }}>
        <FilterButton active={primaryTab === "host"} onClick={() => setPrimaryTab("host")} compact={isMobile}>Splits you host</FilterButton>
        <FilterButton active={primaryTab === "joined"} onClick={() => setPrimaryTab("joined")} compact={isMobile}>Splits you joined</FilterButton>
      </div>

      <div style={{ display: primaryTab === "host" ? "block" : "none" }}>
        <div className={`sv-ms-section-header ${isMobile ? "is-mobile" : ""}`}>
          <div>
            <p style={sectionEyebrow}>Created splits</p>
            <h3 className={`sv-ms-section-title ${isMobile ? "is-mobile" : ""}`}>Manage your splits</h3>
          </div>
        </div>

      <div style={{ ...filterRow, ...(isMobile ? filterRowMobile : {}) }}>
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")} compact={isMobile}>All</FilterButton>
        <FilterButton active={filter === "sharing"} onClick={() => setFilter("sharing")} compact={isMobile}>{isMobile ? "Sharing" : "Share existing plan"}</FilterButton>
        <FilterButton active={filter === "group_buy"} onClick={() => setFilter("group_buy")} compact={isMobile}>Buy together</FilterButton>
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : filteredGroups.length === 0 ? (
        <Tooltip
          guided={joinedGroups.length === 0}
          side="bottom"
          className="sv-my-shared-empty-tip"
          storageKey="sv-guided-tooltip-my-shared-empty-v1"
          title="Your split workspace"
          content="Groups you create or join appear here. Start by creating a split or exploring live groups."
        >
          <EmptyState
            icon={LayersIcon}
            title="No splits created yet"
            description="You haven't created any groups. List your first subscription to start saving."
            actions={
              <button style={primaryButton} onClick={() => navigate("/create")}>
                Create Your First Split
              </button>
            }
          />
        </Tooltip>
      ) : (
        <>
        {displayedFilteredGroups.map((group) => {
          const detail = details[group.id];
          const isEditing = editingId === group.id;
          const hasMembers = group.filled_slots > 0;
          const hasOpenSlots = Number(group.total_slots || 0) > Number(group.filled_slots || 0);
          const lifecycleNote = getLifecycleNote(group);
          const proofForm = proofForms[group.id] || getInitialProofForm(detail);
          const showAdvancedOwnerActions = !isMobile || Boolean(detail) || isEditing;

          return (
            <div key={group.id} className={`sv-ms-card ${isMobile ? "is-mobile" : ""}`}>
              <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                  <SubscriptionLogo name={group.subscription_name} size={isMobile ? 36 : 40} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "2px" }}>
                      <h3 style={{ margin: 0, fontSize: isMobile ? "16px" : "18px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{group.subscription_name}</h3>
                      {isMobile ? <span style={{ ...badge, padding: "2px 8px", fontSize: "10px", fontWeight: 700 }}>{group.status_label}</span> : null}
                    </div>
                    <p style={{ ...cardSubheading, margin: 0, fontSize: isMobile ? "13px" : "14px" }}>{group.mode_label}</p>
                  </div>
                </div>
                {!isMobile ? <span style={badge}>{group.status_label}</span> : null}
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
                  {loadingDetailId === group.id ? "Loading..." : expandedGroups[group.id] ? "Hide members" : "View members"}
                </button>

                {isMobile ? (
                  isEditing ? (
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
                    <button
                      style={{ ...primaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                      onClick={() => setMobileOwnerActionGroupId(group.id)}
                    >
                      Actions
                    </button>
                  )
                ) : (
                  <>
                    {showAdvancedOwnerActions && !isEditing && group.status !== "closed" && hasOpenSlots ? (
                      <button
                        style={{ ...secondaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                        onClick={() => setInviteModalGroup(group)}
                      >
                        Invite members
                      </button>
                    ) : null}

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
                        onClick={() => requestRefundGroup(group)}
                        disabled={refundingId === group.id}
                      >
                        {refundingId === group.id ? "Refunding..." : "Refund members"}
                      </button>
                    ) : null}

                    {showAdvancedOwnerActions && !isEditing && canCloseGroup(group) ? (
                      <button
                        style={{ ...warningButton, ...(isMobile ? actionButtonMobile : {}) }}
                        onClick={() => requestCloseGroup(group)}
                        disabled={closingId === group.id}
                      >
                        {closingId === group.id ? "Closing..." : "Close group"}
                      </button>
                    ) : null}

                    {showAdvancedOwnerActions && !isEditing && canDeleteGroup(group) ? (
                      <button
                        style={{ ...dangerButton, ...(isMobile ? actionButtonMobile : {}) }}
                        onClick={() => requestDeleteGroup(group)}
                        disabled={deletingId === group.id}
                      >
                        {deletingId === group.id ? "Deleting..." : "Delete empty group"}
                      </button>
                    ) : null}
                  </>
                )}
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



                  {hasMembers ? (
                    <p style={lockedNote}>
                      Members have already joined this group, so subscription name and price are locked. You can still update the shared access credentials if they change.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {expandedGroups[group.id] && detail ? (
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
                        <MetricBlock label={isMobile ? "Filled" : "Filled members"} value={`${detail.filled_slots} / ${detail.total_slots}`} compact={isMobile} />
                        {!isMobile ? (
                          <MetricBlock label="Paid members" value={`${detail.paid_members} / ${detail.total_slots}`} compact={isMobile} />
                        ) : null}
                        <MetricBlock label={isMobile ? "Stage" : "Current stage"} value={detail.status_label} compact={isMobile} />
                        <MetricBlock
                          label={detail.mode === "group_buy" ? (isMobile ? "Released" : "Released amount") : (isMobile ? "Revenue" : "Released amount")}
                          value={detail.mode === "group_buy" ? `Rs ${detail.released_amount}` : `Rs ${detail.owner_revenue}`}
                          compact={isMobile}
                        />
                        {detail.mode === "group_buy" ? (
                          <>
                            <MetricBlock label={isMobile ? "Confirmed" : "Confirmed access"} value={`${detail.confirmed_members} / ${detail.paid_members}`} compact={isMobile} />
                            {!isMobile ? (
                              <>
                                <MetricBlock label="Reported issues" value={detail.reported_issues} compact={isMobile} />
                                <MetricBlock label="Held amount" value={`Rs ${detail.held_amount}`} compact={isMobile} />
                              </>
                            ) : null}
                          </>
                        ) : null}
                      </div>

                      {detail.mode === "group_buy" ? (
                        <div style={{ ...buyTogetherNotice, marginBottom: 0 }}>
                          <p style={buyTogetherNoticeTitle}>Buy-together safe holding</p>
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
                            All confirmations are complete and the held payout has already been released.
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
                    ) : null}

                    <div style={{ ...detailSectionCard, ...(isMobile ? detailSectionCardMobile : {}) }}>
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
                                <div style={{ flex: 1, width: "100%" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: isMobile ? "8px" : "0" }}>
                                    <div>
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
                                    </div>
                                    {isMobile ? (
                                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                                        <span style={memberStatus(memberLabel)}>
                                          {memberLabel}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>

                                  {member.access_issue_reported && member.access_issue_notes ? (
                                    <p style={memberIssueText}>Reported issue: {member.access_issue_notes}</p>
                                  ) : null}
                                  {detail.can_rate_members ? (
                                    visibleRatingForms[reviewKey] ? (
                                      <div style={{ ...reviewCard, ...(isMobile ? reviewCardMobile : {}) }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMobile ? "8px" : "10px", flexWrap: "wrap", gap: "8px" }}>
                                          <p style={{ ...reviewTitle, margin: 0 }}>Rate member</p>
                                          <button
                                            style={{ background: "none", border: "none", color: "var(--sv-muted)", cursor: "pointer", fontSize: "12px", padding: 0 }}
                                            onClick={() => setVisibleRatingForms(curr => ({ ...curr, [reviewKey]: false }))}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                        <div style={{ marginBottom: isMobile ? "8px" : "10px" }}>
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
                                        </div>
                                        <div style={{ display: "flex", gap: "8px", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-start" }}>
                                          <textarea
                                            style={{ ...reviewTextarea, flex: 1, minHeight: isMobile ? "44px" : "60px", marginTop: 0, marginBottom: 0 }}
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
                                            placeholder="How was this member?"
                                          />
                                          <button
                                            style={{ ...secondaryButton, whiteSpace: "nowrap", alignSelf: isMobile ? "flex-end" : "auto" }}
                                            onClick={() => {
                                              submitReview({
                                                groupId: detail.id,
                                                reviewedUserId: member.user_id,
                                                existingReview: member.rating?.my_review,
                                                refreshDetail: true,
                                              });
                                              setVisibleRatingForms(curr => ({ ...curr, [reviewKey]: false }));
                                            }}
                                            disabled={submittingReviewKey === reviewKey}
                                          >
                                            {submittingReviewKey === reviewKey
                                              ? "..."
                                              : member.rating?.my_review
                                                ? "Update"
                                                : "Save"}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ marginTop: "4px" }}>
                                        <button
                                          style={{ background: "none", border: "none", color: "var(--sv-accent)", cursor: "pointer", fontSize: "13px", fontWeight: 600, padding: 0 }}
                                          onClick={() => setVisibleRatingForms(curr => ({ ...curr, [reviewKey]: true }))}
                                        >
                                          {member.rating?.my_review ? "Edit rating" : "Rate this member"}
                                        </button>
                                      </div>
                                    )
                                  ) : null}
                                </div>
                                {!isMobile ? (
                                  <div style={{ textAlign: "right", width: "auto", flexShrink: 0 }}>
                                    <span style={memberStatus(memberLabel)}>
                                      {memberLabel}
                                    </span>
                                  </div>
                                ) : null}
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
        })}
        </>
      )}
      
      {hasMoreGroups && (
        <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
          <button
            style={{ ...secondaryButton, padding: "10px 24px" }}
            onClick={() => setPage(page + 1)}
          >
            Load More
          </button>
        </div>
      )}

            </div>

      <div style={{ display: primaryTab === "joined" ? "block" : "none" }}>
        <div className={`sv-ms-section-header ${isMobile ? "is-mobile" : ""}`}>
        <div>
          <p style={sectionEyebrow}>Joined groups</p>
          <h3 className={`sv-ms-section-title ${isMobile ? "is-mobile" : ""}`}>Subscriptions you are part of</h3>
        </div>
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : joinedGroups.length === 0 ? (
        <EmptyState
          icon={SparkIcon}
          title="No joined groups yet"
          description="You haven't joined any splits. Explore the marketplace to find subscriptions."
          actions={
            <button style={primaryButton} onClick={() => navigate("/groups")}>
              Explore Marketplace
            </button>
          }
        />
      ) : (
        <div style={{ ...joinedGrid, ...(isMobile ? joinedGridMobile : {}) }}>
          {displayedJoinedGroups.map((group) => {
            const reviewTarget = group.owner_rating;
            const reviewKey = getReviewKey(group.id, group.owner_id);
            const reviewForm =
              reviewForms[reviewKey] || getInitialReviewForm(reviewTarget?.my_review);

            return (
              <div key={group.id} className={`sv-ms-card ${isMobile ? "is-mobile" : ""}`}>
                <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                    <SubscriptionLogo name={group.subscription_name} size={isMobile ? 36 : 40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "2px" }}>
                        <h3 style={{ margin: 0, fontSize: isMobile ? "16px" : "18px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{group.subscription_name}</h3>
                        {isMobile ? <span style={{ ...badge, padding: "2px 8px", fontSize: "10px", fontWeight: 700 }}>{group.status_label}</span> : null}
                      </div>
                      <p style={{ ...cardSubheading, margin: 0, fontSize: isMobile ? "13px" : "14px" }}>{group.mode_label}</p>
                    </div>
                  </div>
                  {!isMobile ? <span style={badge}>{group.status_label}</span> : null}
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
                      style={{ ...primaryButton, ...(isMobile ? actionButtonMobile : {}) }}
                      onClick={() => setMobileJoinedActionGroupId(group.id)}
                    >
                      Actions
                    </button>
                  ) : null}
                </div>

                {!isMobile ? (
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

                {!isMobile ? (
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
                      <p style={subtleText}>
                        Confirmed members: {group.confirmed_members || 0}
                        {group.remaining_confirmations !== undefined ? ` | Remaining: ${group.remaining_confirmations}` : ""}
                      </p>
                      {group.reported_issues ? (
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
                                onClick={() => requestAccessIssueReport(group.id)}
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
                      <p style={subtleText}>
                        Confirm access once the host has set you up. The host payout is released only after your confirmation.
                      </p>
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
                ) : null}
              </div>
            );
          })}

      {hasMoreJoinedGroups && (
            <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
              <button
                style={{ ...secondaryButton, padding: "10px 24px" }}
                onClick={() => setJoinedPage(joinedPage + 1)}
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}
      </div>
      </div>
    </div>
    </>
  );
}
