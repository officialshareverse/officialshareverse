import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import { Bell, LogOut, MessageSquare, Star, TicketPercent, Trash2, UserRound, UserX } from "../../components/Icons";
import { LegalLinkButtons } from "../../components/LegalLinks";
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

function getProfileNextStep(profile) {
  if (!profile?.first_name || !profile?.last_name) {
    return "Add your full name";
  }
  if (!profile?.phone) {
    return "Add phone number";
  }
  if (!profile?.has_profile_picture) {
    return "Add profile photo";
  }
  return "Profile complete";
}

export default function ProfileScreen({ navigation }) {
  const { api, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const [profileResponse, blocksResponse] = await Promise.all([
        api.get("profile/"),
        api.get("safety/blocks/"),
      ]);
      setProfile(profileResponse.data || null);
      setBlockedUsers(
        Array.isArray(blocksResponse.data?.blocked_users) ? blocksResponse.data.blocked_users : []
      );
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

  const completion = Math.max(0, Math.min(100, Number(profile?.profile_completion || 0)));
  const trustScore = Math.max(0, Number(profile?.trust_score || 0));
  const filledStars = Math.max(0, Math.min(5, Math.round(trustScore)));
  const nextStep = getProfileNextStep(profile);

  const handleUnblock = (blockedUser) => {
    Alert.alert("Unblock user?", `You will start seeing messages from @${blockedUser.blocked_username} again.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: async () => {
          try {
            await api.delete(`safety/blocks/${blockedUser.blocked_user_id}/`);
            setBlockedUsers((current) =>
              current.filter((item) => item.blocked_user_id !== blockedUser.blocked_user_id)
            );
          } catch {
            Alert.alert("Unblock failed", "We could not unblock this user right now.");
          }
        },
      },
    ]);
  };

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

        <View style={styles.completionBlock}>
          <View style={styles.completionHeader}>
            <Text style={styles.completionTitle}>Profile completion</Text>
            <Text style={styles.completionValue}>{completion}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completion}%` }]} />
          </View>
          <Text style={styles.meta}>
            {completion >= 100 ? "Your profile is ready." : `${completion}% - ${nextStep} to reach 100%`}
          </Text>
          {completion < 100 ? (
            <AppButton
              title={nextStep}
              onPress={() => void WebBrowser.openBrowserAsync("https://shareverse.in/profile")}
              variant="secondary"
            />
          ) : null}
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Account actions</Text>
        <AppButton
          title="My splits"
          onPress={() => navigation.navigate("MySplits")}
          variant="secondary"
        />
        <AppButton
          title="Joined groups"
          onPress={() => navigation.navigate("JoinedGroups")}
          variant="secondary"
        />
        <AppButton
          title="Create split"
          onPress={() => navigation.navigate("CreateSplit")}
          variant="secondary"
        />
        <AppButton
          title="Notifications"
          onPress={() => navigation.navigate("Notifications")}
          variant="secondary"
          icon={Bell}
        />
        <AppButton
          title="Chats"
          onPress={() => navigation.navigate("Chats")}
          variant="secondary"
          icon={MessageSquare}
        />
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
        <View style={styles.trustRow}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={`trust-${index}`}
              color={index < filledStars ? colors.warning : "#a8b1bf"}
              size={19}
              strokeWidth={2.3}
            />
          ))}
          <Text style={styles.trustHelp}>
            {trustScore > 0 ? `${trustScore.toFixed(1)} trust score` : "Build trust by completing splits"}
          </Text>
        </View>
        <Text style={styles.meta}>Verified: {profile?.is_verified ? "Yes" : "No"}</Text>
        <Text style={styles.meta}>Reviews: {profile?.review_count || 0}</Text>
      </SectionCard>

      <SectionCard>
        <View style={styles.rowWithIcon}>
          <UserX color={colors.primary} size={18} strokeWidth={2.1} />
          <Text style={styles.sectionTitle}>Safety</Text>
        </View>
        <Text style={styles.meta}>
          Report unsafe messages from chat. Blocked users stay hidden from your chat views.
        </Text>
        {blockedUsers.length ? (
          blockedUsers.map((blockedUser) => (
            <View key={blockedUser.id} style={styles.blockedUserRow}>
              <View style={styles.blockedUserCopy}>
                <Text style={styles.blockedUserName}>
                  @{blockedUser.blocked_username || blockedUser.blocked_display_name}
                </Text>
                <Text style={styles.meta}>Blocked from chat</Text>
              </View>
              <AppButton
                title="Unblock"
                onPress={() => handleUnblock(blockedUser)}
                variant="secondary"
                fullWidth={false}
              />
            </View>
          ))
        ) : (
          <Text style={styles.meta}>You have not blocked anyone.</Text>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Legal</Text>
        <Text style={styles.meta}>Review the latest ShareVerse terms and privacy policy.</Text>
        <LegalLinkButtons />
        <AppButton
          title="Request account deletion"
          onPress={() => navigation.navigate("AccountDeletion")}
          variant="secondary"
          icon={Trash2}
        />
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
  completionBlock: {
    gap: spacing.sm,
  },
  completionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  completionTitle: {
    color: colors.night,
    fontSize: 15,
    fontWeight: "800",
  },
  completionValue: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: "#d8dde5",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
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
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  trustHelp: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginLeft: 4,
  },
  blockedUserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
  },
  blockedUserCopy: {
    flex: 1,
    gap: 3,
  },
  blockedUserName: {
    color: colors.night,
    fontSize: 14,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
