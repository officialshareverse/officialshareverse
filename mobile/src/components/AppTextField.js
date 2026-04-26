import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Eye, EyeOff } from "./Icons";
import { colors, radius, spacing } from "../theme/tokens";

export default function AppTextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "none",
  secureTextEntry = false,
  showSecureToggle = false,
  isSecureVisible = false,
  onToggleSecure,
  helper,
  multiline = false,
}) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputShell, multiline ? styles.multilineShell : null]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry && !isSecureVisible}
          style={[styles.input, multiline ? styles.multilineInput : null]}
          multiline={multiline}
        />
        {showSecureToggle ? (
          <Pressable onPress={onToggleSecure} style={styles.toggle} hitSlop={12}>
            {isSecureVisible ? (
              <EyeOff color={colors.textMuted} size={18} strokeWidth={2.2} />
            ) : (
              <Eye color={colors.textMuted} size={18} strokeWidth={2.2} />
            )}
          </Pressable>
        ) : null}
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  multilineShell: {
    alignItems: "flex-start",
    paddingTop: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 14,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  toggle: {
    paddingLeft: spacing.sm,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
