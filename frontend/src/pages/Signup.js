import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import API from "../api/axios";
import BrandMark from "../components/BrandMark";
import PublicFooter from "../components/PublicFooter";

function getSignupError(errorData) {
  if (!errorData || typeof errorData !== "object") {
    return "We could not create your account right now.";
  }

  if (typeof errorData.error === "string" && errorData.error.trim()) {
    const retryAfter = errorData.retry_after_seconds;
    if (typeof retryAfter === "number" && retryAfter > 0) {
      return `${errorData.error} Try again in ${retryAfter}s.`;
    }
    return errorData.error;
  }

  const firstField = Object.values(errorData)[0];
  if (Array.isArray(firstField) && firstField.length > 0) {
    return firstField[0];
  }

  if (typeof firstField === "string" && firstField.trim()) {
    return firstField;
  }

  return "We could not create your account right now.";
}

function validateSignupForm(form, acceptedTerms, requireOtp = false, otpCode = "") {
  if (!form.username.trim() || !form.email.trim() || !form.password) {
    return "Username, email, and password are required.";
  }

  if (form.password.length < 8) {
    return "Use at least 8 characters for your password.";
  }

  if (form.password !== form.confirmPassword) {
    return "Password confirmation does not match.";
  }

  if (!acceptedTerms) {
    return "Please accept the Terms & Conditions before creating your account.";
  }

  if (requireOtp) {
    if (!otpCode.trim()) {
      return "Enter the verification code to finish creating your account.";
    }

    if (!/^\d{6}$/.test(otpCode.trim())) {
      return "Verification code must be a 6-digit OTP.";
    }
  }

  return "";
}

