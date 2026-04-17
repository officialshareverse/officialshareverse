import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import API from "../api/axios";
import AuthShell from "../components/AuthShell";
import { useToast } from "../components/ToastProvider";
import {
  CheckCircleIcon,
  ClockIcon,
  LoadingSpinner,
  ShieldIcon,
  SparkIcon,
  UserIcon,
} from "../components/UiIcons";

const SIGNUP_STEPS = [
  { id: "identity", eyebrow: "Step 1", label: "Identity", title: "Tell us who you are", helper: "Add your name if you want, then choose the username you will use to sign in." },
  { id: "contact", eyebrow: "Step 2", label: "Contact", title: "Add your verification details", helper: "We will send your signup code to the email address you enter here." },
  { id: "security", eyebrow: "Step 3", label: "Security", title: "Create a secure password", helper: "Set a password, confirm it, and accept the policies before you continue." },
  { id: "verification", eyebrow: "Step 4", label: "Verification", title: "Enter the 6-digit OTP", helper: "Request your code, enter the six digits, and we will finish signup automatically." },
];

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const USERNAME_CHECK_DELAY_MS = 380;

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

function validateIdentityStep(form, usernameStatus) {
  if (!form.username.trim()) {
    return "Choose a username to continue.";
  }
  if (usernameStatus.state === "checking") {
    return "We are still checking that username. Give it a second.";
  }
  if (usernameStatus.state === "taken") {
    return "Choose a different username before continuing.";
  }
  return "";
}

function validateContactStep(form) {
  if (!form.email.trim()) {
    return "Email is required.";
  }
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    return "Enter a valid email address.";
  }
  return "";
}

function validateSecurityStep(form, acceptedTerms) {
  if (!form.password) {
    return "Create a password to continue.";
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
  return "";
}

function validateVerificationStep(signupSessionId, otpCode) {
  if (!signupSessionId) {
    return "Send a verification code before creating your account.";
  }
  if (!/^\d{6}$/.test(otpCode.trim())) {
    return "Enter the 6-digit verification code to finish creating your account.";
  }
  return "";
}

function getPasswordStrength(password) {
  const value = password || "";
  if (!value) {
    return { label: "Not set", width: 0, fill: "bg-slate-300", tone: "text-slate-400" };
  }

  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) return { label: "Weak", width: 28, fill: "bg-rose-500", tone: "text-rose-600" };
  if (score === 2) return { label: "Fair", width: 55, fill: "bg-amber-500", tone: "text-amber-600" };
  if (score === 3) return { label: "Strong", width: 78, fill: "bg-sky-500", tone: "text-sky-600" };
  return { label: "Great", width: 100, fill: "bg-emerald-500", tone: "text-emerald-600" };
}

