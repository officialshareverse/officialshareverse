export function SummaryCard({ label, value, highlight = false, compact = false }) {
  return (
    <div style={{ ...summaryCard, ...(compact ? summaryCardMobile : {}) }}>
      <p style={{ ...summaryLabel, ...(compact ? summaryLabelMobile : {}) }}>{label}</p>
      <p
        style={{
          ...summaryValue,
          ...(compact ? summaryValueMobile : {}),
          color: highlight ? "color-mix(in srgb, var(--sv-accent) 80%, #10b981 20%)" : svInk,
        }}
      >
        {value}
      </p>
    </div>
  );
}

export function MobileDrawerAction({
  icon: Icon,
  label,
  description,
  meta,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="sv-drawer-action"
    >
      <span className="sv-drawer-action-icon">
        <Icon className="h-4.5 w-4.5" />
      </span>

      <span className="sv-drawer-action-copy">
        <strong>{label}</strong>
        {description ? <span>{description}</span> : null}
      </span>

      {meta ? <span className="sv-drawer-action-meta">{meta}</span> : null}
    </button>
  );
}

export function FilterButton({ active, onClick, children, compact = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...filterButton,
        ...(compact ? filterButtonCompact : {}),
        background: active ? "var(--sv-primary-gradient)" : svPaperSoft,
        color: active ? "#fff" : svInk,
      }}
    >
      {children}
    </button>
  );
}

export function MetricBlock({ label, value }) {
  return (
    <div style={metricBlock}>
      <p style={summaryLabel}>{label}</p>
      <p style={metricValue}>{value}</p>
    </div>
  );
}

