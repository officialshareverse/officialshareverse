import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
import { useToast } from "../components/ToastProvider";
import { CheckCircleIcon, LoadingSpinner, ShieldIcon, SparkIcon } from "../components/UiIcons";
import useIsMobile from "../hooks/useIsMobile";
import { formatCurrency, formatDate } from "../utils/format";

const PRESET_WINDOWS = [
  { label: "30 days", days: 29 },
  { label: "60 days", days: 59 },
  { label: "90 days", days: 89 },
];

const MODE_CONFIG = {
  sharing: {
    eyebrow: "Sharing",
    summaryTitle: "Sharing summary",
    helper: "Use this when you already manage the plan and want to open paid spots on the current cycle.",
    amountLabel: "Price per member",
    totalLabel: "Total cycle value",
    submitLabel: "Create sharing group",
    bullets: [
      "Best for plans you already pay for",
      "Late joiners can be prorated automatically",
      "Access is coordinated later from My Splits",
    ],
  },
  group_buy: {
    eyebrow: "Buy together",
    summaryTitle: "Buy-together summary",
    helper: "Use this when members should commit first and the purchase should happen after the group is aligned.",
    amountLabel: "Contribution per member",
    totalLabel: "Total group target",
    submitLabel: "Create buy-together group",
    bullets: [
      "Best for new cohorts, tools, or memberships",
      "Member money is held first",
      "Payout releases after proof and confirmations",
    ],
  },
};

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

function buildInitialForm() {
  const startDate = formatDateInput(new Date());
  return {
    subscription_name: "",
    mode: "sharing",
    total_slots: "2",
    price_per_slot: "",
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

function FieldError({ message }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-xs font-medium text-rose-600">{message}</p>;
}

function SummaryItem({ label, value, muted = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${muted ? "text-slate-400" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

export default function CreateGroup() {
  const navigate = useNavigate();
  const toast = useToast();
  const isMobile = useIsMobile();
  const [form, setForm] = useState(buildInitialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const modeConfig = MODE_CONFIG[form.mode];
  const memberCount = Number(form.total_slots) || 0;
  const amountPerMember = Number(form.price_per_slot) || 0;
  const estimatedTotal = memberCount * amountPerMember;
  const durationDays = useMemo(() => {
    if (!form.start_date || !form.end_date || form.end_date < form.start_date) {
      return 0;
    }

    const start = parseDateInput(form.start_date);
    const end = parseDateInput(form.end_date);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  }, [form.end_date, form.start_date]);

  const clearFieldError = (name) => {
    setErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const next = { ...current };
      delete next[name];
      return next;
    });
  };

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

    clearFieldError(name);
  };

  const handleModeChange = (mode) => {
    setForm((current) => ({ ...current, mode }));
  };

  const applyPresetWindow = (days) => {
    setForm((current) => ({
      ...current,
      end_date: addDays(current.start_date || formatDateInput(new Date()), days),
    }));
    clearFieldError("end_date");
  };

  const resetForm = () => {
    setForm(buildInitialForm());
    setErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
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
      toast.success(
        form.mode === "sharing"
          ? "Sharing group created. You can manage it from My Splits."
          : "Buy-together group created. You can track it from My Splits.",
        { title: "Split created" }
      );
      resetForm();
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
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="sv-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Create Split</p>
          <div className={`mt-3 grid gap-4 ${isMobile ? "" : "lg:grid-cols-[1.1fr_0.9fr]"}`}>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Publish the basics on one clean page.</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Pick the flow, set pricing and dates, and publish only when the listing feels clear. ShareVerse
                expects hosts to create only provider-permitted listings.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              <div className="flex items-start gap-3">
                <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Use shared-cost arrangements only where the provider allows them, and never create listings that
                  depend on password sharing or uploaded credentials.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className={`grid gap-4 ${isMobile ? "" : "lg:grid-cols-[1.1fr_0.9fr]"}`}>
          <form onSubmit={handleSubmit} className="sv-card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mode</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">Choose the split flow</h2>
              </div>
              <button type="button" onClick={resetForm} className="sv-btn-secondary">
                Reset form
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => handleModeChange("sharing")}
                className={`rounded-xl border p-4 text-left transition ${
                  form.mode === "sharing"
                    ? "border-teal-600 bg-teal-50 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sharing</p>
                <p className="mt-2 text-base font-semibold">Split an existing plan</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Open paid spots on a plan, course, or tool you already manage.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange("group_buy")}
                className={`rounded-xl border p-4 text-left transition ${
                  form.mode === "group_buy"
                    ? "border-amber-500 bg-amber-50 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Buy Together</p>
                <p className="mt-2 text-base font-semibold">Buy together first</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Collect commitments first, then buy after the group is aligned.
                </p>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{modeConfig.eyebrow}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{modeConfig.helper}</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {modeConfig.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                Plan name
                <input
                  name="subscription_name"
                  value={form.subscription_name}
                  onChange={handleChange}
                  className="sv-input"
                  placeholder="Team software, course, membership, storage plan..."
                />
                <FieldError message={errors.subscription_name} />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Total slots
                <input
                  name="total_slots"
                  value={form.total_slots}
                  onChange={handleChange}
                  className="sv-input"
                  type="number"
                  min="1"
                />
                <FieldError message={errors.total_slots} />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                {modeConfig.amountLabel}
                <input
                  name="price_per_slot"
                  value={form.price_per_slot}
                  onChange={handleChange}
                  className="sv-input"
                  type="number"
                  min="1"
                  step="0.01"
                />
                <FieldError message={errors.price_per_slot} />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Start date
                <input
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                  className="sv-input"
                  type="date"
                />
                <FieldError message={errors.start_date} />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                End date
                <input
                  name="end_date"
                  value={form.end_date}
                  onChange={handleChange}
                  className="sv-input"
                  type="date"
                />
                <FieldError message={errors.end_date} />
              </label>
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

            <div className={`flex gap-3 ${isMobile ? "flex-col" : "items-center justify-between"}`}>
              <button type="button" onClick={() => navigate("/my-shared")} className="sv-btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="sv-btn-primary">
                {loading ? (
                  <>
                    <LoadingSpinner />
                    Creating...
                  </>
                ) : (
                  <>
                    <SparkIcon className="h-4 w-4" />
                    {modeConfig.submitLabel}
                  </>
                )}
              </button>
            </div>
          </form>

          <aside className="sv-card space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Preview</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{modeConfig.summaryTitle}</h2>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {form.subscription_name.trim() || "Your split name will appear here"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{modeConfig.helper}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryItem label="Mode" value={modeConfig.eyebrow} />
              <SummaryItem label="Members" value={memberCount > 0 ? `${memberCount}` : "Add slots"} muted={memberCount <= 0} />
              <SummaryItem
                label={modeConfig.amountLabel}
                value={amountPerMember > 0 ? formatCurrency(amountPerMember) : "Add pricing"}
                muted={amountPerMember <= 0}
              />
              <SummaryItem
                label={modeConfig.totalLabel}
                value={estimatedTotal > 0 ? formatCurrency(estimatedTotal) : "Waiting for inputs"}
                muted={estimatedTotal <= 0}
              />
              <SummaryItem
                label="Window"
                value={
                  form.start_date && form.end_date
                    ? `${formatDate(form.start_date)} to ${formatDate(form.end_date)}`
                    : "Choose dates"
                }
                muted={!form.start_date || !form.end_date}
              />
              <SummaryItem
                label="Duration"
                value={durationDays > 0 ? `${durationDays} days` : "Choose valid dates"}
                muted={durationDays <= 0}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
