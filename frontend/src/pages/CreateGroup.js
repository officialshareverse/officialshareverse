import { useMemo, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";
import { useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { useToast } from "../components/ToastProvider";
import {
  ClockIcon,
  LayersIcon,
  LoadingSpinner,
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
        "Members join first, money is held safely until both sides confirm, and payout is released only after access confirmation. Only share plans where the provider allows it.",
      accent: "amber",
      badge: "BUY",
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
    scheduleLabel: "Subscription period",
    helper:
      "If members join late, they only pay for remaining days. Only share plans where the provider allows it and never for password-sharing requests.",
    accent: "teal",
    badge: "LIVE",
  };
}

function InputError({ message }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm text-rose-600" aria-live="polite">{message}</p>;
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
      <h3 className="mt-2 sm:mt-4 text-lg sm:text-xl font-semibold text-left">{title}</h3>
      <p className={`mt-1 sm:mt-3 text-xs sm:text-sm leading-5 sm:leading-7 text-left ${active ? "text-slate-100" : "text-slate-600"}`}>{description}</p>
      <div className="hidden sm:block mt-4 space-y-2">
        {steps.map((item) => (
          <div key={item} className={`sv-create-mode-bullet ${active ? "is-active" : ""}`}>
            <span className="sv-create-mode-dot" />
            <span className="text-left text-sm">{item}</span>
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

  const isMobile = useIsMobile();

  const isSharing = form.mode === "sharing";
  const modeConfig = getModeConfig(form.mode);
  const toast = useToast();

  

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
  const isSinglePageMobile = false; // Disabled mobile one-page flow for step-by-step wizard
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
      toast.error(errorMessage, {
        title: "Couldn't create split",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-3xl space-y-3">
        <section className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Create Split
          </h1>
        </section>

        <div className="-mx-4 sm:mx-0 px-4 sm:px-0">
          <form
            onSubmit={handleWizardSubmit}
            className={`sv-create-wizard pb-24 sm:pb-0 ${isMobile ? "" : "sv-card-solid"}`}
          >
            {isMobile && (
              <div className="mb-6 flex items-center justify-between">
                <div className="flex gap-1.5 flex-1">
                  {WIZARD_STEPS.map((_, idx) => (
                    <div key={idx} className={`h-1.5 flex-1 rounded-full ${idx <= currentStep ? "bg-brand" : "bg-slate-100"}`} />
                  ))}
                </div>
              </div>
            )}
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
              <div className="mt-5 rounded-[length:var(--sv-radius-card)] border border-slate-200 bg-slate-50 px-4 py-4">
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

            <div className="sv-create-mobile-summary hidden mt-5">
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

            <div className="mt-3">
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
                        "If members join late, they only pay for remaining days.",
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
                        "Money is held safely until both sides confirm.",
                        "Payout waits for proof and confirmations.",
                      ]}
                    />
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


                </div>
              ) : null}

              {isSinglePageMobile || currentStep === 2 ? (
                <div className="sv-create-stage sv-animate-rise">
                  <section className="sv-create-section-card">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="sv-eyebrow">Timeline</p>
                        <h3 className="sv-title mt-2">
                          {isSharing ? "Set the subscription period" : "Set the funding and purchase window"}
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
                      </div>

                    <div className="sv-create-review-grid mt-3">
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

                  <div className="mt-3 rounded-xl bg-amber-50 p-3 border border-amber-200">
                    <p className="text-sm font-semibold text-amber-800">Trust Guarantee: Members' money is held safely until they confirm they got access.</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sv-create-nav fixed sm:relative bottom-0 left-0 right-0 z-50 bg-white sm:bg-transparent px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-0 sm:mt-0 sm:pt-3 border-t border-slate-100 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] sm:shadow-none flex items-center justify-between">
              {currentStep > 0 ? (
                <button type="button" onClick={moveToPreviousStep} className="sv-btn-secondary">
                  Back
                </button>
              ) : (
                <div />
              )}
              <div className="text-center hidden sm:block">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Step {currentStep + 1} of {WIZARD_STEPS.length}
                </p>
              </div>
              <button type="submit" disabled={loading} className="sv-btn-primary">
                {loading ? (
                  <>
                    <LoadingSpinner />
                    Creating...
                  </>
                ) : currentStep === finalStepIndex ? (
                  <>
                    <SparkIcon className="h-4 w-4" />
                    {isSharing ? "Publish" : "Publish"}
                  </>
                ) : (
                  <>
                    Next
                    <SparkIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>


        </div>
      </div>
    </div>
  );
}
