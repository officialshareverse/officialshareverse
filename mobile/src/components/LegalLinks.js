import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { colors, radius, spacing } from "../theme/tokens";

export const ACCOUNT_DELETION_URL = "https://shareverse.in/account-deletion";

export const LEGAL_LINKS = [
  {
    key: "terms",
    label: "Terms",
    url: "https://shareverse.in/terms",
  },
  {
    key: "privacy",
    label: "Privacy Policy",
    url: "https://shareverse.in/privacy",
  },
];

async function openLegalUrl(url, label) {
  try {
    await WebBrowser.openBrowserAsync(url);
    return;
  } catch {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      Alert.alert("Could not open link", `Open ${url} in your browser to view the ${label}.`);
    }
  }
}

function LegalTextLink({ item }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ShareVerse ${item.label}`}
      onPress={() => void openLegalUrl(item.url, item.label)}
      hitSlop={8}
    >
      <Text style={styles.inlineLink}>{item.label}</Text>
    </Pressable>
  );
}

export default function LegalLinks({
  intro = "By continuing, you agree to",
  compact = false,
}) {
  return (
    <View style={[styles.inlineShell, compact ? styles.inlineShellCompact : null]}>
      <Text style={styles.inlineCopy}>{intro}</Text>
      <View style={styles.inlineRow}>
        <LegalTextLink item={LEGAL_LINKS[0]} />
        <Text style={styles.inlineCopy}>and</Text>
        <LegalTextLink item={LEGAL_LINKS[1]} />
      </View>
    </View>
  );
}

export function LegalLinkButtons() {
  return (
    <View style={styles.buttonList}>
      {LEGAL_LINKS.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="link"
          accessibilityLabel={`Open ShareVerse ${item.label}`}
          onPress={() => void openLegalUrl(item.url, item.label)}
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.buttonLabel}>{item.label}</Text>
          <Text style={styles.buttonHint}>Open</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  inlineShell: {
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  inlineShellCompact: {
    alignItems: "center",
  },
  inlineCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  inlineLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  buttonList: {
    gap: spacing.sm,
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  buttonLabel: {
    color: colors.night,
    fontSize: 15,
    fontWeight: "800",
  },
  buttonHint: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
});
