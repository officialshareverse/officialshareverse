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
  const progressPercent = Math.max(0, Math.min(100, Number(group.progress_percent || 0)));
  const isUrgent = slotsLeft <= 1 || Number(group.remaining_cycle_days || 0) <= 3;

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

      <View style={styles.tagRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{slotsLeft} left</Text>
        </View>
        {group.remaining_cycle_days ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{group.remaining_cycle_days} days left</Text>
          </View>
        ) : null}
        {group.is_joined ? (
          <View style={[styles.tag, styles.tagSuccess]}>
            <Text style={[styles.tagText, styles.tagSuccessText]}>Joined</Text>
          </View>
        ) : null}
        {isUrgent ? (
          <View style={[styles.tag, styles.tagUrgent]}>
            <Text style={[styles.tagText, styles.tagUrgentText]}>Urgent</Text>
          </View>
        ) : null}
      </View>

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

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      {group.pricing_note ? <Text style={styles.note}>{group.pricing_note}</Text> : null}
      {group.next_action ? <Text style={styles.nextAction}>{group.next_action}</Text> : null}

      <View style={styles.footerRow}>
        <AppButton
          title={group.join_cta || "Join group"}
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
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tag: {
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  tagSuccess: {
    backgroundColor: "#dff7f2",
  },
  tagSuccessText: {
    color: colors.primary,
  },
  tagUrgent: {
    backgroundColor: "#fff3e7",
  },
  tagUrgentText: {
    color: colors.secondary,
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
  nextAction: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
