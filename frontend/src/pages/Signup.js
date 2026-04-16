import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import API from "../api/axios";
import AuthShell from "../components/AuthShell";
import { CheckCircleIcon, LoadingSpinner, ShieldIcon } from "../components/UiIcons";

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
  const passwordStrength = getPasswordStrength(form.password);

  return (
    <AuthShell
      eyebrow="Create account"
      title="Set up your ShareVerse account."
      subtitle="Keep signup simple: add your details, set a password, verify the OTP, and you are ready to start splitting."
      footer={
        <div className="space-y-2.5">
          <p className="text-[13px] text-slate-600 sm:text-sm">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-teal-800 hover:text-teal-700">
              Sign in
            </Link>
          </p>
          <p className="text-[11px] leading-5 text-slate-500 sm:text-xs sm:leading-6">
            By signing up, you agree to the{" "}
            <Link to="/terms" className="font-semibold text-teal-800 hover:text-teal-700">
              Terms
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
          </p>
        </div>
      }
      panelWidthClass="max-w-2xl"
    >
      <div>
        <p className="sv-eyebrow">Signup</p>
        <h2 className="mt-2 text-2xl font-bold leading-tight text-slate-950 sm:mt-3 sm:text-3xl md:text-[2.35rem]">
          Create your ShareVerse account
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:mt-3 sm:text-sm sm:leading-7">
          Use a clean username, verify your email OTP, and we’ll get you into the platform without extra clutter.
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-800 sm:mt-5 sm:px-4 sm:py-3 sm:text-sm">
            {error}
          </div>
        ) : null}

        {verificationNotice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800 sm:mt-5 sm:px-4 sm:py-3 sm:text-sm">
            {verificationNotice}
          </div>
        ) : null}

        <form onSubmit={handleSignup} className="mt-5 space-y-4 sm:mt-6 sm:space-y-5">
          <section className="rounded-[20px] border border-slate-200 bg-slate-50/85 p-4 sm:rounded-[24px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Account details</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">Who you are</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 sm:text-[11px]">
                Required
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <FieldShell label="Username" helper="This will be your login name.">
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="your-username"
                  value={form.username}
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
                  className="sv-input"
                />
              </FieldShell>
            </div>

            <div className="mt-3">
              <FieldShell label="Email" helper="We use this for OTP verification.">
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
            </div>
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:rounded-[24px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Security</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">Set your password</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 sm:text-[11px]">
                Secure access
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FieldShell label="Password" helper="At least 8 characters.">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    placeholder="Create a password"
                    value={form.password}
                    onChange={handleChange}
                    className="sv-input pr-16 sm:pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[13px] font-semibold text-slate-600 hover:bg-slate-200 sm:right-3 sm:px-3 sm:text-sm"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <span>Password strength</span>
                    <span className={passwordStrength.tone}>{passwordStrength.label}</span>
                  </div>
                  <div className="sv-password-meter">
                    <div
                      className={`sv-password-meter-fill ${passwordStrength.fill}`}
                      style={{ width: `${passwordStrength.width}%` }}
                    />
                  </div>
                </div>
              </FieldShell>

              <FieldShell label="Confirm password" helper="Use the same password again.">
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className="sv-input pr-16 sm:pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[13px] font-semibold text-slate-600 hover:bg-slate-200 sm:right-3 sm:px-3 sm:text-sm"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </FieldShell>
            </div>
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-slate-50/85 p-4 sm:rounded-[24px] sm:p-5">
            <div className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-4 text-[13px] leading-6 text-slate-700 sm:text-sm sm:leading-7">
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
            </div>
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:rounded-[24px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Verification</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">Verify your OTP</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 sm:text-[11px]">
                Real-time
              </span>
            </div>

            <p className="mt-3 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
              {hasVerificationSession
                ? `We sent a 6-digit code to your ${deliveryChannel}. Enter it below to finish signup.`
                : "Request your verification code after filling the form above. We’ll send it to your signup email."}
            </p>

            {devOtp ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 sm:text-sm">
                Development OTP: <strong>{devOtp}</strong>
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={otpLoading}
                className="sv-btn-secondary w-full gap-2 sm:w-auto"
              >
                {otpLoading ? <LoadingSpinner /> : <ShieldIcon className="h-4 w-4" />}
                {otpLoading
                  ? "Sending code..."
                  : hasVerificationSession
                    ? "Send new code"
                    : "Send verification code"}
              </button>

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
                className="sv-input flex-1"
              />
            </div>
          </section>

          <button
            type="submit"
            disabled={loading || !acceptedTerms || !hasVerificationSession}
            className="sv-btn-primary w-full gap-2"
          >
            {loading ? <LoadingSpinner /> : <CheckCircleIcon className="h-4 w-4" />}
            {loading
              ? "Creating your account..."
              : hasVerificationSession
                ? "Verify code & create account"
                : "Send verification code to continue"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

function FieldShell({ label, helper, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-800 sm:mb-2 sm:text-sm">{label}</span>
      {children}
      <span className="mt-1.5 block text-[11px] text-slate-500 sm:mt-2 sm:text-xs">{helper}</span>
    </label>
  );
}

function getPasswordStrength(password) {
  const value = password || "";
  if (!value) {
    return {
      label: "Not set",
      width: 0,
      fill: "bg-slate-300",
      tone: "text-slate-400",
    };
  }

  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) {
    return { label: "Weak", width: 28, fill: "bg-rose-500", tone: "text-rose-600" };
  }
  if (score === 2) {
    return { label: "Fair", width: 55, fill: "bg-amber-500", tone: "text-amber-600" };
  }
  if (score === 3) {
    return { label: "Strong", width: 78, fill: "bg-sky-500", tone: "text-sky-600" };
  }
  return { label: "Great", width: 100, fill: "bg-emerald-500", tone: "text-emerald-600" };
}
