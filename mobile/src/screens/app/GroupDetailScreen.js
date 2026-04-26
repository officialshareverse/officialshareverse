import { Alert, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import { Coins, ShieldCheck, Users } from "../../components/Icons";
import Screen, { SectionCard } from "../../components/Screen";
import { colors } from "../../theme/tokens";
import { formatCurrency } from "../../utils/formatters";

export default function GroupDetailScreen({ route, navigation }) {
  const { api } = useAuth();
  const { group } = route.params;

  const handleJoin = async () => {
    try {
      const response = await api.post("join-group/", { group_id: group.id });
      Alert.alert(
        "Joined group",
        response.data?.message || `${group.subscription_name} is now part of your account.`,
        [
          {
            text: "Open wallet",
            onPress: () => navigation.navigate("Tabs", { screen: "WalletTab" }),
          },
          { text: "Done" },
        ]
      );
    } catch (requestError) {
      Alert.alert(
        "Join failed",
        requestError?.response?.data?.error || "We could not join this group right now."
      );
    }
  };

  return (
    <Screen
      title={group.subscription_name}
      subtitle={`${group.mode_label || group.mode} hosted by @${group.owner_name || "shareverse"}`}
    >
      <SectionCard>
        <View style={styles.row}>
          <Coins color={colors.primary} size={18} strokeWidth={2.1} />
          <Text style={styles.rowText}>Join price: {formatCurrency(group.join_price || group.price_per_slot)}</Text>
        </View>
        <View style={styles.row}>
          <Users color={colors.secondary} size={18} strokeWidth={2.1} />
          <Text style={styles.rowText}>
            {group.filled_slots || 0} of {group.total_slots || 0} slots filled
          </Text>
        </View>
        <View style={styles.row}>
          <ShieldCheck color={colors.success} size={18} strokeWidth={2.1} />
          <Text style={styles.rowText}>{group.status_label || group.status}</Text>
        </View>
      </SectionCard>

      {group.mode_description ? (
        <SectionCard>
          <Text style={styles.sectionTitle}>About this group</Text>
          <Text style={styles.copy}>{group.mode_description}</Text>
          {group.pricing_note ? <Text style={styles.note}>{group.pricing_note}</Text> : null}
        </SectionCard>
      ) : null}

      <AppButton title={group.join_cta || "Join group"} onPress={handleJoin} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  copy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  note: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
});