export function FactPill({ label, value, tone = "default" }) {
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

export function StarPicker({ value, onChange }) {
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

export const svPageBackground = "radial-gradient(circle at top left, var(--sv-page-radial-a), transparent 28%), radial-gradient(circle at bottom right, var(--sv-page-radial-b), transparent 24%), linear-gradient(180deg, color-mix(in srgb, var(--sv-bg) 92%, var(--sv-paper-solid) 8%) 0%, var(--sv-bg-soft) 100%)";
export const svPaperGlass = "color-mix(in srgb, var(--sv-paper) 94%, transparent)";
export const svPaperStrong = "color-mix(in srgb, var(--sv-paper-solid) 96%, transparent)";
export const svPaperSoft = "color-mix(in srgb, var(--sv-paper-solid) 90%, transparent)";
export const svAccentSoftSurface = "color-mix(in srgb, var(--sv-accent-soft) 78%, var(--sv-paper-solid) 22%)";
export const svBorder = "var(--sv-border)";
export const svInk = "var(--sv-ink)";
export const svMuted = "var(--sv-muted)";
export const svAccent = "var(--sv-accent)";
export const svShadow = "var(--sv-shadow)";

export const container = {
  padding: "28px 22px 56px",
  background: svPageBackground,
  minHeight: "100vh",
};

export const pageShell = {
  maxWidth: "1240px",
  margin: "0 auto",
};

export const containerMobile = {
  padding: "16px 14px 34px",
};

export const pageShellMobile = {
  maxWidth: "100%",
};

export const hero = {
  background: "linear-gradient(145deg, #0f172a 0%, #162033 50%, #0f766e 100%)",
  color: "#fff",
  borderRadius: "32px",
  padding: "28px",
  marginBottom: "24px",
  boxShadow: "0 34px 90px rgba(15, 23, 42, 0.20)",
};

export const heroMobile = {
  borderRadius: "24px",
  padding: "18px 16px",
  marginBottom: "18px",
};

export const eyebrow = {
  margin: 0,
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "#fbbf24",
};

export const heroText = {
  margin: 0,
  color: "#cbd5e1",
};

export const heroTitle = {
  margin: "10px 0 8px",
  fontSize: "40px",
  lineHeight: 1,
  fontWeight: 800,
};

export const heroTitleMobile = {
  fontSize: "28px",
  lineHeight: 1.05,
};

export const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "26px",
};

export const statsGridMobile = {
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
  marginBottom: "18px",
};

const summaryCard = {
  background: svPaperGlass,
  borderRadius: "24px",
  padding: "18px 18px 16px",
  boxShadow: svShadow,
  border: `1px solid ${svBorder}`,
  backdropFilter: "blur(12px)",
};

const summaryCardMobile = {
  borderRadius: "18px",
  padding: "12px 12px 11px",
};

const summaryLabel = {
  margin: 0,
  color: svMuted,
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

export const filterRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginBottom: "22px",
};

export const filterRowMobile = {
  gap: "8px",
  marginBottom: "18px",
};

export const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: "14px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

export const sectionHeaderMobile = {
  marginBottom: "12px",
};

export const joinedSectionHeader = {
  ...sectionHeader,
  marginTop: "28px",
};

export const sectionEyebrow = {
  margin: 0,
  color: svMuted,
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
};

export const sectionTitle = {
  margin: "6px 0 0",
  color: svInk,
  fontSize: "26px",
  lineHeight: 1.05,
  fontWeight: 800,
};

export const sectionTitleMobile = {
  fontSize: "22px",
};

export const sectionText = {
  margin: 0,
  color: svMuted,
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

export const card = {
  padding: "20px",
  marginBottom: "16px",
  borderRadius: "28px",
  background: svPaperGlass,
  boxShadow: svShadow,
  border: `1px solid ${svBorder}`,
  backdropFilter: "blur(12px)",
};

export const cardMobile = {
  padding: "16px",
  marginBottom: "12px",
  borderRadius: "22px",
};

export const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "8px",
};

export const cardHeaderMobile = {
  alignItems: "flex-start",
};

export const badge = {
  background: svPaperSoft,
  color: svInk,
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
};

export const subtleText = {
  margin: "4px 0",
  color: svMuted,
};

export const subtleTextCompact = {
  fontSize: "13px",
  lineHeight: 1.55,
};

export const cardSubheading = {
  margin: "6px 0 0",
  color: svMuted,
  fontSize: "14px",
};

export const descriptionText = {
  margin: "14px 0 10px",
  color: "color-mix(in srgb, var(--sv-ink) 82%, var(--sv-muted) 18%)",
  fontWeight: 500,
};

export const managementNote = (isClosed) => ({
  margin: "12px 0 0",
  color: isClosed ? "#c2410c" : svMuted,
  background: isClosed
    ? "color-mix(in srgb, #fdba74 18%, var(--sv-paper-solid) 82%)"
    : svPaperSoft,
  borderRadius: "12px",
  padding: "10px 12px",
});

export const factsRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "14px",
};

export const factsRowMobile = {
  gap: "8px",
  marginTop: "12px",
};

const factPill = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  borderRadius: "999px",
  background: svPaperSoft,
  border: `1px solid ${svBorder}`,
};

const factPillAccent = {
  background: svAccentSoftSurface,
  border: `1px solid color-mix(in srgb, ${svAccent} 28%, transparent)`,
};

const factPillWarning = {
  background: "color-mix(in srgb, #fdba74 18%, var(--sv-paper-solid) 82%)",
  border: "1px solid color-mix(in srgb, #fdba74 32%, transparent)",
};

const factLabel = {
  color: svMuted,
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const factValue = {
  color: svInk,
  fontSize: "13px",
};

export const metaLine = {
  margin: "10px 0 0",
  fontSize: "13px",
  color: svMuted,
};

const metricBlock = {
  background: svPaperStrong,
  borderRadius: "18px",
  padding: "12px",
  border: `1px solid ${svBorder}`,
};

const metricValue = {
  margin: "8px 0 0",
  fontWeight: 700,
  color: svInk,
};

export const progressBar = {
  height: "8px",
  background: "color-mix(in srgb, var(--sv-border) 86%, transparent)",
  borderRadius: "5px",
  marginTop: "12px",
};

export const progressFill = {
  height: "100%",
  background: "#22c55e",
  borderRadius: "5px",
};

export const actionRow = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
};

export const actionRowMobile = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "8px",
};

