import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";

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
    access_identifier: "",
    access_password: "",
    access_notes: "",
    start_date: startDate,
    end_date: addDays(startDate, 29),
  };
}

function validateForm(form, isSharing) {
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

  if (isSharing && !form.access_identifier.trim()) {
    errors.access_identifier = "Add the login email or username you manage.";
  }

  if (isSharing && !form.access_password.trim()) {
    errors.access_password = "Add the password you manage for this plan.";
  }

  return errors;
}

function getModeConfig(mode) {
  if (mode === "group_buy") {
    return {
      eyebrow: "Buy Together",
      title: "Create a funded group before purchase",
      description:
        "Use this when nobody has purchased the plan, course, or tool yet and members need to fill the group first.",
      summaryTitle: "Group funding summary",
      amountLabel: "Contribution per member",
      targetLabel: "Group target when full",
      scheduleLabel: "Collection window",
      helper:
        "Members join first, funds stay protected, and payout is released only after access is confirmed.",
      accent: "amber",
    };
  }

  return {
    eyebrow: "Share Existing Plan",
    title: "Open paid spots on a plan you already manage",
    description:
      "Use this when you already have the plan, course, membership, or tool and want to coordinate shared costs for the current cycle.",
    summaryTitle: "Sharing summary",
    amountLabel: "Price per member",
    targetLabel: "Potential payout when full",
    scheduleLabel: "Current cycle window",
    helper:
      "Late joiners are charged only for the remaining days, and access is coordinated privately by you.",
    accent: "sky",
  };
}

function InputError({ message }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm text-rose-600">{message}</p>;
}

