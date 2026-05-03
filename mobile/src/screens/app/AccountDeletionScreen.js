import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import AppTextField from "../../components/AppTextField";
import { ACCOUNT_DELETION_URL } from "../../components/LegalLinks";
import Screen, { SectionCard } from "../../components/Screen";
import { colors, radius, spacing } from "../../theme/tokens";
import { getActionError } from "../../utils/mySplits";

const DEFAULT_RETENTION_NOTICE =
  "ShareVerse will delete or anonymize account data that is no longer needed. Payment, wallet, payout, dispute, fraud-prevention, tax, and legal records may be retained where required.";

export default function AccountDeletionScreen() {
  const { api } = useAuth();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [existingRequest, setExistingRequest] = useState(null);
  const [retentionNotice, setRetentionNotice] = useState(DEFAULT_RETENTION_NOTICE);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadDeletionStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("mobile/account/deletion-request/");
      setExistingRequest(response.data?.account_deletion_request || null);
      setRetentionNotice(response.data?.retention_notice || DEFAULT_RETENTION_NOTICE);
      setError("");
    } catch (requestError) {
      setError(
        getActionError(
          requestError?.response?.data,
          "We could not load your account deletion status right now."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadDeletionStatus();
  }, [loadDeletionStatus]);

  const submitDeletionRequest = async () => {
    try {
      setSubmitting(true);
      setError("");
      const response = await api.post("mobile/account/deletion-request/", {
        reason: reason.trim(),
        details: details.trim(),
      });
      setExistingRequest(response.data?.account_deletion_request || null);
      setRetentionNotice(response.data?.retention_notice || DEFAULT_RETENTION_NOTICE);
      Alert.alert(
        "Request submitted",
        response.data?.message || "Support will review your account deletion request and follow up by email."
      );
    } catch (requestError) {
      setError(
        getActionError(
          requestError?.response?.data,
          "We could not submit your account deletion request right now."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (existingRequest) {
      return;
    }
    if (!acknowledged) {
      setError("Confirm that you understand some records may need to be retained.");
      return;
    }

    Alert.alert(
      "Request account deletion?",
      "ShareVerse support will review the request and follow up by email before account data is deleted or anonymized.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit request",
          style: "destructive",
          onPress: () => void submitDeletionRequest(),
        },
      ]
    );
  };

  return (
    <Screen
      title="Account deletion"
      subtitle="Submit a request to delete or anonymize your ShareVerse account data."
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>What happens next</Text>
        <Text style={styles.copy}>
          Support reviews deletion requests, verifies account ownership, and follows up by email.
        </Text>
        <Text style={styles.copy}>{retentionNotice}</Text>
      </SectionCard>

      {existingRequest ? (
        <SectionCard style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Request status</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{existingRequest.status_label || "Pending"}</Text>
          </View>
          <Text style={styles.copy}>
            We will contact {existingRequest.contact_email || "your account email"} about this request.
          </Text>
        </SectionCard>
      ) : (
        <SectionCard>
          <Text style={styles.sectionTitle}>Request deletion</Text>
          <AppTextField
            label="Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Optional"
          />
          <AppTextField
            label="Details"
            value={details}
            onChangeText={setDetails}
            placeholder="Anything support should know before reviewing this request"
            multiline
          />
          <Pressable
            onPress={() => {
              setAcknowledged((current) => !current);
              setError("");
            }}
            style={styles.ackRow}
          >
            <View style={[styles.checkbox, acknowledged ? styles.checkboxChecked : null]}>
              {acknowledged ? <Text style={styles.checkboxTick}>OK</Text> : null}
            </View>
            <Text style={styles.ackCopy}>
              I understand that required payment, payout, dispute, fraud-prevention, tax, and legal records may be retained.
            </Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton
            title={submitting ? "Submitting request..." : "Submit deletion request"}
            onPress={handleSubmit}
            loading={submitting || loading}
          />
        </SectionCard>
      )}

      <SectionCard>
        <Text style={styles.sectionTitle}>Web deletion request</Text>
        <Text style={styles.copy}>
          You can also request deletion from the public ShareVerse account deletion page.
        </Text>
        <AppButton
          title="Open web page"
          onPress={() => void WebBrowser.openBrowserAsync(ACCOUNT_DELETION_URL)}
          variant="secondary"
        />
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
  copy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  statusCard: {
    borderColor: "rgba(15, 118, 110, 0.28)",
    backgroundColor: "#ecfdf5",
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  ackRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxTick: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
  },
  ackCopy: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
});