export const actionButtonMobile = {
  width: "100%",
};

export const secondaryButton = {
  border: `1px solid ${svBorder}`,
  background: svPaperStrong,
  color: svInk,
  borderRadius: "999px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

export const primaryButton = {
  border: "none",
  background: "linear-gradient(135deg, #0f172a 0%, #1f3a4a 100%)",
  color: "#fff",
  borderRadius: "999px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.14)",
};

export const warningButton = {
  border: "none",
  background: "#b45309",
  color: "#fff",
  borderRadius: "999px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

export const dangerButton = {
  border: "1px solid color-mix(in srgb, #fb7185 38%, transparent)",
  background: "color-mix(in srgb, #fb7185 12%, var(--sv-paper-solid) 88%)",
  color: "#b91c1c",
  borderRadius: "999px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

export const editPanel = {
  marginTop: "16px",
  borderTop: `1px solid ${svBorder}`,
  paddingTop: "16px",
};

export const credentialEditPanel = {
  marginTop: "16px",
  padding: "16px",
  borderRadius: "18px",
  background: svAccentSoftSurface,
  border: `1px solid color-mix(in srgb, ${svAccent} 18%, transparent)`,
};

export const editPanelHeader = {
  marginBottom: "14px",
};

export const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};

export const field = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

export const fieldLabel = {
  fontSize: "13px",
  fontWeight: 600,
  color: svInk,
};

export const input = (disabled) => ({
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "16px",
  border: `1px solid ${svBorder}`,
  background: disabled
    ? "color-mix(in srgb, var(--sv-border) 72%, var(--sv-paper-solid) 28%)"
    : "var(--sv-input-surface)",
  color: disabled ? svMuted : svInk,
});

export const textarea = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "90px",
  padding: "10px 12px",
  borderRadius: "16px",
  border: `1px solid ${svBorder}`,
  background: "var(--sv-input-surface)",
  color: svInk,
  resize: "vertical",
};

export const fileInput = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "10px",
  border: `1px dashed ${svMuted}`,
  background: svPaperStrong,
  color: svInk,
};

export const lockedNote = {
  marginTop: "12px",
  fontSize: "13px",
  color: "#92400e",
  background: "#fef3c7",
  borderRadius: "10px",
  padding: "10px 12px",
};

export const detailPanel = {
  marginTop: "18px",
  borderTop: `1px solid ${svBorder}`,
  paddingTop: "18px",
};

export const detailPanelMobile = {
  marginTop: "14px",
  paddingTop: "14px",
};

export const joinedGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
};

export const joinedGridMobile = {
  gridTemplateColumns: "1fr",
  gap: "12px",
};

export const joinedCard = {
  padding: "20px",
  borderRadius: "20px",
  background: svPaperStrong,
  boxShadow: svShadow,
  border: `1px solid ${svBorder}`,
};

export const joinedCardMobile = {
  padding: "16px",
  borderRadius: "22px",
};

export const ownerCredentialCard = {
  marginBottom: "14px",
  padding: "14px",
  borderRadius: "12px",
  background: svAccentSoftSurface,
  border: `1px solid color-mix(in srgb, ${svAccent} 22%, transparent)`,
};

export const ownerCredentialEyebrow = {
  margin: "0 0 10px",
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: svAccent,
};

export const ownerCredentialLine = {
  margin: "0 0 8px",
  color: svInk,
  wordBreak: "break-word",
};

export const memberAccessCard = (available) => ({
  marginTop: "16px",
  padding: "14px",
  borderRadius: "12px",
  background: available
    ? svAccentSoftSurface
    : "color-mix(in srgb, #fdba74 18%, var(--sv-paper-solid) 82%)",
  border: `1px solid ${available
    ? `color-mix(in srgb, ${svAccent} 22%, transparent)`
    : "color-mix(in srgb, #fdba74 32%, transparent)"}`,
});

export const memberAccessCardMobile = {
  marginTop: "14px",
  padding: "12px",
  borderRadius: "14px",
};

