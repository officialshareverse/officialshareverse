import { Pressable, StyleSheet, Text, View } from "react-native";

import { ArrowRight, Coins, Users } from "./Icons";
import { colors, radius, shadows, spacing } from "../theme/tokens";
import { formatCurrency, getInitials } from "../utils/formatters";
import AppButton from "./AppButton";
import SubscriptionLogo from "./SubscriptionLogo";

function modeLabel(mode) {
  return mode === "group_buy" ? "Buy together" : "Sharing";
}

export default function GroupCard({ group, onOpen, onJoin, joining = false }) {
  const slotsLeft = Number(group.remaining_slots ?? 0);
  const totalSlots = Math.max(1, Number(group.total_slots || 1));
  const filledSlots = Math.max(0, Math.min(totalSlots, Number(group.filled_slots || 0)));
  const progressPercent = Math.max(0, Math.min(100, Number(group.progress_percent || 0)));
  const isUrgent = slotsLeft <= 1 || Number(group.remaining_cycle_days || 0) <= 3;
  const hostName = group.owner_name || group.owner_username || "ShareVerse host";
  const slotDots = Array.from({ length: Math.min(totalSlots, 8) });

  return (
    <Pressable onPress={onOpen} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{modeLabel(group.mode)}</Text>
        </View>
        {isUrgent ? (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeText}>Urgent</Text>
          </View>
        ) : (
          <Text style={styles.statusText}>{group.status_label || group.status}</Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <SubscriptionLogo name={group.subscription_name || group.subscription?.name} size={36} style={{ marginRight: 10 }} />
        <Text style={[styles.name, { marginBottom: 0, flex: 1 }]} numberOfLines={1}>
          {group.subscription_name || group.subscription?.name}
        </Text>
      </View>
      <View style={styles.ownerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(hostName)}</Text>
        </View>
        <Text style={styles.owner}>@{hostName}</Text>
        {group.remaining_cycle_days ? (
          <Text style={styles.ownerMeta}>- {group.remaining_cycle_days} days left</Text>
        ) : null}
      </View>

      <View style={styles.slotRow}>
        <View style={styles.slotDots}>
          {slotDots.map((_, index) => (
            <View
              key={`${group.id}-slot-${index}`}
              style={[styles.slotDot, index < filledSlots ? styles.slotDotFilled : null]}
            />
          ))}
        </View>
        <Text style={styles.slotText}>
          {filledSlots} of {totalSlots} slots filled
        </Text>
        {group.is_joined ? (
          <View style={styles.joinedPill}>
            <Text style={styles.joinedPillText}>Joined</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      {group.pricing_note ? <Text style={styles.note}>{group.pricing_note}</Text> : null}
      {group.next_action ? <Text style={styles.nextAction}>{group.next_action}</Text> : null}

      <View style={styles.footerRow}>
        <View style={styles.priceWrap}>
          <View style={styles.metaItem}>
            <Coins color={colors.primary} size={17} strokeWidth={2.1} />
            <Text style={styles.priceText}>{formatCurrency(group.join_price || group.price_per_slot)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Users color={colors.textMuted} size={15} strokeWidth={2.1} />
            <Text style={styles.remainingText}>{slotsLeft} left</Text>
          </View>
        </View>
        <AppButton
          title={group.is_joined ? "Joined" : "Join"}
          onPress={(event) => {
            event?.stopPropagation?.();
            onJoin?.(event);
          }}
          loading={joining}
          disabled={Boolean(group.is_joined)}
          fullWidth={false}
          icon={group.is_joined ? undefined : ArrowRight}
        />
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
  urgentBadge: {
    borderRadius: 999,
    backgroundColor: "#fff3e7",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  urgentBadgeText: {
    color: "#9a3412",
    fontSize: 12,
    fontWeight: "800",
  },
  name: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.night,
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#4338ca",
    fontSize: 12,
    fontWeight: "900",
  },
  owner: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  ownerMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  slotDots: {
    flexDirection: "row",
    gap: 5,
  },
  slotDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#a8b1bf",
    backgroundColor: "#d8dde5",
  },
  slotDotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  joinedPill: {
    borderRadius: 999,
    backgroundColor: "#dff7f2",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  joinedPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    gap: spacing.md,
  },
  priceWrap: {
    flex: 1,
    gap: 6,
  },
  priceText: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "900",
  },
  remainingText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
});
