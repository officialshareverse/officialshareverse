import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import { LogOut, TicketPercent, UserRound } from "../../components/Icons";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";
import { getInitials } from "../../utils/formatters";

function SmallMetric({ label, value }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { api, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await api.get("profile/");
      setProfile(response.data || null);
      setError("");
    } catch {
      setError("We could not load your profile right now.");
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen
      title="Profile"
      subtitle="Your identity, wallet reputation, and referral activity live here."
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <SectionCard>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(profile?.full_name || profile?.username)}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{profile?.full_name || profile?.username || "ShareVerse user"}</Text>
            <Text style={styles.meta}>{profile?.email || "No email on file"}</Text>
            <Text style={styles.meta}>{profile?.phone || "No phone on file"}</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <SmallMetric label="Joined" value={String(profile?.groups_joined || 0)} />
          <SmallMetric label="Created" value={String(profile?.groups_created || 0)} />
          <SmallMetric label="Complete" value={`${profile?.profile_completion || 0}%`} />
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Account actions</Text>
        <AppButton
          title="Refer and earn"
          onPress={() => navigation.navigate("Referral")}
          variant="secondary"
          icon={TicketPercent}
        />
        <AppButton
          title="Sign out"
          onPress={() => void signOut()}
          variant="secondary"
          icon={LogOut}
        />
      </SectionCard>

      <SectionCard>
        <View style={styles.rowWithIcon}>
          <UserRound color={colors.primary} size={18} strokeWidth={2.1} />
          <Text style={styles.sectionTitle}>Trust and account state</Text>
        </View>
        <Text style={styles.meta}>Trust score: {profile?.trust_score || 0}</Text>
        <Text style={styles.meta}>Verified: {profile?.is_verified ? "Yes" : "No"}</Text>
        <Text style={styles.meta}>Reviews: {profile?.review_count || 0}</Text>
      </SectionCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.night,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.night,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  metricTile: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: spacing.md,
  },
  metricValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  rowWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