function getPasswordChecklist(password) {
  const value = password || "";
  return [
    { label: "8+ characters", ready: value.length >= 8 },
    { label: "Upper + lowercase letters", ready: /[A-Z]/.test(value) && /[a-z]/.test(value) },
    { label: "At least one number", ready: /\d/.test(value) },
    { label: "One symbol", ready: /[^A-Za-z0-9]/.test(value) },
  ];
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getUsernameStatusCopy(status) {
  if (status.state === "checking") {
    return { className: "is-checking", title: "Checking username", body: "Making sure nobody else has already claimed it." };
  }
  if (status.state === "available") {
    return { className: "is-available", title: "Username available", body: status.message };
  }
  if (status.state === "taken") {
    return { className: "is-taken", title: "Pick another username", body: status.message };
  }
  if (status.state === "error") {
    return { className: "is-neutral", title: "Could not confirm just yet", body: status.message };
  }
  return { className: "is-neutral", title: "Pick your login name", body: "Choose something simple and memorable. We will check if it is available as you type." };
}

function getNextButtonLabel(stepIndex) {
  return stepIndex === SIGNUP_STEPS.length - 1 ? "Verify code & create account" : "Next step";
}

export default function Signup() {
  const navigate = useNavigate();
  const toast = useToast();
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
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [devOtp, setDevOtp] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState("email");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [usernameStatus, setUsernameStatus] = useState({ state: "idle", message: "" });
  const [otpExpiryAt, setOtpExpiryAt] = useState(0);
  const [otpCooldownUntil, setOtpCooldownUntil] = useState(0);
  const [clockTick, setClockTick] = useState(Date.now());
  const usernameRequestSequenceRef = useRef(0);
  const otpInputsRef = useRef([]);
  const submitSignupRef = useRef(async () => false);
  const lastAutoSubmittedOtpRef = useRef("");

  const currentStepConfig = SIGNUP_STEPS[currentStep];
  const hasVerificationSession = Boolean(signupSessionId);
  const passwordStrength = getPasswordStrength(form.password);
  const passwordChecklist = useMemo(() => getPasswordChecklist(form.password), [form.password]);
  const otpCode = otpDigits.join("");
  const progressPercent = ((currentStep + 1) / SIGNUP_STEPS.length) * 100;
  const remainingExpirySeconds = otpExpiryAt ? Math.max(0, Math.ceil((otpExpiryAt - clockTick) / 1000)) : 0;
  const remainingCooldownSeconds = otpCooldownUntil ? Math.max(0, Math.ceil((otpCooldownUntil - clockTick) / 1000)) : 0;
  const usernameStatusCopy = getUsernameStatusCopy(usernameStatus);

  const resetOtpState = (nextNotice = "") => {
    setSignupSessionId("");
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    setDevOtp("");
    setDeliveryChannel("email");
    setVerificationNotice(nextNotice);
    setOtpExpiryAt(0);
    setOtpCooldownUntil(0);
    lastAutoSubmittedOtpRef.current = "";
  };

  useEffect(() => {
    const trimmedUsername = form.username.trim();
    if (!trimmedUsername) {
      setUsernameStatus({ state: "idle", message: "" });
      return undefined;
    }
    if (trimmedUsername.length < 3) {
      setUsernameStatus({ state: "error", message: "Use at least 3 characters so your username is easy to recognize." });
      return undefined;
    }

    const requestId = usernameRequestSequenceRef.current + 1;
    usernameRequestSequenceRef.current = requestId;
    setUsernameStatus({ state: "checking", message: "" });

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await API.post("signup/check-availability/", { username: trimmedUsername });
        if (usernameRequestSequenceRef.current !== requestId) {
          return;
        }
        setUsernameStatus({
          state: response.data?.available ? "available" : "taken",
          message: response.data?.message || "",
        });
      } catch (err) {
        if (usernameRequestSequenceRef.current !== requestId) {
          return;
        }
        setUsernameStatus({ state: "error", message: getSignupError(err.response?.data) });
      }
    }, USERNAME_CHECK_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [form.username]);

  useEffect(() => {
    if (!otpExpiryAt && !otpCooldownUntil) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      setClockTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [otpCooldownUntil, otpExpiryAt]);

  useEffect(() => {
    if (currentStep !== SIGNUP_STEPS.length - 1) {
      return;
    }
    window.requestAnimationFrame(() => {
      otpInputsRef.current[0]?.focus();
    });
  }, [currentStep]);

  useEffect(() => {
    if (!otpDigits.every(Boolean)) {
      lastAutoSubmittedOtpRef.current = "";
      return;
    }
    if (
      currentStep !== SIGNUP_STEPS.length - 1 ||
      !hasVerificationSession ||
      loading ||
      otpLoading ||
      lastAutoSubmittedOtpRef.current === otpCode
    ) {
      return;
    }
    lastAutoSubmittedOtpRef.current = otpCode;
    void submitSignupRef.current({ auto: true });
  }, [currentStep, hasVerificationSession, loading, otpCode, otpDigits, otpLoading]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");

    if (["username", "email", "phone"].includes(name) && signupSessionId) {
      resetOtpState("We cleared the previous code because your verification details changed.");
    }
  };

  const handleRequestOtp = async () => {
    const identityError = validateIdentityStep(form, usernameStatus);
    if (identityError) {
      setCurrentStep(0);
      setError(identityError);
      return;
    }
    const contactError = validateContactStep(form);
    if (contactError) {
      setCurrentStep(1);
      setError(contactError);
      return;
    }
    const securityError = validateSecurityStep(form, acceptedTerms);
    if (securityError) {
      setCurrentStep(2);
      setError(securityError);
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
      const expiresInSeconds = Number(response.data?.expires_in_seconds || 600);
      setSignupSessionId(response.data?.signup_session_id || "");
      setDeliveryChannel(response.data?.delivery_channel || "email");
      setDevOtp(response.data?.dev_otp || "");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setOtpExpiryAt(Date.now() + expiresInSeconds * 1000);
      setOtpCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      setVerificationNotice(
        response.data?.dev_otp
          ? `Verification code generated. Use ${response.data.dev_otp} to finish signup.`
          : nextDeliveryStatus === "sent"
            ? `Verification code sent to your ${response.data?.delivery_channel || "email"}. Enter it below to finish signup.`
            : `Verification code generated for your ${response.data?.delivery_channel || "email"}. Enter it below to finish signup.`
      );
      lastAutoSubmittedOtpRef.current = "";
      toast.info("Your signup code is ready. Enter all 6 digits to finish.", { title: "Verification code sent" });
    } catch (err) {
      console.error(err);
      const retryAfter = Number(err.response?.data?.retry_after_seconds || 0);
      if (retryAfter > 0) {
        setOtpCooldownUntil(Date.now() + retryAfter * 1000);
      }
      setError(getSignupError(err.response?.data));
    } finally {
      setOtpLoading(false);
    }
  };

  async function submitSignup(options = {}) {
    const validationError = validateVerificationStep(signupSessionId, otpCode);
    if (validationError) {
      if (!options.auto) {
        setError(validationError);
      }
      return false;
    }

    try {
      setLoading(true);
      setError("");

      await API.post("signup/", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        password: form.password,
        signup_session_id: signupSessionId,
        otp: otpCode.trim(),
      });

      toast.success("Account created and verified successfully.", { title: "Welcome to ShareVerse" });
      navigate("/login", {
        replace: true,
        state: {
          message: "Account created and verified successfully. Sign in to start splitting costs or buying together.",
        },
      });
      return true;
    } catch (err) {
      console.error(err);
      setError(getSignupError(err.response?.data));
      return false;
    } finally {
      setLoading(false);
    }
  }

  submitSignupRef.current = submitSignup;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (currentStep === 0) {
      const validationError = validateIdentityStep(form, usernameStatus);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError("");
      setCurrentStep(1);
      return;
    }

    if (currentStep === 1) {
      const validationError = validateContactStep(form);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError("");
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      const validationError = validateSecurityStep(form, acceptedTerms);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError("");
      setCurrentStep(3);
      return;
    }

    await submitSignup();
  };

  const handleStepBack = () => {
    setError("");
    if (currentStep === 0) {
      navigate("/login");
      return;
    }
    setCurrentStep((current) => Math.max(0, current - 1));
  };

  const handleOtpDigitChange = (index, rawValue) => {
    const nextDigit = rawValue.replace(/\D/g, "").slice(-1);
    setOtpDigits((current) => {
      const next = [...current];
      next[index] = nextDigit;
      return next;
    });
    setError("");

    if (nextDigit && index < OTP_LENGTH - 1) {
      window.requestAnimationFrame(() => {
        otpInputsRef.current[index + 1]?.focus();
      });
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpInputsRef.current[index - 1]?.focus();
      return;
    }
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    const pastedDigits = (event.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pastedDigits) {
      return;
    }
    event.preventDefault();
    setOtpDigits(Array.from({ length: OTP_LENGTH }, (_, index) => pastedDigits[index] || ""));
    setError("");
    const focusIndex = Math.min(pastedDigits.length, OTP_LENGTH - 1);
    window.requestAnimationFrame(() => {
      otpInputsRef.current[focusIndex]?.focus();
    });
  };

  return (
    <AuthShell
      eyebrow="Create account"
      title="Set up your ShareVerse account."
      subtitle="Move through four quick steps: choose your login details, add verification info, secure the account, and confirm the OTP."
      footer={<SignupFooter />}
      panelWidthClass="max-w-3xl"
      compact
    >
      <div className="sv-signup-shell">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="sv-eyebrow">Signup wizard</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-slate-950 sm:mt-3 sm:text-3xl md:text-[2.45rem]">
              Create your ShareVerse account
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-600 sm:mt-3 sm:text-sm sm:leading-7">
              {currentStepConfig.helper}
            </p>
          </div>
          <div className="sv-signup-step-pill">
            <span>{currentStepConfig.eyebrow}</span>
            <strong>{currentStep + 1} / {SIGNUP_STEPS.length}</strong>
          </div>
        </div>

        <div className="sv-signup-progress mt-5">
          <span className="sv-signup-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="sv-signup-step-row mt-4">
          {SIGNUP_STEPS.map((step, index) => {
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (index <= currentStep) {
                    setCurrentStep(index);
                    setError("");
                  }
                }}
                disabled={index > currentStep}
                className={`sv-signup-step-card ${isActive ? "is-active" : ""} ${isComplete ? "is-complete" : ""}`}
              >
                <span className="sv-signup-step-index">
                  {isComplete ? <CheckCircleIcon className="h-4 w-4" /> : `0${index + 1}`}
                </span>
                <span className="sv-signup-step-copy">
                  <strong>{step.label}</strong>
                  <small>{step.eyebrow}</small>
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="sv-signup-alert is-error mt-5">
            <strong>Something needs attention</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {verificationNotice ? (
          <div className="sv-signup-alert is-success mt-5">
            <strong>Verification ready</strong>
            <span>{verificationNotice}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {currentStep === 0 ? <IdentityStep form={form} handleChange={handleChange} usernameStatus={usernameStatus} usernameStatusCopy={usernameStatusCopy} /> : null}
          {currentStep === 1 ? <ContactStep form={form} handleChange={handleChange} /> : null}
          {currentStep === 2 ? <SecurityStep form={form} handleChange={handleChange} acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms} passwordStrength={passwordStrength} passwordChecklist={passwordChecklist} showPassword={showPassword} setShowPassword={setShowPassword} showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword} setError={setError} /> : null}
          {currentStep === 3 ? <VerificationStep form={form} deliveryChannel={deliveryChannel} hasVerificationSession={hasVerificationSession} handleRequestOtp={handleRequestOtp} otpLoading={otpLoading} remainingCooldownSeconds={remainingCooldownSeconds} remainingExpirySeconds={remainingExpirySeconds} devOtp={devOtp} otpDigits={otpDigits} otpInputsRef={otpInputsRef} handleOtpDigitChange={handleOtpDigitChange} handleOtpKeyDown={handleOtpKeyDown} handleOtpPaste={handleOtpPaste} /> : null}

          <div className="sv-signup-nav">
            <button type="button" onClick={handleStepBack} className="sv-btn-secondary">
              {currentStep === 0 ? "Back to login" : "Back"}
            </button>
            <div className="sv-signup-nav-copy">
              <p>Step {currentStep + 1} of {SIGNUP_STEPS.length}</p>
              <span>{currentStepConfig.label}</span>
            </div>
            <button
              type="submit"
              disabled={loading || (currentStep === SIGNUP_STEPS.length - 1 && (!hasVerificationSession || otpDigits.some((digit) => !digit)))}
              className="sv-btn-primary gap-2"
            >
              {loading ? <LoadingSpinner /> : currentStep === SIGNUP_STEPS.length - 1 ? <CheckCircleIcon className="h-4 w-4" /> : <SparkIcon className="h-4 w-4" />}
              {loading ? "Creating your account..." : getNextButtonLabel(currentStep)}
            </button>
          </div>
        </form>

        <section className="sv-signup-benefits mt-6">
          <div className="sv-signup-benefit-card">
            <p className="text-sm font-semibold text-slate-950">What you get after signup</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <BenefitItem title="Join live splits" body="Browse active groups and join with wallet-backed payments." />
              <BenefitItem title="Create your own" body="Open a sharing or buy-together split in just a few guided steps." />
              <BenefitItem title="Track safely" body="Keep confirmations, chats, and wallet activity in one place." />
            </div>
          </div>
        </section>
      </div>
    </AuthShell>
  );
}

