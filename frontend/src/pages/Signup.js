import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import API from "../api/axios";
import PublicFooter from "../components/PublicFooter";

function getSignupError(errorData) {
  if (!errorData || typeof errorData !== "object") {
    return "We could not create your account right now.";
  }

  const firstField = Object.values(errorData)[0];
  if (Array.isArray(firstField) && firstField.length > 0) {
    return firstField[0];
  }

  return "We could not create your account right now.";
}

const highlights = [
  {
    title: "Share subscriptions",
    body: "Host existing plans and open paid slots for members.",
  },
  {
    title: "Buy together",
    body: "Fill a group first, then activate the subscription together.",
  },
  {
    title: "Wallet-backed flow",
    body: "Use one wallet across joins, payouts, and group activity.",
  },
];

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
    setError("");
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!form.username.trim() || !form.email.trim() || !form.password) {
      setError("Username, email, and password are required.");
      return;
    }

    if (form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        password: form.password,
      };

      await API.post("signup/", payload);
      navigate("/login", {
        replace: true,
        state: {
          message: "Account created successfully. Sign in to start sharing or buying together.",
        },
      });
    } catch (err) {
      console.error(err);
      setError(getSignupError(err.response?.data));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-full border border-slate-300 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f172a_0%,#14532d_100%)] text-xs font-bold text-white">
              SV
            </span>
            <span className="text-xl font-bold leading-none">
              ShareVerse
            </span>
          </Link>

          <p className="text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-teal-800 hover:text-teal-700">
              Sign in
            </Link>
          </p>
        </div>

        <div className="overflow-hidden rounded-[34px] border border-white/80 bg-white/84 shadow-[0_32px_90px_rgba(15,23,42,0.14)] backdrop-blur">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <section className="bg-[linear-gradient(145deg,#0f172a_0%,#1f2937_62%,#155e75_100%)] px-6 py-8 text-white md:px-8 md:py-10">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Create your account
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-tight md:text-[2.9rem]">
                Start sharing subscriptions or building buy-together groups.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-200">
                Create one account for hosting plans, joining groups, managing wallet payments, and activating group-buy subscriptions when members are ready.
              </p>

              <div className="mt-8 grid gap-4">
                {highlights.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[22px] border border-white/10 bg-white/10 p-5 backdrop-blur"
                  >
                    <h2 className="text-lg font-semibold">{item.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-200">{item.body}</p>
                  </article>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                <span>Wallet-backed joins</span>
                <span>Owner payouts</span>
                <span>Group activation</span>
              </div>
            </section>

            <section className="px-6 py-8 md:px-8 md:py-10">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Signup
                </p>
                <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-950 md:text-[2.4rem]">
                  Create your ShareVerse account
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Your profile helps other members trust you when you host a subscription-sharing plan or organize a buy-together subscription.
                </p>

                {error ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {error}
                  </div>
                ) : null}

                <form onSubmit={handleSignup} className="mt-7 space-y-6">
                  <section className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Step 1
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">
                          Account details
                        </h3>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Identity
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <FieldShell label="First name" helper="Optional">
                        <input
                          type="text"
                          name="first_name"
                          autoComplete="given-name"
                          placeholder="First name"
                          value={form.first_name}
                          onChange={handleChange}
                          className="sv-input"
                        />
                      </FieldShell>

                      <FieldShell label="Last name" helper="Optional">
                        <input
                          type="text"
                          name="last_name"
                          autoComplete="family-name"
                          placeholder="Last name"
                          value={form.last_name}
                          onChange={handleChange}
                          className="sv-input"
                        />
                      </FieldShell>
                    </div>

                    <div className="mt-4">
                      <FieldShell label="Username" helper="This will be your login name.">
                        <input
                          type="text"
                          name="username"
                          autoComplete="username"
                          placeholder="Choose a username"
                          value={form.username}
                          onChange={handleChange}
                          className="sv-input"
                        />
                      </FieldShell>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <FieldShell label="Email" helper="Required">
                        <input
                          type="email"
                          name="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={form.email}
                          onChange={handleChange}
                          className="sv-input"
                        />
                      </FieldShell>

                      <FieldShell label="Phone" helper="Optional">
                        <input
                          type="text"
                          name="phone"
                          autoComplete="tel"
                          placeholder="Phone number"
                          value={form.phone}
                          onChange={handleChange}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-700"
                        />
                      </FieldShell>
                    </div>
                  </section>

                  <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_28px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Step 2
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">
                          Security
                        </h3>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Secure access
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <FieldShell label="Password" helper="At least 8 characters">
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            autoComplete="new-password"
                            placeholder="Create a password"
                            value={form.password}
                            onChange={handleChange}
                          className="sv-input pr-20"
                        />
                          <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </FieldShell>

                      <FieldShell label="Confirm password" helper="Re-enter the same password">
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            autoComplete="new-password"
                            placeholder="Confirm your password"
                            value={form.confirmPassword}
                            onChange={handleChange}
                          className="sv-input pr-20"
                        />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((current) => !current)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                          >
                            {showConfirmPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </FieldShell>
                    </div>

                    <div className="mt-5 rounded-2xl bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-200">
                      This account will work across wallet payments, hosted sharing groups, and buy-together subscription purchases.
                    </div>
                  </section>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-[24px] bg-slate-950 px-4 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {loading ? "Creating your account..." : "Create account"}
                  </button>

                  <p className="text-center text-xs leading-6 text-slate-500">
                    By creating an account, you agree to the{" "}
                    <Link to="/terms" className="font-semibold text-teal-800 hover:text-teal-700">
                      Terms
                    </Link>
                    ,{" "}
                    <Link to="/privacy" className="font-semibold text-teal-800 hover:text-teal-700">
                      Privacy Policy
                    </Link>
                    , and{" "}
                    <Link to="/refunds" className="font-semibold text-teal-800 hover:text-teal-700">
                      Refund Policy
                    </Link>
                    ,{" "}
                    <Link to="/shipping" className="font-semibold text-teal-800 hover:text-teal-700">
                      Shipping Policy
                    </Link>
                    .
                  </p>
                </form>
              </div>
            </section>
          </div>
        </div>

        <PublicFooter />
      </div>
    </div>
  );
}

function FieldShell({ label, helper, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
      <span className="mt-2 block text-xs text-slate-500">{helper}</span>
    </label>
  );
}
