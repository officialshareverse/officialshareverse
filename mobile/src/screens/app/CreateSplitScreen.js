import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import AppTextField from "../../components/AppTextField";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, radius, spacing } from "../../theme/tokens";

const MODE_OPTIONS = [
  {
    key: "sharing",
    label: "Sharing",
    description: "You already own the plan and want people to join.",
  },
  {
    key: "group_buy",
    label: "Buy together",
    description: "Members join first, then the group purchases together.",
  },
];

const CATEGORY_OPTIONS = [
  { key: "streaming", label: "Streaming" },
  { key: "education", label: "Education" },
  { key: "software", label: "Software" },
  { key: "general", label: "General" },
];

function toIsoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function buildInitialForm() {
  const startDate = new Date();
  return {
    subscription_name: "",
    mode: "sharing",
    category: "streaming",
    total_slots: "4",
    price_per_slot: "",
    start_date: toIsoDate(startDate),
    end_date: toIsoDate(addDays(startDate, 30)),
    access_identifier: "",
    access_password: "",
    access_notes: "",
  };
}

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim())) {
    return false;
  }
  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return !Number.isNaN(timestamp);
}

function OptionChip({ label, active, onPress }) {
  return (
    <Text onPress={onPress} style={[styles.optionChip, active ? styles.optionChipActive : null]}>
      {label}
    </Text>
  );
}

