import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import { ArrowRight, ShieldCheck } from "../../components/Icons";
import AppTextField from "../../components/AppTextField";
import Screen, { SectionCard } from "../../components/Screen";
import { colors } from "../../theme/tokens";

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Enter your username or email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await signIn({ username: username.trim(), password });
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "We could not sign you in right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      title="ShareVerse"
      subtitle="Manage shared plans, buy-together groups, wallet balance, and referrals from one mobile app."
    >
      <SectionCard style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <ShieldCheck color="#ffffff" size={22} strokeWidth={2.2} />
        </View>
        <Text style={styles.heroTitle}>Sign in to your account</Text>
        <Text style={styles.heroCopy}>
          Your groups, joins, and referral bonuses pick up right where the web app leaves off.
        </Text>
      </SectionCard>

      <SectionCard>
        <AppTextField
          label="Username or email"
          value={username}
          onChangeText={setUsername}
          placeholder="your-username or you@example.com"
          autoCapitalize="none"
        />
        <AppTextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          showSecureToggle
          isSecureVisible={showPassword}
          onToggleSecure={() => setShowPassword((current) => !current)}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          title={loading ? "Signing in..." : "Sign in"}
          onPress={handleLogin}
          loading={loading}
          icon={ArrowRight}
        />

        <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
      </SectionCard>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>New here?</Text>
        <Pressable onPress={() => navigation.navigate("Signup")}>
          <Text style={styles.footerLink}>Create your account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.night,
    borderColor: colors.night,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },
  heroCopy: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  footerLink: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: "700",
  },
});
