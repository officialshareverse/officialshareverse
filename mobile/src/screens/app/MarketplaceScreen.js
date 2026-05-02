import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppTextField from "../../components/AppTextField";
import GroupCard from "../../components/GroupCard";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "sharing", label: "Sharing" },
  { key: "group_buy", label: "Buy together" },
];

const SORTS = [
  { key: "popular", label: "Popular" },
  { key: "cheapest", label: "Cheapest" },
  { key: "ending_soon", label: "Ending soon" },
  { key: "almost_full", label: "Almost full" },
  { key: "newest", label: "Newest" },
];

export default function MarketplaceScreen({ navigation }) {
  const { api } = useAuth();
  const [groups, setGroups] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [search, setSearch] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [hideJoined, setHideJoined] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await api.get("groups/");
      setGroups(Array.isArray(response.data) ? response.data : []);
      setError("");
    } catch {
      setError("We could not load groups right now.");
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const results = groups.filter((group) => {
      const matchesFilter = filter === "all" ? true : group.mode === filter;
      const haystack = `${group.subscription_name || ""} ${group.owner_name || ""}`.toLowerCase();
      const matchesSearch = normalizedSearch ? haystack.includes(normalizedSearch) : true;
      const matchesUrgent = urgentOnly
        ? Number(group.remaining_slots || 0) <= 1 || Number(group.remaining_cycle_days || 0) <= 3
        : true;
      const matchesJoined = hideJoined ? !group.is_joined : true;
      return matchesFilter && matchesSearch && matchesUrgent && matchesJoined;
    });

    return results.sort((left, right) => {
      if (sortBy === "cheapest") {
        return Number(left.join_price || left.price_per_slot || 0) - Number(right.join_price || right.price_per_slot || 0);
      }
      if (sortBy === "ending_soon") {
        return Number(left.remaining_cycle_days || 999) - Number(right.remaining_cycle_days || 999);
      }
      if (sortBy === "almost_full") {
        return Number(left.remaining_slots || 999) - Number(right.remaining_slots || 999);
      }
      if (sortBy === "newest") {
        return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
      }

      const progressDelta = Number(right.progress_percent || 0) - Number(left.progress_percent || 0);
      if (progressDelta !== 0) {
        return progressDelta;
      }
      return Number(right.filled_slots || 0) - Number(left.filled_slots || 0);
    });
  }, [filter, groups, hideJoined, search, sortBy, urgentOnly]);

  const summary = useMemo(() => {
    return {
      total: groups.length,
      showing: filteredGroups.length,
      urgent: groups.filter(
        (group) => Number(group.remaining_slots || 0) <= 1 || Number(group.remaining_cycle_days || 0) <= 3
      ).length,
      sharing: groups.filter((group) => group.mode === "sharing").length,
    };
  }, [filteredGroups.length, groups]);

  const handleJoin = async (group) => {
    try {
      setJoiningId(group.id);
      const response = await api.post("join-group/", { group_id: group.id });
      Alert.alert(
        "Joined group",
        response.data?.message || `${group.subscription_name} is now in your ShareVerse activity.`
      );
      await load();
    } catch (requestError) {
      Alert.alert(
        "Join failed",
        requestError?.response?.data?.error || "We could not join this group right now."
      );
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <Screen
      title="Marketplace"
      subtitle="Browse open ShareVerse groups and join with your wallet balance."
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>Marketplace snapshot</Text>
        <Text style={styles.summaryCopy}>
          {summary.showing} of {summary.total} groups match the current view. {summary.urgent} urgent opportunities and {summary.sharing} sharing plans are live.
        </Text>
      </SectionCard>

      <AppTextField
        label="Search"
        value={search}
        onChangeText={setSearch}
        placeholder="Search subscriptions or hosts"
      />

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Text
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
            >
              {item.label}
            </Text>
          );
        })}
      </View>

      <View style={styles.filterRow}>
        {SORTS.map((item) => {
          const active = item.key === sortBy;
          return (
            <Text
              key={item.key}
              onPress={() => setSortBy(item.key)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
            >
              {item.label}
            </Text>
          );
        })}
      </View>

      <View style={styles.filterRow}>
        <Text
          onPress={() => setUrgentOnly((current) => !current)}
          style={[styles.filterChip, urgentOnly ? styles.filterChipActive : null]}
        >
          Urgent only
        </Text>
        <Text
          onPress={() => setHideJoined((current) => !current)}
          style={[styles.filterChip, hideJoined ? styles.filterChipActive : null]}
        >
          Hide joined
        </Text>
      </View>

      {filteredGroups.length ? (
        filteredGroups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            joining={joiningId === group.id}
            onJoin={() => void handleJoin(group)}
            onOpen={() => navigation.navigate("GroupDetail", { group })}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No groups match this view yet.</Text>
          <Text style={styles.emptyCopy}>Try a different search or switch back to all groups.</Text>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  summaryCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textMuted,
    paddingHorizontal: 14,
    paddingVertical: 9,
    overflow: "hidden",
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: "#ffffff",
  },
  emptyState: {
    paddingVertical: spacing.xl,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
