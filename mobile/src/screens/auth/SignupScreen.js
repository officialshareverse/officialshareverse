import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import AppTextField from "../../components/AppTextField";
import { CheckCircle2, MailCheck } from "../../components/Icons";
import Screen, { SectionCard } from "../../components/Screen";
import { colors } from "../../theme/tokens";

function extractError(error) {
  const errorData = error?.response?.data;
  if (!errorData || typeof errorData !== "object") {
    return "We could not finish signup right now.";
  }

  if (typeof errorData.error === "string" && errorData.error.trim()) {
    return errorData.error;
  }

  const firstField = Object.values(errorData)[0];
  if (Array.isArray(firstField) && firstField[0]) {
    return firstField[0];
  }
  if (typeof firstField === "string") {
    return firstField;
  }
  return "We could not finish signup right now.";
}

export default function SignupScreen() {
  const { requestSignupOtp, finishSignup } = useAuth();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    referral_code: "",
    otp: "",
  });
  const [signupSessionId, setSignupSessionId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasVerificationSession = Boolean(signupSessionId);

  const canRequestOtp = useMemo(() => {
    return (
      form.username.trim() &&
      /^\S+@\S+\.\S+$/.test(form.email.trim()) &&
      form.password.length >= 8 &&
      form.password === form.confirmPassword
    );
  }, [form]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const handleRequestOtp = async () => {
    if (!canRequestOtp) {
      setError("Add your username, email, and matching password first.");
      return;
    }

    try {
      setOtpLoading(true);
      setError("");
      const response = await requestSignupOtp({
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        referral_code: form.referral_code.trim() || undefined,
      });

      setSignupSessionId(response.signup_session_id || "");
      setNotice(
        response.dev_otp
          ? `Verification code generated. Development OTP: ${response.dev_otp}`
          : `Verification code sent to ${form.email.trim()}.`
      );
    } catch (requestError) {
      setError(extractError(requestError));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleFinishSignup = async () => {
    if (!hasVerificationSession) {
      setError("Request your verification code first.");
      return;
    }

    if (!/^\d{6}$/.test(form.otp.trim())) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    try {
      setFinishing(true);
      setError("");
      await finishSignup({
        username: form.username.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        referral_code: form.referral_code.trim() || undefined,
        signup_session_id: signupSessionId,
        otp: form.otp.trim(),
      });
    } catch (requestError) {
      setError(extractError(requestError));
    } finally {
      setFinishing(false);
    }
  };

  return (
    <Screen
      title="Create account"
      subtitle="Start with email verification, then carry the same ShareVerse account into mobile."
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>Account details</Text>
        <View style={styles.twoUp}>
          <AppTextField
            label="First name"
            value={form.first_name}
            onChangeText={(value) => updateField("first_name", value)}
            placeholder="First name"
            autoCapitalize="words"
          />
          <AppTextField
            label="Last name"
            value={form.last_name}
            onChangeText={(value) => updateField("last_name", value)}
            placeholder="Last name"
            autoCapitalize="words"
          />
        </View>
        <AppTextField
          label="Username"
          value={form.username}
          onChangeText={(value) => updateField("username", value)}
          placeholder="Choose your username"
        />
        <AppTextField
          label="Email"
          value={form.email}
          onChangeText={(value) => updateField("email", value)}
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <AppTextField
          label="Phone"
          value={form.phone}
          onChangeText={(value) => updateField("phone", value)}
          placeholder="Optional 10-digit mobile number"
          keyboardType="phone-pad"
          helper="Phone is saved to your profile. Signup OTP still goes to email."
        />
        <AppTextField
          label="Referral code"
          value={form.referral_code}
          onChangeText={(value) => updateField("referral_code", value.toUpperCase())}
          placeholder="Optional referral code"
        />
        <AppTextField
          label="Password"
          value={form.password}
          onChangeText={(value) => updateField("password", value)}
          placeholder="Create a password"
          secureTextEntry
          showSecureToggle
          isSecureVisible={showPassword}
          onToggleSecure={() => setShowPassword((current) => !current)}
        />
        <AppTextField
          label="Confirm password"
          value={form.confirmPassword}
          onChangeText={(value) => updateField("confirmPassword", value)}
          placeholder="Confirm password"
          secureTextEntry
          showSecureToggle
          isSecureVisible={showConfirmPassword}
          onToggleSecure={() => setShowConfirmPassword((current) => !current)}
        />
      </SectionCard>

      <SectionCard>
        <View style={styles.rowBetween}>
          <View style={styles.rowLeft}>
            <MailCheck color={colors.primary} size={18} strokeWidth={2.1} />
            <Text style={styles.sectionTitle}>Email verification</Text>
          </View>
          {hasVerificationSession ? (
            <CheckCircle2 color={colors.success} size={18} strokeWidth={2.1} />
          ) : null}
        </View>
        <Text style={styles.copy}>
          We send the 6-digit verification code to {form.email.trim() || "your email address"}.
        </Text>
        <AppTextField
          label="OTP"
          value={form.otp}
          onChangeText={(value) => updateField("otp", value.replace(/\D+/g, "").slice(0, 6))}
          placeholder="Enter 6-digit code"
          keyboardType="number-pad"
        />

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.buttonColumn}>
          <AppButton
            title={otpLoading ? "Sending code..." : hasVerificationSession ? "Send new code" : "Send verification code"}
            onPress={handleRequestOtp}
            loading={otpLoading}
            variant={hasVerificationSession ? "secondary" : "primary"}
          />
          <AppButton
            title={finishing ? "Creating account..." : "Verify and create account"}
            onPress={handleFinishSignup}
            loading={finishing}
            disabled={!hasVerificationSession}
          />
        </View>
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  twoUp: {
    gap: 16,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  copy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  notice: {
    color: colors.success,
    fontSize: 13,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
  buttonColumn: {
    gap: 12,
  },
});
