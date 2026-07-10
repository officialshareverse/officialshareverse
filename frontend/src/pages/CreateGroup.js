import { useMemo, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";
import { useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { useToast } from "../components/ToastProvider";
import {
  ClockIcon,
  LayersIcon,
  LoadingSpinner,
  PlusIcon,
  ShieldIcon,
  SparkIcon,
  WalletIcon,
} from "../components/UiIcons";
import { trackGroupCreated } from "../utils/analytics";
import { getActivationPrefillFromState } from "./activationOptions";

/* ---- Local inline icons (kept here so no new UiIcons exports are needed) ----
 * These mirror the stroke style of UiIcons (1.9 stroke, round caps) so they
 * stay visually consistent with the rest of the app. */
function svgIconProps({ className = "h-5 w-5", strokeWidth = 1.9 } = {}) {
  return {
    className,
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };
}

function CheckIcon(props) {
  return (
    <svg {...svgIconProps(props)}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

function ChevronLeftIcon(props) {
  return (
    <svg {...svgIconProps(props)}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function MinusIcon(props) {
  return (
    <svg {...svgIconProps(props)}>
      <path d="M5 12h14" />
    </svg>
  );
}

/**
 * CreateGroup — mobile-first redesign.
 *
 * Same 4-step wizard (Mode -> Plan details -> Timeline -> Review), same
 * /create-group/ payload, same imports as the original. The mobile layout is
 * rebuilt around:
 *   - a compact sticky header with the step indicator + step title
 *   - large tappable mode cards stacked vertically (single column on phone)
 *   - stepper inputs for member count (so you never fight the small keyboard)
 *   - chip-based preset windows for the timeline
 *   - a calm, receipt-style review card
 *   - a single primary CTA pinned to the bottom safe-area for thumb reach
 *
 * Desktop keeps the wizard but uses the same refined components, so the two
 * layouts stay visually consistent.
 */

const WIZARD_STEPS = [
  { id: "mode", label: "Mode", helper: "Pick the flow that matches your split" },
  { id: "details", label: "Details", helper: "Name it and set member pricing" },
  { id: "timeline", label: "Timeline", helper: "Choose the active window" },
  { id: "review", label: "Review", helper: "Preview and publish" },
];

const PRESET_WINDOWS = [
  { label: "30d", days: 29, hint: "30 days" },
  { label: "60d", days: 59, hint: "60 days" },
  { label: "90d", days: 89, hint: "90 days" },
];

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value) {
  if (!value) {
    return new Date();
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(input, days) {
  const base = parseDateInput(input);
  base.setDate(base.getDate() + days);
  return formatDateInput(base);
}

function formatLongDate(value) {
  if (!value) {
    return "Choose dates";
  }
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildInitialForm(prefill = null) {
  const startDate = formatDateInput(new Date());
  return {
    subscription_name: prefill?.subscription_name || "",
    mode: prefill?.mode || "sharing",
    total_slots: prefill?.total_slots || "2",
    price_per_slot: prefill?.price_per_slot || "",
    start_date: startDate,
    end_date: addDays(startDate, 29),
  };
}

function validateForm(form) {
  const errors = {};
  const slotCount = Number(form.total_slots);
  const price = Number(form.price_per_slot);

  if (!form.subscription_name.trim()) {
    errors.subscription_name = "Add the plan, course, or tool name.";
  }

  if (!form.total_slots || !Number.isInteger(slotCount) || slotCount <= 0) {
    errors.total_slots = "Enter a valid member count.";
  }

  if (!form.price_per_slot || Number.isNaN(price) || price <= 0) {
    errors.price_per_slot = "Enter a valid amount greater than zero.";
  }

  if (!form.start_date) {
    errors.start_date = "Pick a start date.";
  }

  if (!form.end_date) {
    errors.end_date = "Pick an end date.";
  }

  if (form.start_date && form.end_date && form.end_date < form.start_date) {
    errors.end_date = "End date cannot be earlier than the start date.";
  }

  return errors;
}

function validateStep(form, stepId) {
  const allErrors = validateForm(form);
  if (stepId === "details") {
    return Object.fromEntries(
      Object.entries(allErrors).filter(([key]) =>
        ["subscription_name", "total_slots", "price_per_slot"].includes(key)
      )
    );
  }

  if (stepId === "timeline") {
    return Object.fromEntries(
      Object.entries(allErrors).filter(([key]) => ["start_date", "end_date"].includes(key))
    );
  }

  return {};
}

function getModeConfig(mode) {
  if (mode === "group_buy") {
    return {
      eyebrow: "Buy Together",
      title: "Buy together first",
      description:
        "Collect commitments first, then buy the plan, course, membership, or tool after enough members join.",
      summaryTitle: "Buy-together summary",
      amountLabel: "Contribution per member",
      targetLabel: "Total group target",
      scheduleLabel: "Funding window",
      startLabel: "Collection starts on",
      endLabel: "Target completion date",
      helper:
        "Members join first, money is held safely until both sides confirm, and payout is released only after access confirmation. Only share plans where the provider allows it.",
      accent: "amber",
      badge: "BUY",
      icon: WalletIcon,
      steps: [
        "Best for new cohorts, memberships, and shared software.",
        "Money is held safely until both sides confirm.",
        "Payout waits for proof and confirmations.",
      ],
    };
  }

  return {
    eyebrow: "Sharing",
    title: "Split an existing plan",
    description:
      "Open paid spots on a plan, course, membership, or tool you already manage for the current window.",
    summaryTitle: "Sharing summary",
    amountLabel: "Price per member",
    targetLabel: "Total cycle value",
    scheduleLabel: "Subscription period",
    startLabel: "Cycle starts on",
    endLabel: "Cycle ends on",
    helper:
      "If members join late, they only pay for remaining days. Only share plans where the provider allows it and never for password-sharing requests.",
    accent: "teal",
    badge: "LIVE",
    icon: LayersIcon,
    steps: [
      "Best for active subscriptions and shared tools.",
      "If members join late, they only pay for remaining days.",
      "You coordinate access later from My Splits.",
    ],
  };
}

function FieldError({ message }) {
  if (!message) {
    return null;
  }
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-rose-600" aria-live="polite">
      <span aria-hidden="true" className="mt-0.5 inline-block h-1 w-1 flex-none rounded-full bg-rose-500" />
      <span>{message}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile-first mode selector                                         */
/* ------------------------------------------------------------------ */
function ModeTile({ active, mode, title, description, badge, steps, tone, onClick }) {
  const Icon = mode.icon;
  const tileTone = tone === "amber" ? "is-amber" : "is-teal";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`sv-cg-mode-tile ${tileTone} ${active ? "is-active" : ""}`}
    >
      <div className="sv-cg-mode-tile-head">
        <span className={`sv-cg-mode-icon ${tileTone}`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>
        <span className="sv-cg-mode-badge">{badge}</span>
        <span className={`sv-cg-mode-check ${active ? "is-visible" : ""}`} aria-hidden={!active}>
          <CheckIcon className="h-3.5 w-3.5" />
        </span>
      </div>

      <h3 className="sv-cg-mode-title">{title}</h3>
      <p className="sv-cg-mode-desc">{description}</p>

      <ul className="sv-cg-mode-steps">
        {steps.map((step) => (
          <li key={step} className="sv-cg-mode-step">
            <span className="sv-cg-mode-step-dot" aria-hidden="true" />
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper-style number input for member count                        */
/* ------------------------------------------------------------------ */
function MemberStepper({ value, onChange, error }) {
  const count = Number(value) || 0;
  const clamp = (next) => String(Math.max(1, next));

  const decrement = () => onChange({ target: { name: "total_slots", value: clamp(count - 1) } });
  const increment = () => onChange({ target: { name: "total_slots", value: clamp(count + 1) } });

  return (
    <div className={`sv-cg-stepper ${error ? "has-error" : ""}`}>
      <button
        type="button"
        onClick={decrement}
        aria-label="Decrease members"
        className="sv-cg-stepper-btn"
        disabled={count <= 1}
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <input
        type="number"
        name="total_slots"
        min="1"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={onChange}
        aria-label="Total members"
        className="sv-cg-stepper-input"
      />
      <button
        type="button"
        onClick={increment}
        aria-label="Increase members"
        className="sv-cg-stepper-btn"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sticky header (mobile) / inline header (desktop)                   */
/* ------------------------------------------------------------------ */
function WizardHeader({
  isMobile,
  currentStep,
  totalSteps,
  stepLabel,
  stepHelper,
  onBack,
  onReset,
  canReset,
}) {
  if (!isMobile) {
    return (
      <div className="sv-cg-desktop-head">
        <div>
          <p className="sv-eyebrow">Wizard flow</p>
          <h2 className="sv-title mt-2">{stepLabel}</h2>
          <p className="sv-cg-helper mt-2 max-w-2xl text-sm leading-7 text-slate-600">{stepHelper}</p>
        </div>
        {canReset && (
          <button type="button" onClick={onReset} className="sv-btn-secondary sv-cg-reset-btn">
            Reset form
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="sv-cg-mobile-head">
      <button
        type="button"
        onClick={onBack}
        className="sv-cg-back-btn"
        aria-label={currentStep === 0 ? "Go back to My Splits" : "Previous step"}
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <div className="sv-cg-mobile-head-text">
        <p className="sv-cg-mobile-step-eyebrow">
          Step {currentStep + 1} of {totalSteps}
        </p>
        <h2 className="sv-cg-mobile-step-title">{stepLabel}</h2>
      </div>
      {canReset ? (
        <button type="button" onClick={onReset} className="sv-cg-reset-chip" aria-label="Reset form">
          Reset
        </button>
      ) : (
        <span className="sv-cg-head-spacer" aria-hidden="true" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sticky bottom CTA bar                                              */
/* ------------------------------------------------------------------ */
function BottomNav({ isMobile, currentStep, totalSteps, loading, isLastStep, isSharing, onBack }) {
  const submitLabel = loading ? "Creating..." : isLastStep ? "Publish split" : "Continue";
  const SubmitIcon = loading ? LoadingSpinner : isLastStep ? SparkIcon : null;

  if (isMobile) {
    return (
      <div className="sv-cg-bottom-nav">
        {currentStep > 0 ? (
          <button type="button" onClick={onBack} className="sv-cg-bottom-back" aria-label="Back">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className={`sv-cg-bottom-cta ${currentStep === 0 ? "is-full" : ""}`}
        >
          {SubmitIcon && <SubmitIcon className="h-4 w-4" />}
          <span>{submitLabel}</span>
          {!loading && !isLastStep ? <ChevronLeftIcon className="h-4 w-4 rotate-180" /> : null}
        </button>
      </div>
    );
  }

  return (
    <div className="sv-cg-desktop-nav">
      {currentStep > 0 ? (
        <button type="button" onClick={onBack} className="sv-btn-secondary">
          Back
        </button>
      ) : null}
      <p className="sv-cg-desktop-step-meta">
        Step {currentStep + 1} of {totalSteps}
      </p>
      <button type="submit" disabled={loading} className="sv-btn-primary">
        {SubmitIcon && <SubmitIcon className="h-4 w-4" />}
        <span>{submitLabel}</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */
export default function CreateGroup() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const toast = useToast();

  const activationPrefill = useMemo(
    () => getActivationPrefillFromState(location.state),
    [location.state]
  );

  const initialForm = useMemo(
    () =>
      buildInitialForm(
        activationPrefill
          ? {
              ...activationPrefill.formDefaults,
              mode: activationPrefill.mode,
            }
          : null
      ),
    [activationPrefill]
  );

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const isSharing = form.mode === "sharing";
  const modeConfig = getModeConfig(form.mode);
  const finalStepIndex = WIZARD_STEPS.length - 1;
  const currentStepConfig = WIZARD_STEPS[currentStep];

  const durationDays = useMemo(() => {
    if (!form.start_date || !form.end_date || form.end_date < form.start_date) {
      return 0;
    }
    const start = parseDateInput(form.start_date);
    const end = parseDateInput(form.end_date);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  }, [form.end_date, form.start_date]);

  const memberCount = Number(form.total_slots) || 0;
  const amountPerMember = Number(form.price_per_slot) || 0;
  const estimatedTotal = memberCount * amountPerMember;

  /* ---------------- handlers ---------------- */
  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "start_date" && next.end_date && next.end_date < value) {
        next.end_date = addDays(value, 29);
      }
      return next;
    });
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleModeChange = (mode) => {
    setForm((current) => ({ ...current, mode }));
  };

  const applyPresetWindow = (days) => {
    setForm((current) => ({
      ...current,
      end_date: addDays(current.start_date || formatDateInput(new Date()), days),
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.end_date;
      return next;
    });
  };

  const resetWizard = () => {
    setForm(initialForm);
    setErrors({});
    setCurrentStep(0);
  };

  const moveToNextStep = () => {
    const stepErrors = validateStep(form, currentStepConfig.id);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((current) => ({ ...current, ...stepErrors }));
      return;
    }
    setCurrentStep((current) => Math.min(current + 1, finalStepIndex));
  };

  const moveToPreviousStep = () => {
    if (currentStep === 0) {
      navigate("/my-shared");
      return;
    }
    setCurrentStep((current) => Math.max(0, current - 1));
  };

  const jumpToFirstInvalidStep = (validationErrors) => {
    if (
      validationErrors.subscription_name ||
      validationErrors.total_slots ||
      validationErrors.price_per_slot
    ) {
      setCurrentStep(1);
      return;
    }
    if (validationErrors.start_date || validationErrors.end_date) {
      setCurrentStep(2);
      return;
    }
    setCurrentStep(0);
  };

  const handleWizardSubmit = async (event) => {
    event.preventDefault();
    if (currentStep < finalStepIndex) {
      moveToNextStep();
      return;
    }

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      jumpToFirstInvalidStep(validationErrors);
      return;
    }

    const payload = {
      subscription_name: form.subscription_name.trim(),
      mode: form.mode,
      total_slots: Number(form.total_slots),
      price_per_slot: form.price_per_slot,
      start_date: form.start_date,
      end_date: form.end_date,
    };

    try {
      setLoading(true);
      const response = await API.post("create-group/", payload);
      trackGroupCreated(payload, response.data || {});
      toast.success(
        isSharing
          ? "Sharing group created. You can manage it from My Splits."
          : "Buy-together group created. You can track it from My Splits.",
        { title: "Split created" }
      );
      resetWizard();
      navigate("/my-shared");
    } catch (err) {
      console.error(err);
      let errorMessage = "We could not create the group right now.";
      if (err.response?.data) {
        if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (typeof err.response.data === "object") {
          const firstKey = Object.keys(err.response.data)[0];
          const firstVal = err.response.data[firstKey];
          if (Array.isArray(firstVal) && firstVal.length > 0) {
            errorMessage = firstVal[0];
          }
        }
      }
      toast.error(errorMessage, { title: "Couldn't create split" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = handleWizardSubmit;

  const progressPct = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  /* ---------------- render ---------------- */
  return (
    <div className="sv-page sv-cg-page">
      <div className={`sv-cg-shell ${isMobile ? "is-mobile" : "is-desktop"}`}>
        {/* Desktop-only page title (mobile uses the sticky header) */}
        {!isMobile && (
          <section className="sv-cg-page-head">
            <div>
              <p className="sv-eyebrow">New split</p>
              <h1 className="sv-cg-page-title">Create a split</h1>
            </div>
            <p className="sv-cg-page-sub">
              Walk through four quick steps to publish a sharing or buy-together split.
            </p>
          </section>
        )}

        <form onSubmit={handleSubmit} className={`sv-cg-form ${isMobile ? "is-mobile" : "sv-card-solid"}`}>
          {/* Progress rail (mobile) */}
          {isMobile && (
            <div className="sv-cg-progress-rail" aria-hidden="true">
              <div className="sv-cg-progress-track" />
              <div
                className="sv-cg-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          <WizardHeader
            isMobile={isMobile}
            currentStep={currentStep}
            totalSteps={WIZARD_STEPS.length}
            stepLabel={currentStepConfig.label}
            stepHelper={currentStepConfig.helper}
            onBack={moveToPreviousStep}
            onReset={resetWizard}
            canReset={currentStep > 0 || Object.keys(errors).length > 0}
          />

          {activationPrefill?.template && (
            <div className="sv-cg-prefill-banner">
              <div className="sv-cg-prefill-icon">
                <SparkIcon className="h-4 w-4" />
              </div>
              <div className="sv-cg-prefill-body">
                <p className="sv-cg-prefill-title">
                  Starting from {activationPrefill.template.label.toLowerCase()}
                </p>
                <p className="sv-cg-prefill-desc">
                  We filled in a safer default name, slot count, and member pricing. Review every
                  detail before publishing.
                </p>
              </div>
              <span className="sv-chip">
                {activationPrefill.mode === "group_buy" ? "Buy-together" : "Sharing"}
              </span>
            </div>
          )}

          {/* ---------------- STEP 0: MODE ---------------- */}
          {currentStep === 0 && (
            <div className="sv-cg-stage sv-cg-animate-rise" key="stage-mode">
              <div className="sv-cg-mode-grid">
                <ModeTile
                  active={form.mode === "sharing"}
                  mode={getModeConfig("sharing")}
                  tone="teal"
                  badge="LIVE"
                  title="Split an existing plan"
                  description="Open paid spots on a plan, course, or tool you already manage for the current window."
                  steps={[
                    "Best for active subscriptions and shared tools.",
                    "Late joiners pay only for remaining days.",
                    "You coordinate access later from My Splits.",
                  ]}
                  onClick={() => handleModeChange("sharing")}
                />
                <ModeTile
                  active={form.mode === "group_buy"}
                  mode={getModeConfig("group_buy")}
                  tone="amber"
                  badge="BUY"
                  title="Buy together first"
                  description="Collect commitments first, then buy the plan after the group is filled and aligned."
                  steps={[
                    "Best for new cohorts, memberships, and software.",
                    "Money is held safely until both sides confirm.",
                    "Payout waits for proof and confirmations.",
                  ]}
                  onClick={() => handleModeChange("group_buy")}
                />
              </div>

              <div className="sv-cg-mode-helper">
                <span className={`sv-cg-mode-helper-pill ${isSharing ? "is-teal" : "is-amber"}`}>
                  {modeConfig.eyebrow}
                </span>
                <p className="sv-cg-mode-helper-text">{modeConfig.helper}</p>
              </div>
            </div>
          )}

          {/* ---------------- STEP 1: DETAILS ---------------- */}
          {currentStep === 1 && (
            <div className="sv-cg-stage sv-cg-animate-rise" key="stage-details">
              <div className="sv-cg-section-card">
                <div className="sv-cg-section-head">
                  <div>
                    <p className="sv-eyebrow">Plan details</p>
                    <h3 className="sv-cg-section-title">
                      Name the split, choose members, and set the price
                    </h3>
                  </div>
                  <span className={`sv-cg-tone-pill ${isSharing ? "is-teal" : "is-amber"}`}>
                    {modeConfig.eyebrow}
                  </span>
                </div>

                <div className="sv-cg-field-stack">
                  {/* Name */}
                  <label className="sv-cg-field">
                    <span className="sv-cg-field-label">Plan, course, or tool name</span>
                    <div className={`sv-cg-input-shell ${errors.subscription_name ? "has-error" : ""}`}>
                      <input
                        type="text"
                        name="subscription_name"
                        value={form.subscription_name}
                        onChange={handleChange}
                        placeholder="e.g. Household plan"
                        className="sv-cg-input"
                        autoFocus={!isMobile}
                      />
                    </div>
                    <FieldError message={errors.subscription_name} />
                  </label>

                  {/* Members + Price row */}
                  <div className="sv-cg-duo-grid">
                    <label className="sv-cg-field">
                      <span className="sv-cg-field-label">Total members</span>
                      <MemberStepper
                        value={form.total_slots}
                        onChange={handleChange}
                        error={errors.total_slots}
                      />
                      <p className="sv-cg-field-hint">How many members can join.</p>
                      <FieldError message={errors.total_slots} />
                    </label>

                    <label className="sv-cg-field">
                      <span className={`sv-cg-field-label ${isSharing ? "is-teal" : "is-amber"}`}>
                        {modeConfig.amountLabel}
                      </span>
                      <div
                        className={`sv-cg-amount-shell ${isSharing ? "is-teal" : "is-amber"} ${
                          errors.price_per_slot ? "has-error" : ""
                        }`}
                      >
                        <span className="sv-cg-amount-currency">Rs</span>
                        <input
                          type="number"
                          name="price_per_slot"
                          min="1"
                          step="0.01"
                          inputMode="decimal"
                          value={form.price_per_slot}
                          onChange={handleChange}
                          placeholder={isSharing ? "150" : "200"}
                          className="sv-cg-amount-input"
                        />
                      </div>
                      <p className={`sv-cg-field-hint ${isSharing ? "is-teal" : "is-amber"}`}>
                        {isSharing
                          ? "Late joiners pay only for remaining days."
                          : "Amount members commit to join."}
                      </p>
                      <FieldError message={errors.price_per_slot} />
                    </label>
                  </div>

                  {/* Live mini-summary */}
                  <div className="sv-cg-mini-summary">
                    <div className="sv-cg-mini-summary-cell">
                      <span className="sv-cg-mini-summary-label">Members</span>
                      <span className="sv-cg-mini-summary-value">
                        {memberCount > 0 ? `x ${memberCount}` : "—"}
                      </span>
                    </div>
                    <div className="sv-cg-mini-summary-cell">
                      <span className="sv-cg-mini-summary-label">Per member</span>
                      <span className="sv-cg-mini-summary-value">
                        {amountPerMember > 0 ? `Rs ${amountPerMember.toFixed(0)}` : "—"}
                      </span>
                    </div>
                    <div className="sv-cg-mini-summary-cell is-total">
                      <span className="sv-cg-mini-summary-label">{modeConfig.targetLabel}</span>
                      <span className="sv-cg-mini-summary-value is-total">
                        {estimatedTotal > 0 ? `Rs ${estimatedTotal.toFixed(0)}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- STEP 2: TIMELINE ---------------- */}
          {currentStep === 2 && (
            <div className="sv-cg-stage sv-cg-animate-rise" key="stage-timeline">
              <div className="sv-cg-section-card">
                <div className="sv-cg-section-head">
                  <div>
                    <p className="sv-eyebrow">Timeline</p>
                    <h3 className="sv-cg-section-title">
                      {isSharing ? "Set the subscription period" : "Set the funding and purchase window"}
                    </h3>
                  </div>
                </div>

                <div className="sv-cg-preset-row">
                  {PRESET_WINDOWS.map((preset) => {
                    const isActive = durationDays === preset.days + 1;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPresetWindow(preset.days)}
                        className={`sv-cg-preset-chip ${isActive ? "is-active" : ""}`}
                        aria-pressed={isActive}
                      >
                        <span className="sv-cg-preset-label">{preset.label}</span>
                        <span className="sv-cg-preset-hint">{preset.hint}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="sv-cg-duo-grid">
                  <label className="sv-cg-field">
                    <span className="sv-cg-field-label">{modeConfig.startLabel}</span>
                    <input
                      type="date"
                      name="start_date"
                      value={form.start_date}
                      onChange={handleChange}
                      className={`sv-cg-input sv-cg-date-input ${
                        errors.start_date ? "has-error" : ""
                      }`}
                    />
                    <FieldError message={errors.start_date} />
                  </label>

                  <label className="sv-cg-field">
                    <span className="sv-cg-field-label">{modeConfig.endLabel}</span>
                    <input
                      type="date"
                      name="end_date"
                      value={form.end_date}
                      onChange={handleChange}
                      className={`sv-cg-input sv-cg-date-input ${
                        errors.end_date ? "has-error" : ""
                      }`}
                    />
                    <FieldError message={errors.end_date} />
                  </label>
                </div>

                <div className="sv-cg-window-card">
                  <span className="sv-cg-window-icon">
                    <ClockIcon className="h-5 w-5" />
                  </span>
                  <div className="sv-cg-window-body">
                    <p className="sv-cg-window-title">
                      {durationDays > 0
                        ? `${durationDays} day window selected`
                        : "Pick valid dates to preview the window"}
                    </p>
                    <p className="sv-cg-window-meta">
                      {form.start_date && form.end_date
                        ? `${formatLongDate(form.start_date)} \u2192 ${formatLongDate(form.end_date)}`
                        : "Choose start and end dates to continue."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- STEP 3: REVIEW ---------------- */}
          {currentStep === 3 && (
            <div className="sv-cg-stage sv-cg-animate-rise" key="stage-review">
              <div className="sv-cg-section-card">
                <div className="sv-cg-section-head">
                  <div>
                    <p className="sv-eyebrow">Review</p>
                    <h3 className="sv-cg-section-title">Check the listing before you publish it</h3>
                  </div>
                </div>

                <div className={`sv-cg-receipt ${isSharing ? "is-sharing" : "is-buy"}`}>
                  <div className="sv-cg-receipt-head">
                    <p className="sv-cg-receipt-eyebrow">Receipt</p>
                    <h4 className="sv-cg-receipt-name">
                      {form.subscription_name.trim() || "Draft Split"}
                    </h4>
                    <span className={`sv-cg-receipt-pill ${isSharing ? "is-teal" : "is-amber"}`}>
                      {modeConfig.eyebrow}
                    </span>
                  </div>

                  <dl className="sv-cg-receipt-rows">
                    <div className="sv-cg-receipt-row">
                      <dt>{modeConfig.amountLabel}</dt>
                      <dd>{amountPerMember > 0 ? `Rs ${amountPerMember.toFixed(2)}` : "\u2014"}</dd>
                    </div>
                    <div className="sv-cg-receipt-row">
                      <dt>Members</dt>
                      <dd>x {memberCount > 0 ? memberCount : "\u2014"}</dd>
                    </div>
                    <div className="sv-cg-receipt-row">
                      <dt>{modeConfig.scheduleLabel}</dt>
                      <dd className="sv-cg-receipt-row-schedule">
                        {form.start_date && form.end_date
                          ? `${formatLongDate(form.start_date)} \u2192 ${formatLongDate(form.end_date)}`
                          : "\u2014"}
                      </dd>
                    </div>
                  </dl>

                  <div className="sv-cg-receipt-total">
                    <span>{modeConfig.targetLabel}</span>
                    <span className="sv-cg-receipt-total-value">
                      {estimatedTotal > 0 ? `Rs ${estimatedTotal.toFixed(2)}` : "\u2014"}
                    </span>
                  </div>
                </div>

                <div className="sv-cg-trust-note">
                  <span className="sv-cg-trust-icon">
                    <ShieldIcon className="h-4 w-4" />
                  </span>
                  <p className="sv-cg-trust-text">
                    <strong>Trust Guarantee:</strong> Members&rsquo; money is held safely until they
                    confirm they got access.
                  </p>
                </div>
              </div>
            </div>
          )}

          <BottomNav
            isMobile={isMobile}
            currentStep={currentStep}
            totalSteps={WIZARD_STEPS.length}
            loading={loading}
            isLastStep={currentStep === finalStepIndex}
            isSharing={isSharing}
            onBack={moveToPreviousStep}
          />
        </form>
      </div>
    </div>
  );
}
