import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { useToast } from "../components/ToastProvider";
import {
  CheckCircleIcon,
  ClockIcon,
  LayersIcon,
  LoadingSpinner,
  ShieldIcon,
  SparkIcon,
  WalletIcon,
} from "../components/UiIcons";
import { getActivationPrefillFromState } from "./activationOptions";

const WIZARD_STEPS = [
  { id: "mode", label: "Choose mode", helper: "Pick the flow that matches your split" },
  { id: "details", label: "Plan details", helper: "Name it and set member pricing" },
  { id: "timeline", label: "Timeline", helper: "Choose the active window" },
  { id: "review", label: "Review", helper: "Preview and publish" },
];

const PRESET_WINDOWS = [
  { label: "30 days", days: 29 },
  { label: "60 days", days: 59 },
  { label: "90 days", days: 89 },
];

const COMPARISON_ROWS = [
  {
    label: "Best when",
    sharing: "You already manage the plan and want members to join the current cycle.",
    group_buy: "The group should commit first and purchase only after enough members are ready.",
  },
  {
    label: "Money flow",
    sharing: "Members pay to join the active cycle, with late-join proration when needed.",
    group_buy: "Member contributions are held until the purchase and confirmation flow is complete.",
  },
  {
    label: "After it fills",
    sharing: "You coordinate access later from My Splits when the group is ready.",
    group_buy: "You buy the plan, upload proof, and wait for member confirmations before payout.",
  },
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
      title: "Create a funded group before the purchase happens",
      description:
        "Use this when the group should commit first, then buy the plan, course, membership, or tool after enough members join.",
      summaryTitle: "Buy-together summary",
      amountLabel: "Contribution per member",
      targetLabel: "Total group target",
      scheduleLabel: "Funding window",
      helper:
        "Members join first, contributions stay protected, and payout is released only after access confirmation. Only create listings that the underlying provider allows.",
      accent: "amber",
      badge: "BUY",
      previewSteps: [
        "Open the group and collect commitments first.",
        "Track who is ready before the purchase happens.",
        "Share proof and wait for confirmations before payout.",
      ],
    };
  }

  return {
    eyebrow: "Sharing",
    title: "Open paid spots on a plan you already manage",
    description:
      "Use this when you already have the plan, course, membership, or tool and want to coordinate the current cycle cleanly.",
    summaryTitle: "Sharing summary",
    amountLabel: "Price per member",
    targetLabel: "Total cycle value",
    scheduleLabel: "Current cycle window",
    helper:
      "Late joiners are charged only for the remaining days. Use this only for provider-permitted arrangements and never for password-sharing requests.",
    accent: "teal",
    badge: "LIVE",
    previewSteps: [
      "Publish the split with pricing and dates.",
      "Let members join the active cycle.",
      "Coordinate access later from My Splits when everyone is ready.",
    ],
  };
}

function InputError({ message }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm text-rose-600">{message}</p>;
}