function DetailRow({ label, value, muted = false }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${muted ? "text-slate-500" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function ModeCard({ active, title, description, onClick, badgeTone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[28px] border p-5 text-left transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-[0_20px_45px_rgba(15,23,42,0.18)]"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
          active
            ? "bg-white/15 text-white"
            : badgeTone === "amber"
              ? "bg-amber-100 text-amber-800"
              : "bg-sky-100 text-sky-800"
        }`}
      >
        {badgeTone === "amber" ? "Buy Together" : "Sharing"}
      </span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className={`mt-2 text-sm leading-7 ${active ? "text-slate-200" : "text-slate-600"}`}>{description}</p>
    </button>
  );
}

export default function CreateGroup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(buildInitialForm);
  const [subscriptions, setSubscriptions] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const isSharing = form.mode === "sharing";
  const modeConfig = getModeConfig(form.mode);

  useEffect(() => {
    let isMounted = true;

    API.get("subscriptions/")
      .then((res) => {
        if (!isMounted) {
          return;
        }
        setSubscriptions(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error("Failed to load subscriptions:", err);
      })
      .finally(() => {
        if (isMounted) {
          setLoadingSuggestions(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const quickPicks = useMemo(() => {
    return subscriptions
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [subscriptions]);

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
    setSubmitError("");
  };

  const handleModeChange = (mode) => {
    setForm((current) => ({
      ...current,
      mode,
    }));
    setSubmitError("");
  };

  const handleQuickPick = (name) => {
    setForm((current) => ({
      ...current,
      subscription_name: name,
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.subscription_name;
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validateForm(form, isSharing);
    setErrors(validationErrors);
    setSubmitError("");

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
      access_identifier: isSharing ? form.access_identifier.trim() : "",
      access_password: isSharing ? form.access_password : "",
      access_notes: isSharing ? form.access_notes.trim() : "",
    };

    try {
      setLoading(true);
      const response = await API.post("create-group/", payload);
      const createdGroupId = response.data?.group_id;
      setForm(buildInitialForm());
      navigate("/my-shared");
      if (createdGroupId) {
        window.alert(
          isSharing
            ? "Sharing group created. You can manage it from My Splits."
            : "Buy-together group created. You can track it from My Splits."
        );
      }
    } catch (err) {
      console.error(err);
      setSubmitError(err.response?.data?.error || "We could not create the group right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="sv-dark-hero px-6 py-8 md:px-8">
          <p className="sv-eyebrow-on-dark">Create Split</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
                Build a clean group setup flow before members ever see it.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-200">
                Choose the right group type, set the cycle window, and define member pricing in one guided screen.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Modes</p>
                <p className="mt-2 text-xl font-semibold">2 flows</p>
                <p className="mt-2 text-sm text-slate-200">Sharing and buy-together are set up differently here.</p>
              </div>
              <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Fair pricing</p>
                <p className="mt-2 text-xl font-semibold">Auto prorated</p>
                <p className="mt-2 text-sm text-slate-200">Late joiners in sharing groups pay only for remaining days.</p>
              </div>
              <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Control</p>
                <p className="mt-2 text-xl font-semibold">Owner managed</p>
                <p className="mt-2 text-sm text-slate-200">You can manage pricing, timing, and coordination from My Splits later.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Setup flow</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">{modeConfig.title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{modeConfig.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(buildInitialForm())}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset form
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ModeCard
                active={form.mode === "sharing"}
                badgeTone="sky"
                title="Split an existing plan"
                description="Open paid spots on a digital plan, course, or tool you already manage for the current billing window."
                onClick={() => handleModeChange("sharing")}
              />
              <ModeCard
                active={form.mode === "group_buy"}
                badgeTone="amber"
                title="Buy together first"
                description="Collect member commitments before the plan, course, or tool is purchased and activated."
                onClick={() => handleModeChange("group_buy")}
              />
            </div>

            {submitError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {submitError}
              </div>
            ) : null}

            <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 md:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Basics</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">What are you opening?</h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                    modeConfig.accent === "amber"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-sky-100 text-sky-800"
                  }`}
                >
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
                    placeholder="Netflix, Coursera, Canva, ChatGPT Plus"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                  <InputError message={errors.subscription_name} />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-slate-700">Quick picks</label>
                    {loadingSuggestions ? (
                      <span className="text-xs text-slate-500">Loading suggestions...</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickPicks.length > 0 ? (
                      quickPicks.map((subscription) => (
                        <button
                          key={subscription.id}
                          type="button"
                          onClick={() => handleQuickPick(subscription.name)}
                          className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                            form.subscription_name === subscription.name
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {subscription.name}
                        </button>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">Add any plan, course, or tool name manually.</span>
                    )}
                  </div>
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
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Enter how many members can join this group.
                    </p>
                    <InputError message={errors.total_slots} />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      {isSharing ? "Price per member" : "Contribution per member"}
                    </label>
                    <div className="mt-2 flex items-center rounded-2xl border border-slate-300 bg-white focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10">
                      <span className="border-r border-slate-200 px-4 py-3 text-sm font-semibold text-slate-500">Rs</span>
                      <input
                        type="number"
                        name="price_per_slot"
                        min="1"
                        step="0.01"
                        value={form.price_per_slot}
                        onChange={handleChange}
                        placeholder={isSharing ? "150" : "200"}
                        className="w-full rounded-r-2xl px-4 py-3 text-sm text-slate-900 outline-none"
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {isSharing
                        ? "Late joiners will be charged only for the remaining days automatically."
                        : "This is the amount each member commits when joining the group."}
                    </p>
                    <InputError message={errors.price_per_slot} />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 md:p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Timeline</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {isSharing ? "Set the current cycle window" : "Set the funding window"}
              </h3>
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
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
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
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                  <InputError message={errors.end_date} />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {durationDays > 0
                  ? `${durationDays} day window selected.`
                  : "Pick valid start and end dates to preview the window."}
              </div>
            </section>

            {isSharing ? (
              <section className="rounded-[28px] border border-sky-200 bg-sky-50/70 p-5 md:p-6">
                <p className="text-xs uppercase tracking-[0.22em] text-sky-700">Owner Access</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Secure access details</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Save the login details you manage for this plan. Joined members do not see these details on-platform; access is coordinated privately by you.
                </p>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Login email or username</label>
                    <input
                      type="text"
                      name="access_identifier"
                      value={form.access_identifier}
                      onChange={handleChange}
                      placeholder="shared@email.com or account username"
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                    <InputError message={errors.access_identifier} />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Password</label>
                    <div className="mt-2 flex items-center rounded-2xl border border-slate-300 bg-white focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="access_password"
                        value={form.access_password}
                        onChange={handleChange}
                        placeholder="Password you manage for this plan"
                        className="w-full rounded-l-2xl px-4 py-3 text-sm text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <InputError message={errors.access_password} />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Owner notes</label>
                    <textarea
                      name="access_notes"
                      value={form.access_notes}
                      onChange={handleChange}
                      placeholder="Optional reminders like profile name, PIN, device rules, or renewal notes"
                      className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Keep this short and practical so it stays easy to manage later.
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] border border-amber-200 bg-amber-50/70 p-5 md:p-6">
                <p className="text-xs uppercase tracking-[0.22em] text-amber-700">Payout Protection</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">What happens after the group fills</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <DetailRow label="1" value="Members join and funds are held" muted />
                  <DetailRow label="2" value="Creator completes the purchase" muted />
                  <DetailRow label="3" value="Members confirm access before payout" muted />
                </div>
              </section>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-sm text-slate-600">
                You can edit empty groups later. Once members join, pricing and core details lock to protect active joins.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/my-shared")}
                  className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {loading
                    ? "Creating..."
                    : isSharing
                      ? "Create sharing group"
                      : "Create buy-together group"}
                </button>
              </div>
            </div>
          </form>

          <aside className="space-y-6">
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Live summary</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{modeConfig.summaryTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{modeConfig.helper}</p>

              <div className="mt-5 space-y-3">
                <DetailRow
                  label="Plan"
                  value={form.subscription_name.trim() || "Name not set yet"}
                  muted={!form.subscription_name.trim()}
                />
                <DetailRow
                  label={modeConfig.amountLabel}
                  value={amountPerMember > 0 ? `Rs ${amountPerMember.toFixed(2)}` : "Add pricing"}
                  muted={amountPerMember <= 0}
                />
                <DetailRow
                  label="Members"
                  value={memberCount > 0 ? `${memberCount}` : "Add member count"}
                  muted={memberCount <= 0}
                />
                <DetailRow
                  label={modeConfig.targetLabel}
                  value={estimatedTotal > 0 ? `Rs ${estimatedTotal.toFixed(2)}` : "Waiting for inputs"}
                  muted={estimatedTotal <= 0}
                />
                <DetailRow
                  label={modeConfig.scheduleLabel}
                  value={
                    form.start_date && form.end_date
                      ? `${form.start_date} to ${form.end_date}`
                      : "Choose dates"
                  }
                  muted={!form.start_date || !form.end_date}
                />
                <DetailRow
                  label="Duration"
                  value={durationDays > 0 ? `${durationDays} days` : "Choose valid dates"}
                  muted={durationDays <= 0}
                />
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Setup notes</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">Keep pricing simple</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Use one clean per-member amount that feels easy to trust. You can explain special cases later in group chat.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">Choose realistic timing</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Pick dates that match the billing cycle or collection window so members immediately understand what they are paying for.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">Access stays owner-managed</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Keep coordination private and use group chat for updates. Member-facing pages focus on status, not raw login display.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