const highlights = [
  {
    title: "Split existing plan costs",
    body: "Open shared-cost spots in a subscription, course, membership, or tool you already manage.",
  },
  {
    title: "Buy together",
    body: "Fill a group first, then complete the purchase together.",
  },
  {
    title: "One shared activity flow",
    body: "Use one account across joins, updates, chats, and group coordination.",
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [signupSessionId, setSignupSessionId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState("email");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetOtpState = (nextNotice = "") => {
    setSignupSessionId("");
    setOtpCode("");
    setDevOtp("");
    setDeliveryChannel("email");
    setVerificationNotice(nextNotice);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setError("");

    if (["username", "email", "phone"].includes(name) && signupSessionId) {
      resetOtpState("We cleared the previous code because your verification details changed.");
    }
  };

  const handleRequestOtp = async () => {
    const validationError = validateSignupForm(form, acceptedTerms);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setOtpLoading(true);
      setError("");
      setVerificationNotice("");

      const response = await API.post("signup/request-otp/", {
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || "",
      });

      const nextDeliveryStatus = response.data?.delivery_status || "generated";
      setSignupSessionId(response.data?.signup_session_id || "");
      setDeliveryChannel(response.data?.delivery_channel || "email");
      setDevOtp(response.data?.dev_otp || "");
      setVerificationNotice(
        response.data?.dev_otp
          ? `Verification code generated. Use ${response.data.dev_otp} to finish signup.`
          : nextDeliveryStatus === "sent"
            ? `Verification code sent to your ${response.data?.delivery_channel || "email"}. Enter it below to finish signup.`
            : `Verification code generated for your ${response.data?.delivery_channel || "email"}. Enter it below to finish signup.`
      );
    } catch (err) {
      console.error(err);
      setError(getSignupError(err.response?.data));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    const validationError = validateSignupForm(form, acceptedTerms, true, otpCode);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!signupSessionId) {
      setError("Send a verification code before creating your account.");
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
        signup_session_id: signupSessionId,
        otp: otpCode.trim(),
      };

      await API.post("signup/", payload);
      navigate("/login", {
        replace: true,
        state: {
          message: "Account created and verified successfully. Sign in to start splitting costs or buying together.",
        },
      });
    } catch (err) {
      console.error(err);
      setError(getSignupError(err.response?.data));
    } finally {
      setLoading(false);
    }
  };

  const hasVerificationSession = Boolean(signupSessionId);

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col items-stretch gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Link
            to="/"
            className="inline-flex w-full items-center justify-center gap-3 rounded-[22px] border border-slate-300 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm sm:w-auto sm:justify-start sm:rounded-full"
          >
            <BrandMark />
            <span className="text-lg font-bold leading-none sm:text-xl">
              ShareVerse
            </span>
          </Link>

          <p className="text-center text-sm text-slate-600 sm:text-left">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-teal-800 hover:text-teal-700">
              Sign in
            </Link>
          </p>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/80 bg-white/84 shadow-[0_32px_90px_rgba(15,23,42,0.14)] backdrop-blur md:rounded-[34px]">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <section className="order-2 bg-[linear-gradient(145deg,#0f172a_0%,#1f2937_62%,#155e75_100%)] px-4 py-4 text-white md:px-8 md:py-10 lg:order-1">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Create your account
              </p>
              <h1 className="mt-3 text-[2rem] font-bold leading-tight sm:mt-4 sm:text-4xl md:mt-5 md:text-[2.9rem]">
                Start splitting the cost of digital plans or building buy-together groups.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-200 md:mt-5 md:text-base md:leading-8">
                Create one account for coordinating subscriptions, courses, memberships, software tools, and buy-together groups when members are ready.
              </p>

              <div className="mt-6 grid gap-3 md:mt-8 md:gap-4">
                {highlights.map((item) => (
                  <article key={item.title} className="rounded-[20px] border border-white/10 bg-white/10 p-4 backdrop-blur md:rounded-[22px] md:p-5">
                    <h2 className="text-base font-semibold sm:text-lg">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-200 md:leading-7">{item.body}</p>
                  </article>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 md:mt-8 md:text-xs md:tracking-[0.22em]">
                <span>Shared-cost groups</span>
                <span>Member coordination</span>
                <span>Group activity tracking</span>
              </div>
            </section>

            <section className="order-1 px-4 py-4 md:px-8 md:py-10 lg:order-2">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Signup
                </p>
                <h2 className="mt-3 text-[1.8rem] font-bold leading-tight text-slate-950 sm:text-[2rem] md:text-[2.4rem]">
                  Create your ShareVerse account
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 md:leading-7">
                  Your profile helps other members trust you when you organize a shared-cost group or coordinate a buy-together purchase.
                </p>

                {error ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {error}
                  </div>
                ) : null}

                {verificationNotice ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {verificationNotice}
                  </div>
                ) : null}

                <form onSubmit={handleSignup} className="mt-6 space-y-5 md:mt-7 md:space-y-6">
                  <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:rounded-[26px] md:p-5">
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

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

                  <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_16px_28px_rgba(15,23,42,0.05)] md:rounded-[26px] md:p-5">
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
                      This account will work across joined groups, hosted groups, group chat, and buy-together purchases.
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:rounded-[26px] md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Step 3
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">
                          Accept the platform terms
                        </h3>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Required
                      </span>
                    </div>

                    <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => {
                          setAcceptedTerms(e.target.checked);
                          setError("");
                        }}
                        className="mt-1 h-5 w-5 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
                      />
                      <span>
                        I agree to the{" "}
                        <Link to="/terms" className="font-semibold text-teal-800 hover:text-teal-700">
                          Terms &amp; Conditions
                        </Link>
                        ,{" "}
                        <Link to="/privacy" className="font-semibold text-teal-800 hover:text-teal-700">
                          Privacy Policy
                        </Link>
                        ,{" "}
                        <Link to="/refunds" className="font-semibold text-teal-800 hover:text-teal-700">
                          Refund Policy
                        </Link>
                        , and{" "}
                        <Link to="/shipping" className="font-semibold text-teal-800 hover:text-teal-700">
                          Shipping Policy
                        </Link>
                        .
                      </span>
                    </label>
                  </section>

                  <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_16px_28px_rgba(15,23,42,0.05)] md:rounded-[26px] md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Step 4
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">
                          Verify with OTP
                        </h3>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Real-time check
                      </span>
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-200">
                      {hasVerificationSession
                        ? `Enter the 6-digit code generated for your ${deliveryChannel}. If you change your username, email, or phone, request a fresh code.`
                        : "Send a verification code after you finish the form above. We will generate it for your signup email and use it to verify the account before creation."}
                    </div>

                    {devOtp ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Development OTP: <strong>{devOtp}</strong>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={otpLoading}
                        className="rounded-[22px] border border-slate-300 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 transition hover:border-teal-700 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {otpLoading
                          ? "Generating code..."
                          : hasVerificationSession
                            ? "Send new code"
                            : "Send verification code"}
                      </button>

                      <div className="flex-1">
                        <input
                          type="text"
                          name="otp"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={otpCode}
                          onChange={(e) => {
                            setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setError("");
                          }}
                          className="sv-input"
                        />
                      </div>
                    </div>
                  </section>

                  <button
                    type="submit"
                    disabled={loading || !acceptedTerms || !hasVerificationSession}
                    className="w-full rounded-[24px] bg-slate-950 px-4 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {loading
                      ? "Verifying and creating your account..."
                      : hasVerificationSession
                        ? "Verify code & create account"
                        : "Send verification code to continue"}
                  </button>

                  <p className="text-center text-xs leading-6 text-slate-500">
                    Review the platform terms above, request your OTP, then verify the code to activate your ShareVerse account.
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
