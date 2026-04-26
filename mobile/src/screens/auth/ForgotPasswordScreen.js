import { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import AppTextField from "../../components/AppTextField";
import Screen, { SectionCard } from "../../components/Screen";
import { colors } from "../../theme/tokens";

function extractError(error) {
  const errorData = error?.response?.data;
  if (!errorData || typeof errorData !== "object") {
    return "We could not complete password reset right now.";
  }
  if (typeof errorData.error === "string") {
    return errorData.error;
  }
  const firstField = Object.values(errorData)[0];
  if (Array.isArray(firstField) && firstField[0]) {
    return firstField[0];
  }
  if (typeof firstField === "string") {
    return firstField;
  }
  return "We could not complete password reset right now.";
}

export default function ForgotPasswordScreen({ navigation }) {
  const { requestPasswordResetOtp, confirmPasswordReset } = useAuth();
  const [step, setStep] = useState("request");
  const [resetSessionId, setResetSessionId] = useState("");
  const [form, setForm] = useState({
    username: "",
    otp: "",
    new_password: "",
    confirm_password: "",
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const handleRequestOtp = async () => {
    if (!form.username.trim()) {
      setError("Enter your username or email.");
      return;
    }

    try {
      setLoading(true);
      const response = await requestPasswordResetOtp({ username: form.username.trim() });
      setResetSessionId(response.reset_session_id || "");
      setNotice(
        response.dev_otp
          ? `Reset code generated. Development OTP: ${response.dev_otp}`
          : "Password reset code sent to your email."
      );
      setStep("confirm");
    } catch (requestError) {
      setError(extractError(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!resetSessionId) {
      setError("Request a new reset code first.");
      return;
    }
    if (!/^\d{6}$/.test(form.otp.trim())) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    if (form.new_password.length < 8) {
      setError("Use at least 8 characters for the new password.");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError("Password confirmation does not match.");
      return;
    }

    try {
      setLoading(true);
      await confirmPasswordReset({
        username: form.username.trim(),
        reset_session_id: resetSessionId,
        otp: form.otp.trim(),
        new_password: form.new_password,
      });
      Alert.alert("Password updated", "You can sign in with your new password now.");
      navigation.goBack();
    } catch (requestError) {
      setError(extractError(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      title="Reset password"
      subtitle="Use the email already linked to your ShareVerse account."
    >
      <SectionCard>
        <AppTextField
          label="Username or email"
          value={form.username}
          onChangeText={(value) => updateField("username", value)}
          placeholder="your-username or you@example.com"
        />

        {step === "confirm" ? (
          <>
            <AppTextField
              label="OTP"
              value={form.otp}
              onChangeText={(value) => updateField("otp", value.replace(/\D+/g, "").slice(0, 6))}
              placeholder="6-digit code"
              keyboardType="number-pad"
            />
            <AppTextField
              label="New password"
              value={form.new_password}
              onChangeText={(value) => updateField("new_password", value)}
              placeholder="New password"
              secureTextEntry
            />
            <AppTextField
              label="Confirm new password"
              value={form.confirm_password}
              onChangeText={(value) => updateField("confirm_password", value)}
              placeholder="Confirm new password"
              secureTextEntry
            />
          </>
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          title={
            loading
              ? step === "request"
                ? "Sending code..."
                : "Updating password..."
              : step === "request"
                ? "Send reset code"
                : "Reset password"
          }
          onPress={step === "request" ? handleRequestOtp : handleConfirm}
          loading={loading}
        />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