function StepBadge({ index, active, complete, label }) {
  return (
    <div className={`sv-create-step ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}>
      <span className="sv-create-step-index">
        {complete ? <CheckCircleIcon className="h-4 w-4" /> : `0${index + 1}`}
      </span>
      <div>
        <p className="sv-create-step-label">{label}</p>
      </div>
    </div>
  );
}

function ModeCard({ active, title, description, badgeTone, badge, onClick, steps }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sv-create-mode-card ${active ? "is-active" : ""} ${badgeTone === "amber" ? "is-amber" : "is-teal"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`sv-create-mode-graphic ${badgeTone === "amber" ? "is-amber" : "is-teal"}`}>
          {badgeTone === "amber" ? <WalletIcon className="h-6 w-6" /> : <LayersIcon className="h-6 w-6" />}
        </div>
        <span className="sv-create-mode-badge">{badge}</span>
      </div>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className={`mt-3 text-sm leading-7 ${active ? "text-slate-100" : "text-slate-600"}`}>{description}</p>
      <div className="mt-4 space-y-2">
        {steps.map((item) => (
          <div key={item} className={`sv-create-mode-bullet ${active ? "is-active" : ""}`}>
            <span className="sv-create-mode-dot" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function SummaryMetric({ label, value, muted = false }) {
  return (
    <div className="sv-create-summary-metric">
      <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className={`mt-2 text-sm font-semibold ${muted ? "text-slate-500" : "text-slate-950"}`}>{value}</span>
    </div>
  );
}

function PreviewCard({ form, memberCount, amountPerMember, durationDays, modeConfig, compact = false }) {
  const planName = form.subscription_name.trim() || "Your split name will appear here";
  const toneClass = form.mode === "sharing" ? "is-sharing" : "is-buy";

  return (
    <div className={`sv-create-preview-card ${compact ? "is-compact" : ""} ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{modeConfig.eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{planName}</h3>
        </div>
        <span className={`sv-create-preview-pill ${toneClass}`}>{modeConfig.badge}</span>
      </div>

      <div className="sv-create-preview-grid mt-4">
        <SummaryMetric
          label={modeConfig.amountLabel}
          value={amountPerMember > 0 ? `Rs ${amountPerMember.toFixed(2)}` : "Add pricing"}
          muted={amountPerMember <= 0}
        />
        <SummaryMetric
          label="Members"
          value={memberCount > 0 ? `${memberCount} slots` : "Add slots"}
          muted={memberCount <= 0}
        />
        <SummaryMetric
          label={modeConfig.scheduleLabel}
          value={
            form.start_date && form.end_date
              ? `${formatLongDate(form.start_date)} to ${formatLongDate(form.end_date)}`
              : "Choose dates"
          }
          muted={!form.start_date || !form.end_date}
        />
        <SummaryMetric
          label="Duration"
          value={durationDays > 0 ? `${durationDays} days` : "Choose valid dates"}
          muted={durationDays <= 0}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Preview fill</p>
          <span className="text-xs text-slate-500">0/{memberCount || 0} joined</span>
        </div>
        <div className="sv-create-preview-progress mt-2">
          <span className="sv-create-preview-progress-fill" style={{ width: memberCount > 0 ? "18%" : "0%" }} />
        </div>
      </div>
    </div>
  );
}

function WizardTip({ title, body }) {
  return (
    <div className="sv-create-note-card">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
    </div>
  );
}

export default function CreateGroup() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [showPreview, setShowPreview] = useState(true);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );

  const isSharing = form.mode === "sharing";
  const modeConfig = getModeConfig(form.mode);
  const toast = useToast();

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
  const finalStepIndex = WIZARD_STEPS.length - 1;
  const currentStepConfig = WIZARD_STEPS[currentStep];
  const isSinglePageMobile = isMobile;
  const formHeadTitle = isSinglePageMobile ? "Create your split" : currentStepConfig.label;
  const formHeadHelper = isSinglePageMobile
    ? activationPrefill?.template
      ? `We pre-filled this flow with a ${activationPrefill.template.label.toLowerCase()} starting point. Update anything you want before publishing.`
      : "Everything is on one page here. Choose the mode, fill the details, set the dates, and publish when the basics are ready."
    : currentStepConfig.helper;

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => {
      const next = {
        ...current,
        [name]: value,
      };

      if (name === "start_date" && next.end_date && next.end_date < value) {
        next.end_date = addDays(value, 29);
      }

      return next;
    });

    setErrors((current) => {
      if (!current[name]) {
        return current;
      }
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleModeChange = (mode) => {
    setForm((current) => ({
      ...current,
      mode,
    }));
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
    setShowPreview(true);
  };

  const moveToNextStep = () => {
    const stepErrors = validateStep(form, currentStepConfig.id);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((current) => ({
        ...current,
        ...stepErrors,
      }));
      return;
    }

    setCurrentStep((current) => Math.min(current + 1, finalStepIndex));
  };

  const moveToPreviousStep = () => {
    if (isSinglePageMobile || currentStep === 0) {
      navigate("/my-shared");
      return;
    }

    setCurrentStep((current) => Math.max(0, current - 1));
  };

  const jumpToFirstInvalidStep = (validationErrors) => {
    if (validationErrors.subscription_name || validationErrors.total_slots || validationErrors.price_per_slot) {
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

    if (!isSinglePageMobile && currentStep < finalStepIndex) {
      moveToNextStep();
      return;
    }

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      if (!isSinglePageMobile) {
        jumpToFirstInvalidStep(validationErrors);
      }
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
      await API.post("create-group/", payload);
      const createdIsSharing = form.mode === "sharing";
      toast.success(
        createdIsSharing
          ? "Sharing group created. You can manage it from My Splits."
          : "Buy-together group created. You can track it from My Splits.",
        { title: "Split created" }
      );
      resetWizard();
      navigate("/my-shared");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "We could not create the group right now.", {
        title: "Couldn't create split",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="sv-dark-hero sv-create-hero px-6 py-8 md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <p className="sv-eyebrow-on-dark">Create Split</p>
                <h1 className="sv-display-on-dark mt-4 max-w-4xl">
                  {isSinglePageMobile
                    ? "List your plan in 2 minutes."
                    : "List your plan, set the price, and publish when the basics are ready."}
                </h1>
                <p className="sv-create-hero-body mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base sm:leading-8">
                  {isSinglePageMobile
                    ? "Choose the mode, add the price and slots, set the timing, and publish."
                    : `Step ${currentStep + 1} of ${WIZARD_STEPS.length}: ${currentStepConfig.label}. Add the plan details, confirm the timing, and review the listing before it goes live.`}
                </p>
              </div>

            <div className="sv-create-hero-stats">
              <span className="sv-chip-dark">2 setup modes</span>
              <span className="sv-chip-dark">Live preview</span>
              <span className="sv-chip-dark">Guardrails before publish</span>
            </div>
          </div>

          {!isSinglePageMobile ? (
            <div className="sv-create-stepbar mt-6">
              {WIZARD_STEPS.map((step, index) => (
                <StepBadge
                  key={step.id}
                  index={index}
                  label={step.label}
                  active={index === currentStep}
                  complete={index < currentStep}
                />
              ))}
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={handleWizardSubmit}
            className={`sv-card-solid sv-create-wizard ${isSinglePageMobile ? "is-mobile-single" : ""}`}
          >
            <div className="sv-create-form-head flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="sv-eyebrow">{isSinglePageMobile ? "One-page flow" : "Wizard flow"}</p>
                <h2 className="sv-title mt-2">{formHeadTitle}</h2>
                <p className="sv-create-step-helper mt-3 max-w-3xl text-sm leading-7 text-slate-600">{formHeadHelper}</p>
              </div>
              <button type="button" onClick={resetWizard} className="sv-btn-secondary sv-create-reset-button">
                Reset form
              </button>
            </div>

            {activationPrefill?.template ? (
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Starting from {activationPrefill.template.label.toLowerCase()}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      We filled in a safer default name, slot count, and member pricing so you
                      can move faster. Review every detail before publishing the split.
                    </p>
                  </div>
                  <span className="sv-chip">
                    {activationPrefill.mode === "group_buy" ? "Buy-together template" : "Sharing template"}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="sv-create-mobile-summary mt-5">
              <div className="sv-create-mobile-summary-item">
                <span className="sv-create-mobile-summary-label">Mode</span>
                <span className="sv-create-mobile-summary-value">{modeConfig.eyebrow}</span>
              </div>
              <div className="sv-create-mobile-summary-item">
                <span className="sv-create-mobile-summary-label">Price</span>
                <span className="sv-create-mobile-summary-value">
                  {amountPerMember > 0 ? `Rs ${amountPerMember.toFixed(0)}` : "Add"}
                </span>
              </div>
              <div className="sv-create-mobile-summary-item">
                <span className="sv-create-mobile-summary-label">Slots</span>
                <span className="sv-create-mobile-summary-value">{memberCount > 0 ? memberCount : "Add"}</span>
              </div>
            </div>

            <div className="mt-6">
              {isSinglePageMobile || currentStep === 0 ? (
                <div className="sv-create-stage sv-animate-rise">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ModeCard
                      active={form.mode === "sharing"}
                      badgeTone="teal"
                      badge="LIVE"
                      title="Split an existing plan"
                      description="Open paid spots on a plan, course, or tool you already manage for the current window."
                      onClick={() => handleModeChange("sharing")}
                      steps={[
                        "Best for active subscriptions and shared tools.",
                        "Late joiners are automatically prorated.",
                        "You coordinate access later from My Splits.",
                      ]}
                    />
                    <ModeCard
                      active={form.mode === "group_buy"}
                      badgeTone="amber"
                      badge="BUY"
                      title="Buy together first"
                      description="Collect commitments first, then buy the plan after the group is filled and aligned."
                      onClick={() => handleModeChange("group_buy")}
                      steps={[
                        "Best for new cohorts, memberships, and shared software.",
                        "Member contributions are held first.",
                        "Payout waits for proof and confirmations.",
                      ]}
                    />
                  </div>

                  <div className="sv-create-comparison mt-5">
                    <div className="sv-create-comparison-head">
                      <span>Compare the flows</span>
                      <span>Sharing vs buy-together</span>
                    </div>
                    {COMPARISON_ROWS.map((row) => (
                      <div key={row.label} className="sv-create-comparison-row">
                        <div className="sv-create-comparison-label">{row.label}</div>
                        <div className="sv-create-comparison-cell">{row.sharing}</div>
                        <div className="sv-create-comparison-cell">{row.group_buy}</div>
                      </div>
                    ))}
                  </div>

                  <div className="sv-create-flow-preview mt-5">
                    {modeConfig.previewSteps.map((item, index) => (
                      <div key={item} className="sv-create-flow-step">
                        <span className="sv-create-flow-index">0{index + 1}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{item}</p>
                          <p className="mt-1 text-sm leading-7 text-slate-600">
                            {index === 0
                              ? "Start with the right model so members understand what they are joining."
                              : index === 1
                                ? "Keep pricing, member count, and timing easy to scan before people commit."
                                : "Move into live management only after the setup looks trustworthy."}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {isSinglePageMobile || currentStep === 1 ? (
                <div className="sv-create-stage sv-animate-rise">
                  <section className="sv-create-section-card">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="sv-eyebrow">Plan details</p>
                        <h3 className="sv-title mt-2">Name the split, choose slots, and set the per-member price</h3>
                      </div>
                      <span className={`sv-create-tone-pill ${isSharing ? "is-teal" : "is-amber"}`}>
                        {modeConfig.eyebrow}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-5">
                      <div>
                        <label className="text-sm font-semibold text-slate-700">Plan, course, or tool name</label>
                          <input
                            type="text"
                            name="subscription_name"
                            value={form.subscription_name}
                            onChange={handleChange}
                            placeholder="Household plan, team software, course cohort"
                            className="sv-input mt-2"
                          />
                          <InputError message={errors.subscription_name} />
                        </div>

                        {!isMobile ? (
                          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-950">
                            Publish only listings that the underlying provider permits. Do not create listings that require password uploads, credential transfers, or off-platform secret sharing.
                          </div>
                        ) : null}

                      <div className="grid gap-5 md:grid-cols-2">
                        <div>
                          <label className="text-sm font-semibold text-slate-700">Total members</label>
                          <input
                            type="number"
                            name="total_slots"
                            min="1"
                            step="1"
                            value={form.total_slots}
                            onChange={handleChange}
                            className="sv-input mt-2"
                          />
                          <p className="mt-2 text-xs text-slate-500">Enter how many members can join this split.</p>
                          <InputError message={errors.total_slots} />
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-slate-700">{modeConfig.amountLabel}</label>
                          <div className="sv-create-currency-input mt-2">
                            <span className="sv-create-currency-prefix">Rs</span>
                            <input
                              type="number"
                              name="price_per_slot"
                              min="1"
                              step="0.01"
                              value={form.price_per_slot}
                              onChange={handleChange}
                              placeholder={isSharing ? "150" : "200"}
                              className="sv-input border-0 bg-transparent shadow-none"
                            />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {isSharing
                              ? "Late joiners are charged only for the remaining days automatically."
                              : "This is the amount each member commits when joining the group."}
                          </p>
                          <InputError message={errors.price_per_slot} />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="sv-create-calculator mt-5">
                    <div>
                      <p className="sv-eyebrow">Live calculator</p>
                      <h3 className="sv-title mt-2">See the numbers update before you move to dates</h3>
                    </div>
                    <div className="sv-create-calculator-grid mt-4">
                      <SummaryMetric
                        label={modeConfig.amountLabel}
                        value={amountPerMember > 0 ? `Rs ${amountPerMember.toFixed(2)}` : "Add pricing"}
                        muted={amountPerMember <= 0}
                      />
                      <SummaryMetric
                        label="Members"
                        value={memberCount > 0 ? `${memberCount}` : "Add count"}
                        muted={memberCount <= 0}
                      />
                      <SummaryMetric
                        label={modeConfig.targetLabel}
                        value={estimatedTotal > 0 ? `Rs ${estimatedTotal.toFixed(2)}` : "Waiting for inputs"}
                        muted={estimatedTotal <= 0}
                      />
                    </div>
                  </section>
                </div>
              ) : null}

              {isSinglePageMobile || currentStep === 2 ? (
                <div className="sv-create-stage sv-animate-rise">
                  <section className="sv-create-section-card">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="sv-eyebrow">Timeline</p>
                        <h3 className="sv-title mt-2">
                          {isSharing ? "Set the current cycle window" : "Set the funding and purchase window"}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_WINDOWS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => applyPresetWindow(preset.days)}
                            className="sv-btn-secondary"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-semibold text-slate-700">
                          {isSharing ? "Cycle starts on" : "Collection starts on"}
                        </label>
                        <input
                          type="date"
                          name="start_date"
                          value={form.start_date}
                          onChange={handleChange}
                          className="sv-input mt-2"
                        />
                        <InputError message={errors.start_date} />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-slate-700">
                          {isSharing ? "Cycle ends on" : "Target completion date"}
                        </label>
                        <input
                          type="date"
                          name="end_date"
                          value={form.end_date}
                          onChange={handleChange}
                          className="sv-input mt-2"
                        />
                        <InputError message={errors.end_date} />
                      </div>
                    </div>

                    <div className="sv-create-window-card mt-5">
                      <div className="flex items-center gap-3">
                        <span className="sv-create-window-icon">
                          <ClockIcon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {durationDays > 0
                              ? `${durationDays} day window selected`
                              : "Pick valid dates to preview the window"}
                          </p>
                          <p className="mt-1 text-sm leading-7 text-slate-600">
                            {form.start_date && form.end_date
                              ? `${formatLongDate(form.start_date)} to ${formatLongDate(form.end_date)}`
                              : "Choose start and end dates to continue."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="sv-create-flow-preview mt-5">
                    {modeConfig.previewSteps.map((item, index) => (
                      <div key={item} className="sv-create-flow-step">
                        <span className="sv-create-flow-index">0{index + 1}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{item}</p>
                          <p className="mt-1 text-sm leading-7 text-slate-600">
                            {index === 0
                              ? "Dates frame the billing cycle or collection window before members see the split."
                              : index === 1
                                ? "A clear window makes the amount easier to trust."
                                : "Publishing feels much smoother when the timing already makes sense."}
                          </p>
                        </div>
                      </div>
                    ))}
                  </section>
                </div>
              ) : null}

                {!isSinglePageMobile && currentStep === 3 ? (
                  <div className="sv-create-stage sv-animate-rise">
                    <section className="sv-create-section-card">
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                          <p className="sv-eyebrow">Review</p>
                        <h3 className="sv-title mt-2">Check the listing before you publish it</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPreview((current) => !current)}
                        className="sv-btn-secondary"
                      >
                        {showPreview ? "Hide preview" : "Preview card"}
                      </button>
                    </div>

                    <div className="sv-create-review-grid mt-5">
                      <SummaryMetric
                        label="Split name"
                        value={form.subscription_name.trim() || "Name not set yet"}
                        muted={!form.subscription_name.trim()}
                      />
                      <SummaryMetric label="Mode" value={modeConfig.eyebrow} />
                      <SummaryMetric
                        label={modeConfig.amountLabel}
                        value={amountPerMember > 0 ? `Rs ${amountPerMember.toFixed(2)}` : "Add pricing"}
                        muted={amountPerMember <= 0}
                      />
                      <SummaryMetric
                        label="Members"
                        value={memberCount > 0 ? `${memberCount}` : "Add member count"}
                        muted={memberCount <= 0}
                      />
                      <SummaryMetric
                        label={modeConfig.targetLabel}
                        value={estimatedTotal > 0 ? `Rs ${estimatedTotal.toFixed(2)}` : "Waiting for inputs"}
                        muted={estimatedTotal <= 0}
                      />
                      <SummaryMetric
                        label={modeConfig.scheduleLabel}
                        value={
                          form.start_date && form.end_date
                            ? `${formatLongDate(form.start_date)} to ${formatLongDate(form.end_date)}`
                            : "Choose dates"
                        }
                        muted={!form.start_date || !form.end_date}
                      />
                    </div>
                  </section>

                  {showPreview ? (
                    <div className="mt-5">
                      <PreviewCard
                        form={form}
                        memberCount={memberCount}
                        amountPerMember={amountPerMember}
                        durationDays={durationDays}
                        modeConfig={modeConfig}
                      />
                    </div>
                  ) : null}

                  <section className="sv-create-checklist mt-5">
                    <div className="sv-create-check-item">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                      <span>Mode matches the real flow members will follow.</span>
                    </div>
                    <div className="sv-create-check-item">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                      <span>Pricing, member count, and timing are easy to scan.</span>
                    </div>
                    <div className="sv-create-check-item">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                      <span>Preview looks clear enough to publish confidently.</span>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>

            <div className="sv-create-nav mt-6">
              <button type="button" onClick={moveToPreviousStep} className="sv-btn-secondary">
                {isSinglePageMobile || currentStep === 0 ? "Cancel" : "Back"}
              </button>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {isSinglePageMobile ? "Mobile create flow" : `Step ${currentStep + 1} of ${WIZARD_STEPS.length}`}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {isSinglePageMobile ? "Fill the essentials here, then publish when the split is ready." : currentStepConfig.helper}
                  </p>
                </div>
              <button type="submit" disabled={loading} className="sv-btn-primary">
                {loading ? (
                  <>
                    <LoadingSpinner />
                    Creating...
                  </>
                ) : isSinglePageMobile || currentStep === finalStepIndex ? (
                  <>
                    <SparkIcon className="h-4 w-4" />
                    {isSharing ? "Create sharing group" : "Create buy-together group"}
                  </>
                ) : (
                  <>
                    Next step
                    <SparkIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <aside className="space-y-6 sv-create-sidepanel">
            <section className="sv-card-solid sv-create-sidebar">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="sv-eyebrow">Live summary</p>
                  <h2 className="sv-title mt-2">{modeConfig.summaryTitle}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview((current) => !current)}
                  className="sv-btn-secondary"
                >
                  {showPreview ? "Hide preview" : "Preview"}
                </button>
              </div>

              <p className="mt-3 text-sm leading-7 text-slate-600">{modeConfig.helper}</p>

              <div className="sv-create-summary-grid mt-5">
                <SummaryMetric
                  label="Plan"
                  value={form.subscription_name.trim() || "Name not set yet"}
                  muted={!form.subscription_name.trim()}
                />
                <SummaryMetric label="Mode" value={modeConfig.eyebrow} />
                <SummaryMetric
                  label={modeConfig.amountLabel}
                  value={amountPerMember > 0 ? `Rs ${amountPerMember.toFixed(2)}` : "Add pricing"}
                  muted={amountPerMember <= 0}
                />
                <SummaryMetric
                  label="Members"
                  value={memberCount > 0 ? `${memberCount}` : "Add member count"}
                  muted={memberCount <= 0}
                />
                <SummaryMetric
                  label={modeConfig.targetLabel}
                  value={estimatedTotal > 0 ? `Rs ${estimatedTotal.toFixed(2)}` : "Waiting for inputs"}
                  muted={estimatedTotal <= 0}
                />
                <SummaryMetric
                  label="Duration"
                  value={durationDays > 0 ? `${durationDays} days` : "Choose valid dates"}
                  muted={durationDays <= 0}
                />
              </div>

              {showPreview ? (
                <div className="mt-5">
                  <PreviewCard
                    form={form}
                    memberCount={memberCount}
                    amountPerMember={amountPerMember}
                    durationDays={durationDays}
                    modeConfig={modeConfig}
                    compact
                  />
                </div>
              ) : null}
            </section>

            <section className="sv-card-solid">
              <p className="sv-eyebrow">Setup notes</p>
              <div className="mt-4 space-y-4">
                <WizardTip
                  title="Keep pricing simple"
                  body="Use one clean per-member amount that feels easy to trust. You can clarify edge cases later in chat."
                />
                <WizardTip
                  title="Only list provider-permitted plans"
                  body="Household, team, or membership plans should match the underlying provider rules. If the provider does not allow the arrangement, do not publish it on ShareVerse."
                />
                <WizardTip
                  title="Choose realistic timing"
                  body="Match the billing cycle or funding window so members immediately understand what they are paying for."
                />
                <WizardTip
                  title="Preview before publish"
                  body="A quick visual check helps you catch vague names, confusing dates, or pricing that needs tightening."
                />
                <div className="sv-create-note-card">
                  <div className="flex items-start gap-3">
                    <ShieldIcon className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">Creator guardrails</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        You can edit empty groups later. Once members join, pricing and core details lock to protect active joins. ShareVerse also expects hosts to avoid credential-sharing or provider-restricted listings.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
