import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { GoogleMark } from "./Icons";
import { colors, radius, spacing } from "../theme/tokens";

WebBrowser.maybeCompleteAuthSession();

const appExtra = Constants.expoConfig?.extra || {};
const GOOGLE_WEB_CLIENT_ID = (
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  appExtra.googleWebClientId ||
  ""
).trim();
const GOOGLE_ANDROID_CLIENT_ID = (
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  appExtra.googleAndroidClientId ||
  ""
).trim();
const GOOGLE_IOS_CLIENT_ID = (
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  appExtra.googleIosClientId ||
  ""
).trim();

export default function GoogleAuthButton({
  onCredential,
  onError,
  disabled = false,
  mode = "signin",
}) {
  const [authenticating, setAuthenticating] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_IOS_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID || undefined,
    scopes: ["openid", "profile", "email"],
    selectAccount: true,
  });

  const isConfigured = useMemo(
    () => Boolean(GOOGLE_WEB_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_IOS_CLIENT_ID),
    []
  );

  useEffect(() => {
    let active = true;

    const completeGoogleAuth = async () => {
      if (!response) {
        return;
      }

      if (response.type !== "success") {
        if (active) {
          setAuthenticating(false);
          if (response.type === "error") {
            onError?.("Google sign-in could not be completed right now.");
          }
        }
        return;
      }

      const credential = response.params?.id_token || response.authentication?.idToken || "";
      if (!credential) {
        if (active) {
          setAuthenticating(false);
          onError?.("Google sign-in did not return a usable identity token.");
        }
        return;
      }

      try {
        await onCredential?.(credential);
      } catch (error) {
        if (active) {
          onError?.(error?.message || "Google sign-in failed.");
        }
      } finally {
        if (active) {
          setAuthenticating(false);
        }
      }
    };

    void completeGoogleAuth();

    return () => {
      active = false;
    };
  }, [onCredential, onError, response]);

  const handlePress = async () => {
    if (!request || disabled || !isConfigured || authenticating) {
      return;
    }

    try {
      setAuthenticating(true);
      const result = await promptAsync();
      if (result.type !== "success") {
        setAuthenticating(false);
      }
    } catch {
      setAuthenticating(false);
      onError?.("Google sign-in could not be opened right now.");
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.eyebrow}>Google</Text>
      <Text style={styles.title}>
        {mode === "signup" ? "Continue with Google" : "Sign in with Google"}
      </Text>
      <Text style={styles.copy}>
        Use a verified Google account to match your ShareVerse profile instantly.
      </Text>

      <Pressable
        onPress={() => void handlePress()}
        disabled={!isConfigured || !request || disabled || authenticating}
        style={({ pressed }) => [
          styles.button,
          (pressed && !disabled && !authenticating && request) ? styles.buttonPressed : null,
          (!isConfigured || !request || disabled || authenticating) ? styles.buttonDisabled : null,
        ]}
      >
        <View style={styles.buttonRow}>
          {authenticating ? (
            <ActivityIndicator color={colors.night} />
          ) : (
            <GoogleMark color="#4285F4" size={20} />
          )}
          <Text style={styles.buttonLabel}>
            {authenticating ? "Finishing Google sign-in..." : "Continue with Google"}
          </Text>
        </View>
      </Pressable>

      <Text style={styles.note}>
        {isConfigured
          ? "Tip: add dedicated Android and iOS Google client IDs in mobile env for the smoothest native sign-in."
          : "Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to mobile/.env to enable Google sign-in."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: colors.night,
    fontSize: 20,
    fontWeight: "800",
  },
  copy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  buttonDisabled: {
    opacity: 0.58,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonLabel: {
    color: colors.night,
    fontSize: 15,
    fontWeight: "800",
  },
  note: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