function SignupFooter() {
  return (
    <div className="space-y-2.5">
      <p className="text-[13px] text-slate-600 sm:text-sm">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-teal-800 hover:text-teal-700">
          Sign in
        </Link>
      </p>
      <p className="text-[11px] leading-5 text-slate-500 sm:text-xs sm:leading-6">
        By signing up, you agree to the{" "}
        <Link to="/terms" className="font-semibold text-teal-800 hover:text-teal-700">Terms</Link>,{" "}
        <Link to="/privacy" className="font-semibold text-teal-800 hover:text-teal-700">Privacy Policy</Link>,{" "}
        <Link to="/refunds" className="font-semibold text-teal-800 hover:text-teal-700">Refund Policy</Link>, and{" "}
        <Link to="/shipping" className="font-semibold text-teal-800 hover:text-teal-700">Shipping Policy</Link>.
      </p>
    </div>
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

function InfoRow({ title, body }) {
  return (
    <div className="sv-signup-info-row">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1.5 text-sm leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div className="sv-signup-summary-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BenefitItem({ title, body }) {
  return (
    <div className="sv-signup-benefit-item">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function IdentityStep({ form, handleChange, usernameStatus, usernameStatusCopy }) {
  return (
    <section className="sv-signup-stage sv-animate-rise">
      <div className="sv-signup-stage-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="sv-eyebrow">{SIGNUP_STEPS[0].eyebrow}</p>
            <h3 className="sv-title mt-2">{SIGNUP_STEPS[0].title}</h3>
          </div>
          <div className="sv-signup-mini-badge">
            <UserIcon className="h-4 w-4" />
            Identity first
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
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

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <FieldShell label="Username" helper="This becomes your ShareVerse login name.">
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

          <div className={`sv-signup-availability ${usernameStatusCopy.className}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{usernameStatusCopy.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{usernameStatusCopy.body}</p>
              </div>
              {usernameStatus.state === "checking" ? (
                <LoadingSpinner className="h-4.5 w-4.5" />
              ) : usernameStatus.state === "available" ? (
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
              ) : usernameStatus.state === "taken" ? (
                <ShieldIcon className="h-5 w-5 text-rose-600" />
              ) : (
                <SparkIcon className="h-5 w-5 text-slate-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactStep({ form, handleChange }) {
  return (
    <section className="sv-signup-stage sv-animate-rise">
      <div className="sv-signup-stage-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="sv-eyebrow">{SIGNUP_STEPS[1].eyebrow}</p>
            <h3 className="sv-title mt-2">{SIGNUP_STEPS[1].title}</h3>
          </div>
          <div className="sv-signup-mini-badge">
            <ShieldIcon className="h-4 w-4" />
            OTP via email
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <FieldShell label="Email" helper="We use this to deliver your signup OTP.">
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

            <FieldShell label="Phone" helper="Optional, but helpful for account recovery later.">
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

          <div className="sv-signup-side-note">
            <p className="text-sm font-semibold text-slate-950">What happens next</p>
            <div className="mt-4 space-y-3">
              <InfoRow title="Verification email" body="We generate a one-time code and send it to the email you enter here." />
              <InfoRow title="Safe retries" body="If you change email, phone, or username, we clear the old code so the verification session stays accurate." />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecurityStep({
  form,
  handleChange,
  acceptedTerms,
  setAcceptedTerms,
  passwordStrength,
  passwordChecklist,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  setError,
}) {
  return (
    <section className="sv-signup-stage sv-animate-rise">
      <div className="sv-signup-stage-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="sv-eyebrow">{SIGNUP_STEPS[2].eyebrow}</p>
            <h3 className="sv-title mt-2">{SIGNUP_STEPS[2].title}</h3>
          </div>
          <div className="sv-signup-mini-badge">
            <ClockIcon className="h-4 w-4" />
            Secure setup
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <FieldShell label="Password" helper="Use at least 8 characters.">
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

            <label className="sv-signup-terms-card">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => {
                  setAcceptedTerms(event.target.checked);
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
          </div>

          <div className="sv-signup-side-note">
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>Password strength</span>
              <span className={passwordStrength.tone}>{passwordStrength.label}</span>
            </div>
            <div className="sv-password-meter mt-3">
              <div
                className={`sv-password-meter-fill ${passwordStrength.fill}`}
                style={{ width: `${passwordStrength.width}%` }}
              />
            </div>

            <div className="sv-signup-password-list mt-4">
              {passwordChecklist.map((item) => (
                <div key={item.label} className={`sv-signup-password-item ${item.ready ? "is-ready" : ""}`}>
                  <span className="sv-signup-password-icon">
                    {item.ready ? <CheckCircleIcon className="h-4 w-4" /> : <SparkIcon className="h-4 w-4" />}
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VerificationStep({
  form,
  deliveryChannel,
  hasVerificationSession,
  handleRequestOtp,
  otpLoading,
  remainingCooldownSeconds,
  remainingExpirySeconds,
  devOtp,
  otpDigits,
  otpInputsRef,
  handleOtpDigitChange,
  handleOtpKeyDown,
  handleOtpPaste,
}) {
  return (
    <section className="sv-signup-stage sv-animate-rise">
      <div className="sv-signup-stage-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="sv-eyebrow">{SIGNUP_STEPS[3].eyebrow}</p>
            <h3 className="sv-title mt-2">{SIGNUP_STEPS[3].title}</h3>
          </div>
          <div className="sv-signup-mini-badge">
            <ShieldIcon className="h-4 w-4" />
            Auto-submit ready
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <div className="sv-signup-verification-summary">
              <SummaryPill label="Username" value={form.username.trim() || "Not set"} />
              <SummaryPill label="Email" value={form.email.trim() || "Not set"} />
              <SummaryPill label="Channel" value={deliveryChannel} />
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={otpLoading || remainingCooldownSeconds > 0}
                className="sv-btn-secondary w-full justify-center gap-2 sm:w-auto"
              >
                {otpLoading ? <LoadingSpinner /> : <ShieldIcon className="h-4 w-4" />}
                {otpLoading
                  ? "Sending code..."
                  : hasVerificationSession
                    ? remainingCooldownSeconds > 0
                      ? `Resend in ${formatDuration(remainingCooldownSeconds)}`
                      : "Send new code"
                    : "Send verification code"}
              </button>

              <div className="sv-signup-timer-card">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Code expiry</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {hasVerificationSession && remainingExpirySeconds > 0
                    ? formatDuration(remainingExpirySeconds)
                    : hasVerificationSession
                      ? "Expired"
                      : "Waiting"}
                </p>
              </div>
            </div>

            {devOtp ? (
              <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 sm:text-sm">
                Development OTP: <strong>{devOtp}</strong>
              </div>
            ) : null}

            <div className="mt-5">
              <p className="text-[13px] font-semibold text-slate-800 sm:text-sm">Enter the 6-digit code</p>
              <p className="mt-1 text-[12px] leading-6 text-slate-500 sm:text-sm sm:leading-7">
                As soon as all 6 digits are filled, we will try to verify and create the account automatically.
              </p>
              <div className="sv-signup-otp-grid mt-4" onPaste={handleOtpPaste}>
                {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpInputsRef.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={otpDigits[index]}
                    onChange={(event) => handleOtpDigitChange(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    className="sv-signup-otp-input"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="sv-signup-side-note">
            <InfoRow
              title="When it expires"
              body={
                hasVerificationSession
                  ? remainingExpirySeconds > 0
                    ? `This code stays valid for ${formatDuration(remainingExpirySeconds)}.`
                    : "This code expired. Request a new one to continue."
                  : "Request a code first and we will start the countdown."
              }
            />
            <InfoRow
              title="Resend cooldown"
              body={
                remainingCooldownSeconds > 0
                  ? `You can request another code in ${formatDuration(remainingCooldownSeconds)}.`
                  : "You can request a fresh code if the last one did not arrive."
              }
            />
            <InfoRow
              title="Final check"
              body="The OTP must match the same username, email, and phone details you entered in the earlier steps."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