export default function CreateSplitScreen({ navigation }) {
  const { api } = useAuth();
  const [form, setForm] = useState(() => buildInitialForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedMode = useMemo(
    () => MODE_OPTIONS.find((option) => option.key === form.mode) || MODE_OPTIONS[0],
    [form.mode]
  );

  const updateField = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setError("");
  };

  const handleSubmit = async () => {
    const subscriptionName = form.subscription_name.trim();
    const totalSlots = Number.parseInt(form.total_slots, 10);
    const pricePerSlot = Number.parseFloat(form.price_per_slot);

    if (!subscriptionName) {
      setError("Add the plan or subscription name first.");
      return;
    }

    if (!Number.isInteger(totalSlots) || totalSlots < 1) {
      setError("Total slots must be at least 1.");
      return;
    }

    if (!Number.isFinite(pricePerSlot) || pricePerSlot <= 0) {
      setError("Price per slot must be greater than 0.");
      return;
    }

    if (!isValidDateInput(form.start_date) || !isValidDateInput(form.end_date)) {
      setError("Enter valid start and end dates in YYYY-MM-DD format.");
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      setError("End date must be on or after the start date.");
      return;
    }

    const payload = {
      subscription_name: subscriptionName,
      mode: form.mode,
      category: form.category,
      total_slots: totalSlots,
      price_per_slot: pricePerSlot.toFixed(2),
      start_date: form.start_date,
      end_date: form.end_date,
      subscription_price: Math.max(Math.round(pricePerSlot * totalSlots), 1),
      access_identifier: form.mode === "sharing" ? form.access_identifier.trim() : "",
      access_password: form.mode === "sharing" ? form.access_password : "",
      access_notes: form.mode === "sharing" ? form.access_notes.trim() : "",
    };

    try {
      setSaving(true);
      const response = await api.post("create-group/", payload);
      const groupId = response?.data?.group_id;
      setForm(buildInitialForm());
      setError("");
      if (groupId) {
        navigation.replace("MySplitDetail", { groupId });
        return;
      }
      navigation.navigate("MySplits");
    } catch (requestError) {
      const responseData = requestError?.response?.data;
      const nextError =
        responseData?.error ||
        Object.values(responseData || {}).flat().find(Boolean) ||
        "We could not create this split right now.";
      setError(String(nextError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title="Create split"
      subtitle="Set up a sharing or buy-together group from your phone."
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>Choose the flow</Text>
        <View style={styles.modeStack}>
          {MODE_OPTIONS.map((option) => {
            const active = option.key === form.mode;
            return (
              <View
                key={option.key}
                style={[styles.modeCard, active ? styles.modeCardActive : null]}
              >
                <Text
                  onPress={() => updateField("mode", option.key)}
                  style={[styles.modeTitle, active ? styles.modeTitleActive : null]}
                >
                  {option.label}
                </Text>
                <Text style={styles.modeDescription}>{option.description}</Text>
              </View>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Plan details</Text>
        <AppTextField
          label="Plan name"
          value={form.subscription_name}
          onChangeText={(value) => updateField("subscription_name", value)}
          placeholder="Netflix Premium, Notion Plus, etc."
          helper="Keep the name simple so members know exactly what they are joining."
        />

        <View style={styles.optionRow}>
          {CATEGORY_OPTIONS.map((option) => (
            <OptionChip
              key={option.key}
              label={option.label}
              active={option.key === form.category}
              onPress={() => updateField("category", option.key)}
            />
          ))}
        </View>

        <View style={styles.dualFieldRow}>
          <View style={styles.dualField}>
            <AppTextField
              label="Total slots"
              value={form.total_slots}
              onChangeText={(value) => updateField("total_slots", value.replace(/[^\d]/g, ""))}
              placeholder="4"
              keyboardType="number-pad"
              helper="How many member slots are available."
            />
          </View>
          <View style={styles.dualField}>
            <AppTextField
              label="Price per slot"
              value={form.price_per_slot}
              onChangeText={(value) => updateField("price_per_slot", value.replace(/[^0-9.]/g, ""))}
              placeholder="149"
              keyboardType="decimal-pad"
              helper="The amount each member will pay."
            />
          </View>
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Timeline</Text>
        <View style={styles.dualFieldRow}>
          <View style={styles.dualField}>
            <AppTextField
              label="Start date"
              value={form.start_date}
              onChangeText={(value) => updateField("start_date", value)}
              placeholder="YYYY-MM-DD"
              helper="Use the plan start date."
            />
          </View>
          <View style={styles.dualField}>
            <AppTextField
              label="End date"
              value={form.end_date}
              onChangeText={(value) => updateField("end_date", value)}
              placeholder="YYYY-MM-DD"
              helper="Use the plan end or renewal date."
            />
          </View>
        </View>
      </SectionCard>

      {form.mode === "sharing" ? (
        <SectionCard>
          <Text style={styles.sectionTitle}>Access setup</Text>
          <Text style={styles.supportingCopy}>
            Add these only if you want the credentials saved with the group now.
          </Text>
          <AppTextField
            label="Login identifier"
            value={form.access_identifier}
            onChangeText={(value) => updateField("access_identifier", value)}
            placeholder="Email, phone, or username"
            helper="Optional. You can also add credentials later."
          />
          <AppTextField
            label="Password"
            value={form.access_password}
            onChangeText={(value) => updateField("access_password", value)}
            placeholder="Password"
            helper="Optional. Stored only for the sharing flow."
          />
          <AppTextField
            label="Notes"
            value={form.access_notes}
            onChangeText={(value) => updateField("access_notes", value)}
            placeholder="Profile PIN, kid profile only, etc."
            helper="Optional instructions for members."
            multiline
          />
        </SectionCard>
      ) : null}

      <SectionCard style={styles.reviewCard}>
        <Text style={styles.sectionTitle}>Ready to publish</Text>
        <Text style={styles.supportingCopy}>
          {selectedMode.label} - {form.total_slots || "0"} slots - Rs{" "}
          {form.price_per_slot || "0.00"} per slot
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton title="Create split" onPress={() => void handleSubmit()} loading={saving} />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.night,
  },
  modeStack: {
    gap: spacing.md,
  },
  modeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
    backgroundColor: colors.surface,
  },
  modeCardActive: {
    borderColor: colors.primary,
    backgroundColor: "#e7f7f4",
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.night,
  },
  modeTitleActive: {
    color: colors.primary,
  },
  modeDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.surface,
    color: colors.textMuted,
    overflow: "hidden",
    fontSize: 13,
    fontWeight: "700",
  },
  optionChipActive: {
    color: "#ffffff",
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dualFieldRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dualField: {
    flex: 1,
  },
  supportingCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  reviewCard: {
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
});