export const reviewCard = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "14px",
  background: svPaperSoft,
  border: `1px solid ${svBorder}`,
};

export const reviewCardMobile = {
  marginTop: "14px",
  padding: "12px",
};

export const reviewTitle = {
  margin: "0 0 8px",
  color: svInk,
  fontWeight: 700,
};

export const reviewTextarea = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "82px",
  marginTop: "10px",
  marginBottom: "10px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: `1px solid ${svBorder}`,
  background: "var(--sv-input-surface)",
  color: svInk,
  resize: "vertical",
};

const starRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const starButton = (active) => ({
  border: `1px solid ${svBorder}`,
  background: active
    ? "color-mix(in srgb, #f59e0b 22%, var(--sv-paper-solid) 78%)"
    : svPaperStrong,
  color: active ? "#b45309" : svMuted,
  borderRadius: "10px",
  padding: "8px 10px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: 1,
});

export const detailStats = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px",
  marginTop: "14px",
};

export const detailStatsMobile = {
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
};

export const detailGridLayout = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
};

export const detailGridLayoutMobile = {
  gridTemplateColumns: "1fr",
  gap: "12px",
};

export const detailSectionCard = {
  borderRadius: "24px",
  border: `1px solid ${svBorder}`,
  background: svPaperGlass,
  padding: "18px",
  backdropFilter: "blur(10px)",
};

export const detailSectionCardMobile = {
  borderRadius: "18px",
  padding: "14px",
};

export const detailSectionHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

export const detailEyebrow = {
  margin: 0,
  fontSize: "11px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: svMuted,
};

export const detailSectionTitle = {
  margin: "6px 0 0",
  color: svInk,
  fontSize: "22px",
  lineHeight: 1.08,
  fontWeight: 800,
};

export const detailSectionTitleMobile = {
  fontSize: "18px",
};

export const buyTogetherNotice = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "12px",
  background: "color-mix(in srgb, #60a5fa 14%, var(--sv-paper-solid) 86%)",
  border: "1px solid color-mix(in srgb, #60a5fa 28%, transparent)",
};

export const buyTogetherNoticeTitle = {
  margin: "0 0 8px",
  color: "#1d4ed8",
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  fontWeight: 700,
};

export const proofSummary = {
  display: "grid",
  gap: "6px",
  marginTop: "12px",
  marginBottom: "12px",
};

export const proofMeta = {
  margin: 0,
  color: "#7c2d12",
};

export const proofWarning = {
  margin: "10px 0 0",
  color: "#9a3412",
  background: "#ffedd5",
  borderRadius: "10px",
  padding: "10px 12px",
};

export const proofReadyNotice = {
  margin: "12px 0 0",
  color: "#92400e",
  background: "#fef3c7",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "14px",
  lineHeight: 1.6,
};

export const proofPending = {
  margin: "10px 0 0",
  color: "#1d4ed8",
  background: "#dbeafe",
  borderRadius: "10px",
  padding: "10px 12px",
};

export const proofApproved = {
  margin: "10px 0 0",
  color: "#166534",
  background: "#dcfce7",
  borderRadius: "10px",
  padding: "10px 12px",
};

export const memberIssueText = {
  margin: "6px 0 0",
  color: "#9a3412",
  fontSize: "13px",
  maxWidth: "420px",
};

export const proofFormCard = {
  marginTop: "14px",
  paddingTop: "14px",
  borderTop: "1px solid #fdba74",
};

export const proofLink = {
  color: svAccent,
  fontWeight: 700,
  textDecoration: "none",
};

export const memberRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "14px 0",
  borderBottom: `1px solid ${svBorder}`,
};

export const memberRowMobile = {
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "10px",
};

export const membersList = {
  marginTop: "6px",
};

export const memberName = {
  margin: 0,
  fontWeight: 700,
  color: svInk,
};

export const memberMeta = {
  margin: "4px 0 0",
  color: svMuted,
  fontSize: "13px",
};

export const memberStatus = (paidOrLabel) => {
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
      background: svPaperSoft,
      color: svMuted,
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
