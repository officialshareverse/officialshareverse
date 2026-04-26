import { Pressable, StyleSheet, Text, View } from "react-native";

import { ArrowRight, Coins, Users } from "./Icons";
import { colors, radius, shadows, spacing } from "../theme/tokens";
import { formatCurrency } from "../utils/formatters";
import AppButton from "./AppButton";

function modeLabel(mode) {
  return mode === "group_buy" ? "Buy together" : "Sharing";
}

export default function GroupCard({ group, onOpen, onJoin, joining = false }) {
  const slotsLeft = Number(group.remaining_slots ?? 0);

  return (
    <Pressable onPress={onOpen} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{modeLabel(group.mode)}</Text>
        </View>
        <Text style={styles.statusText}>{group.status_label || group.status}</Text>
      </View>

      <Text style={styles.name}>{group.subscription_name || group.subscription?.name}</Text>
      <Text style={styles.owner}>Hosted by @{group.owner_name || group.owner_username || "shareverse"}</Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Coins color={colors.primary} size={16} strokeWidth={2.1} />
          <Text style={styles.metaText}>{formatCurrency(group.join_price || group.price_per_slot)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Users color={colors.secondary} size={16} strokeWidth={2.1} />
          <Text style={styles.metaText}>{slotsLeft} slots left</Text>
        </View>
      </View>

      {group.pricing_note ? <Text style={styles.note}>{group.pricing_note}</Text> : null}

      <View style={styles.footerRow}>
        <AppButton
          title="Join group"
          onPress={(event) => {
            event?.stopPropagation?.();
            onJoin?.(event);
          }}
          loading={joining}
          fullWidth={false}
        />
        <ArrowRight color={colors.textMuted} size={18} strokeWidth={2.1} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  badge: {
    backgroundColor: "#dff7f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
    textAlign: "right",
  },
  name: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.night,
  },
  owner: {
    color: colors.textMuted,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  note: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
