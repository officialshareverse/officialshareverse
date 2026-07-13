import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { useAuth } from "../../auth/AuthProvider";
import AppButton from "../../components/AppButton";
import Screen from "../../components/Screen";
import { colors, spacing } from "../../theme/tokens";
import { formatCurrency } from "../../utils/formatters";
import { getActionError } from "../../utils/mySplits";

const RAZORPAY_ORIGIN_ALLOWLIST = [
  "https://checkout.razorpay.com",
  "https://api.razorpay.com",
];
const RAZORPAY_CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";

function safeJsonForScript(value) {
  return JSON.stringify(value == null ? {} : value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildAllowedOriginPredicate(successUrl) {
  let successHost = null;
  try {
    successHost = successUrl ? new URL(successUrl).host : null;
  } catch {
    successHost = null;
  }
  return (url) => {
    if (typeof url !== "string" || !url) return false;
    if (url.startsWith("about:")) return true;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") return false;
      return (
        parsed.host === "checkout.razorpay.com" ||
        parsed.host === "api.razorpay.com" ||
        parsed.host.endsWith(".razorpay.com") ||
        (successHost && parsed.host === successHost)
      );
    } catch {
      return false;
    }
  };
}

function buildCheckoutHtml(checkout) {
  const safeCheckout = safeJsonForScript(checkout);
  return `<!doctype html>
  <html><head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <script src="${RAZORPAY_CHECKOUT_URL}"></script>
    <style>
      body { margin: 0; background: #f5f7fb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
      .shell { width: min(92vw, 420px); background: #ffffff; border-radius: 24px; padding: 28px 24px; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.10); }
      h1 { margin: 0 0 10px; font-size: 28px; } p { margin: 0; line-height: 1.6; color: #475569; }
      button { width: 100%; margin-top: 22px; padding: 16px 18px; border: 0; border-radius: 16px; background: #0f766e; color: #ffffff; font-size: 16px; font-weight: 700; }
    </style>
  </head><body><div class="shell">
    <h1>Secure wallet top-up</h1><p>Your Razorpay checkout will open inside this screen. If it does not open automatically, use the button below.</p>
    <button id="open-checkout">Continue to Razorpay</button>
  </div><script>
    const checkout = ${safeCheckout};
    const postMessage = (payload) => window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    function openCheckout() {
      if (typeof Razorpay === "undefined") { postMessage({ type: "error", message: "Razorpay checkout script did not load." }); return; }
      const options = { ...checkout, modal: { ondismiss: () => postMessage({ type: "dismissed" }) }, handler: (response) => postMessage({ type: "success", payload: response }) };
      try {
        const checkoutInstance = new Razorpay(options);
        checkoutInstance.on("payment.failed", (response) => {
          const error = response && response.error ? response.error : {};
          postMessage({ type: "payment_failed", payload: { code: error.code || "", description: error.description || "Razorpay payment failed.", reason: error.reason || "" } });
        });
        checkoutInstance.open();
      } catch (error) { postMessage({ type: "error", message: error && error.message ? error.message : "Could not launch Razorpay checkout." }); }
    }
    document.getElementById("open-checkout").addEventListener("click", openCheckout);
    window.addEventListener("load", () => setTimeout(openCheckout, 250));
  </script></body></html>`;
}

const boundedString = (value, maxLength = 500) => String(value || "").slice(0, maxLength);

export default function WalletTopupCheckoutScreen({ navigation, route }) {
  const { api } = useAuth();
  const checkout = route.params?.checkout || null;
  const topup = route.params?.topup || null;
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const handledResultRef = useRef(false);

  const html = useMemo(() => buildCheckoutHtml(checkout), [checkout]);
  const successUrl = useMemo(
    () => checkout?.callback_url || api?.defaults?.baseURL || "",
    [api?.defaults?.baseURL, checkout?.callback_url]
  );
  const isAllowedOrigin = useMemo(() => buildAllowedOriginPredicate(successUrl), [successUrl]);

  const verifyCheckout = async (payload) => {
    if (handledResultRef.current) return;
    handledResultRef.current = true;
    try {
      setVerifying(true);
      setError("");
      const response = await api.post("payments/razorpay/verify/", payload);
      Alert.alert(
        "Wallet credited",
        response.data?.message || `${formatCurrency(topup?.amount || 0)} was added to your wallet balance.`,
        [{ text: "Back to wallet", onPress: () => navigation.goBack() }]
      );
    } catch (requestError) {
      handledResultRef.current = false;
      const message = getActionError(requestError?.response?.data, "We could not verify the wallet top-up right now.");
      setError(message);
      Alert.alert("Verification failed", message);
    } finally {
      setVerifying(false);
    }
  };

  const handleShouldStartLoadWithRequest = useCallback(
    (request) => {
      const url = request?.url || "";
      if (isAllowedOrigin(url)) return true;
      if (url.startsWith("https://") || url.startsWith("http://")) {
        Linking.openURL(url).catch(() => {});
      }
      return false;
    },
    [isAllowedOrigin]
  );

  const handleMessage = useCallback((event) => {
    let message;
    try {
      message = JSON.parse(event?.nativeEvent?.data || "{}");
    } catch {
      return;
    }
    if (!message || typeof message !== "object" || typeof message.type !== "string") return;

    if (message.type === "success") {
      const raw = message.payload && typeof message.payload === "object" ? message.payload : {};
      const payload = {};
      [
        ["razorpay_payment_id", 256],
        ["razorpay_order_id", 256],
        ["razorpay_signature", 512],
      ].forEach(([field, maximum]) => {
        if (raw[field] != null) payload[field] = boundedString(raw[field], maximum);
      });
      if (!payload.razorpay_payment_id || !payload.razorpay_order_id || !payload.razorpay_signature) {
        setError("Razorpay returned an incomplete payment response.");
        return;
      }
      void verifyCheckout(payload);
      return;
    }
    if (message.type === "dismissed") {
      if (!handledResultRef.current) Alert.alert("Checkout dismissed", "No money was added to the wallet.");
      return;
    }
    if (message.type === "payment_failed") {
      setError(boundedString(message.payload?.description, 500) || "Razorpay reported a payment failure.");
      return;
    }
    if (message.type === "error") setError(boundedString(message.message, 500) || "We could not launch the Razorpay checkout.");
  }, [verifyCheckout]);

  if (!checkout) {
    return (
      <Screen title="Wallet checkout" subtitle="No checkout payload was provided for this top-up.">
        <Text style={styles.error}>Start a new top-up from the Wallet screen.</Text>
        <AppButton title="Back to wallet" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen title="Wallet checkout" subtitle={`Finishing a secure Razorpay top-up for ${formatCurrency(topup?.amount || 0)}.`} contentStyle={styles.content}>
      <View style={styles.webviewShell}>
        <WebView
          source={{ html }}
          originWhitelist={[...RAZORPAY_ORIGIN_ALLOWLIST, "about:"]}
          javaScriptEnabled // Required by Razorpay; JSON escaping and navigation allowlists constrain the surface.
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          startInLoadingState
          renderLoading={() => <View style={styles.loadingState}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.supportingCopy}>Launching Razorpay checkout...</Text></View>}
          onMessage={handleMessage}
        />
      </View>
      {verifying ? <View style={styles.infoCard}><ActivityIndicator color={colors.primary} /><Text style={styles.supportingCopy}>Verifying the payment and crediting your wallet...</Text></View> : null}
      {error ? <View style={styles.infoCard}><Text style={styles.error}>{error}</Text></View> : null}
      <AppButton title="Back to wallet" onPress={() => navigation.goBack()} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  webviewShell: { height: 520, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface },
  infoCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm, alignItems: "center" },
  supportingCopy: { color: colors.textMuted, fontSize: 14, lineHeight: 22, textAlign: "center" },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
});
