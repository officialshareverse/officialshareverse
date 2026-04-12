import { useEffect, useState } from "react";
import API from "../api/axios";

const RAZORPAY_CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";
let razorpayLoaderPromise;

function loadRazorpayCheckout() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Checkout is only available in the browser."));
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  if (!razorpayLoaderPromise) {
    razorpayLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_URL}"]`);
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.Razorpay));
        existingScript.addEventListener("error", () => reject(new Error("Unable to load checkout.")));
        return;
      }

      const script = document.createElement("script");
      script.src = RAZORPAY_CHECKOUT_URL;
      script.async = true;
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () => reject(new Error("Unable to load checkout."));
      document.body.appendChild(script);
    });
  }

  return razorpayLoaderPromise;
}

function formatCurrency(value) {
  const numericValue = Number(value || 0);
  return `Rs ${numericValue.toFixed(2)}`;
}

function parseError(err, fallbackMessage) {
  return err?.response?.data?.error || fallbackMessage;
}

export default function Wallet() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [walletPayments, setWalletPayments] = useState(null);
  const [workingAction, setWorkingAction] = useState("");
  const [topupAmount, setTopupAmount] = useState("500");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashboardResponse, transactionsResponse] = await Promise.all([
        API.get("dashboard/"),
        API.get("transactions/"),
      ]);
      setBalance(dashboardResponse.data.balance);
      setWalletPayments(dashboardResponse.data.wallet_payments || null);
      setTransactions(transactionsResponse.data);
    } catch (err) {
      console.error(err);
      setErrorMessage("Unable to load your wallet right now.");
    }
  };

  const startWalletTopup = async (event) => {
    event.preventDefault();
    setFeedbackMessage("");
    setErrorMessage("");

    try {
      setWorkingAction("add");
      const orderResponse = await API.post("payments/razorpay/create-order/", {
        amount: topupAmount,
      });
      setWalletPayments(orderResponse.data.payment || walletPayments);
      const Razorpay = await loadRazorpayCheckout();

      if (!Razorpay) {
        throw new Error("Checkout is unavailable right now.");
      }

      await new Promise((resolve, reject) => {
        const options = {
          ...orderResponse.data.checkout,
          theme: { color: "#0f766e" },
          modal: {
            ondismiss: () => reject(new Error("Payment window closed. No money was added.")),
          },
          handler: async (paymentResponse) => {
            try {
              const verifyResponse = await API.post(
                "payments/razorpay/verify/",
                paymentResponse
              );
              setFeedbackMessage(
                verifyResponse.data.message || "Wallet top-up credited successfully."
              );
              setTopupAmount("");
              await fetchData();
              resolve();
            } catch (verifyError) {
              reject(
                new Error(
                  verifyError?.response?.data?.error || "Payment verification failed."
                )
              );
            }
          },
        };

        const paymentObject = new Razorpay(options);
        paymentObject.on("payment.failed", (response) => {
          reject(
            new Error(
              response?.error?.description || "Payment failed before the wallet could be credited."
            )
          );
        });
        paymentObject.open();
      });
    } catch (err) {
      setErrorMessage(parseError(err, err.message || "Unable to start wallet top-up."));
    } finally {
      setWorkingAction("");
    }
  };

  const withdrawMoney = async (event) => {
    event.preventDefault();
    setFeedbackMessage("");
    setErrorMessage("");

    try {
      setWorkingAction("withdraw");
      const response = await API.post("withdraw-money/", { amount: withdrawAmount });
      setFeedbackMessage(response.data.message || "Money withdrawn from wallet.");
      setWithdrawAmount("");
      await fetchData();
    } catch (err) {
      setErrorMessage(parseError(err, "Failed to withdraw money."));
    } finally {
      setWorkingAction("");
    }
  };

  return (
    <div style={container}>
      <div style={hero}>
        <div style={heroCopy}>
          <p style={eyebrow}>Wallet</p>
          <h1 style={heroTitle}>Move money safely between your wallet and group activity.</h1>
          <p style={heroText}>
            Top up instantly through Razorpay, track every credit and debit, and keep your
            sharing and buy-together flows funded from one place.
          </p>
          <div style={quickTopups}>
            {["100", "300", "500", "1000"].map((amount) => (
              <button
                key={amount}
                type="button"
                style={quickAmountButton(topupAmount === amount)}
                onClick={() => setTopupAmount(amount)}
              >
                Rs {amount}
              </button>
            ))}
          </div>
        </div>

        <div style={balanceCard}>
          <p style={cardLabel}>Available balance</p>
          <h2 style={balanceValue}>{formatCurrency(balance)}</h2>
          <p style={balanceHint}>Used for joins, escrow-backed group buys, and shared-plan payouts.</p>
          {walletPayments && (
            <div style={modePill(walletPayments.mode)}>
              {walletPayments.mode_label}
            </div>
          )}
        </div>
      </div>

      {walletPayments && (
        <div style={paymentModeBanner(walletPayments.mode)}>
          {walletPayments.helper_text}
        </div>
      )}

      {(feedbackMessage || errorMessage) && (
        <div style={messageBanner(errorMessage ? "error" : "success")}>
          {errorMessage || feedbackMessage}
        </div>
      )}

      <div style={walletGrid}>
        <form style={actionCard} onSubmit={startWalletTopup}>
          <div style={cardHeader}>
            <div>
              <p style={cardEyebrow}>Top up</p>
              <h3 style={cardTitle}>Add money with Razorpay</h3>
            </div>
            <span style={highlightPill}>UPI, cards, netbanking</span>
          </div>

          <label style={label}>
            Amount
            <input
              type="number"
              min="1"
              step="0.01"
              value={topupAmount}
              onChange={(event) => setTopupAmount(event.target.value)}
              placeholder="Enter amount"
              style={input}
            />
          </label>

          <p style={supportingText}>
            Your wallet is credited only after the payment is verified successfully.
          </p>

          <button
            type="submit"
            style={primaryButton}
            disabled={workingAction !== "" || !walletPayments?.topup_enabled}
          >
            {workingAction === "add" ? "Opening checkout..." : "Add money securely"}
          </button>
        </form>

        <form style={actionCard} onSubmit={withdrawMoney}>
          <div style={cardHeader}>
            <div>
              <p style={cardEyebrow}>Withdraw</p>
              <h3 style={cardTitle}>Move money out of wallet</h3>
            </div>
            <span style={neutralPill}>Wallet balance required</span>
          </div>

          <label style={label}>
            Amount
            <input
              type="number"
              min="1"
              step="0.01"
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              placeholder="Enter withdrawal amount"
              style={input}
            />
          </label>

          <p style={supportingText}>
            Withdrawals reduce your in-app wallet balance immediately so your activity stays in sync.
          </p>

          <button type="submit" style={secondaryButton} disabled={workingAction !== ""}>
            {workingAction === "withdraw" ? "Withdrawing..." : "Withdraw money"}
          </button>
        </form>
      </div>

      <section style={historySection}>
        <div style={historyHeader}>
          <div>
            <p style={cardEyebrow}>History</p>
            <h3 style={cardTitle}>Transaction activity</h3>
          </div>
          <span style={historyMeta}>{transactions.length} record(s)</span>
        </div>

        <div style={historyList}>
          {transactions.length === 0 ? (
            <p style={emptyState}>No transactions yet.</p>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} style={transactionCard}>
                <div>
                  <div style={transactionHeader}>
                    <span style={transactionTitle}>{transaction.title}</span>
                    <span style={typePill(transaction.type)}>{transaction.type}</span>
                  </div>
                  <p style={transactionText}>{transaction.description}</p>
                  <p style={metaText}>
                    {transaction.mode_label}
                    {transaction.group_name ? ` | ${transaction.group_name}` : ""}
                  </p>
                </div>

                <div style={transactionRight}>
                  <p style={amountText(transaction.type)}>
                    {transaction.type === "credit" ? "+" : "-"} {formatCurrency(transaction.amount)}
                  </p>
                  <p style={metaText}>
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const container = {
  padding: "32px",
  background:
    "radial-gradient(circle at top left, rgba(15,118,110,0.11), transparent 30%), radial-gradient(circle at bottom right, rgba(187,122,20,0.10), transparent 24%), linear-gradient(180deg, #f7f2e9 0%, #eef4f6 100%)",
  minHeight: "100vh",
};

const hero = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "20px",
  alignItems: "stretch",
};

const heroCopy = {
  background: "rgba(255,255,255,0.80)",
  borderRadius: "32px",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  boxShadow: "0 28px 70px rgba(15, 23, 42, 0.09)",
  padding: "28px",
  backdropFilter: "blur(14px)",
};

const eyebrow = {
  margin: 0,
  fontSize: "12px",
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "#0f766e",
  fontWeight: 700,
};

const heroTitle = {
  margin: "10px 0 14px",
  color: "#0f172a",
  fontSize: "clamp(30px, 4vw, 44px)",
  lineHeight: 1.02,
  fontWeight: 800,
};

const heroText = {
  margin: 0,
  color: "#475569",
  fontSize: "17px",
  lineHeight: 1.7,
  maxWidth: "720px",
};

const quickTopups = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "22px",
};

const quickAmountButton = (active) => ({
  border: active ? "1px solid #0f766e" : "1px solid #cbd5e1",
  background: active ? "#ccfbf1" : "#ffffff",
  color: active ? "#115e59" : "#0f172a",
  borderRadius: "999px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
});

const balanceCard = {
  background: "linear-gradient(145deg, #0f172a 0%, #162033 48%, #0f766e 100%)",
  color: "#ffffff",
  borderRadius: "32px",
  padding: "28px",
  boxShadow: "0 34px 90px rgba(15, 23, 42, 0.22)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const cardLabel = {
  margin: 0,
  fontSize: "13px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.74)",
};

const balanceValue = {
  margin: "14px 0 10px",
  fontSize: "40px",
  lineHeight: 1,
};

const balanceHint = {
  margin: 0,
  color: "rgba(255,255,255,0.78)",
  lineHeight: 1.7,
};

const modePill = (mode) => ({
  alignSelf: "flex-start",
  marginTop: "18px",
  background:
    mode === "live" ? "rgba(16, 185, 129, 0.20)" : mode === "test" ? "rgba(250, 204, 21, 0.20)" : "rgba(148, 163, 184, 0.20)",
  color:
    mode === "live" ? "#bbf7d0" : mode === "test" ? "#fde68a" : "rgba(255,255,255,0.82)",
  borderRadius: "999px",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

const paymentModeBanner = (mode) => ({
  marginTop: "18px",
  padding: "14px 18px",
  borderRadius: "16px",
  border:
    mode === "live" ? "1px solid #a7f3d0" : mode === "test" ? "1px solid #fde68a" : "1px solid #cbd5e1",
  background:
    mode === "live" ? "#ecfdf5" : mode === "test" ? "#fefce8" : "#f8fafc",
  color:
    mode === "live" ? "#047857" : mode === "test" ? "#92400e" : "#475569",
  fontWeight: 600,
});

const walletGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "18px",
  marginTop: "22px",
};

const actionCard = {
  background: "rgba(255,255,255,0.82)",
  borderRadius: "30px",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow: "0 26px 70px rgba(15, 23, 42, 0.08)",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  backdropFilter: "blur(12px)",
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const cardEyebrow = {
  margin: 0,
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "#64748b",
  fontWeight: 700,
};

const cardTitle = {
  margin: "8px 0 0",
  color: "#0f172a",
  fontSize: "26px",
  lineHeight: 1.05,
  fontWeight: 800,
};

const highlightPill = {
  background: "#ccfbf1",
  color: "#115e59",
  borderRadius: "999px",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 700,
};

const neutralPill = {
  background: "#e2e8f0",
  color: "#334155",
  borderRadius: "999px",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 700,
};

const label = {
  display: "grid",
  gap: "8px",
  color: "#334155",
  fontWeight: 700,
};

const input = {
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: "20px",
  padding: "14px 16px",
  fontSize: "16px",
  background: "rgba(255,255,255,0.92)",
  outline: "none",
};

const supportingText = {
  margin: 0,
  color: "#64748b",
  lineHeight: 1.6,
};

const primaryButton = {
  background: "linear-gradient(135deg, #0f172a 0%, #1f3a4a 100%)",
  color: "#ffffff",
  border: "none",
  borderRadius: "999px",
  padding: "14px 18px",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.14)",
};

const secondaryButton = {
  background: "rgba(255,255,255,0.88)",
  color: "#0f172a",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: "999px",
  padding: "14px 18px",
  fontWeight: 700,
  cursor: "pointer",
};

const historySection = {
  marginTop: "24px",
  background: "rgba(255,255,255,0.82)",
  borderRadius: "30px",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow: "0 26px 70px rgba(15, 23, 42, 0.08)",
  padding: "24px",
  backdropFilter: "blur(12px)",
};

const historyHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  flexWrap: "wrap",
};

const historyMeta = {
  color: "#64748b",
  fontSize: "14px",
};

const historyList = {
  marginTop: "10px",
};

const emptyState = {
  margin: "18px 0 0",
  color: "#64748b",
};

const transactionCard = {
  display: "flex",
  justifyContent: "space-between",
  gap: "18px",
  padding: "18px 0",
  borderBottom: "1px solid #e2e8f0",
};

const transactionHeader = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const transactionTitle = {
  fontWeight: 700,
  color: "#0f172a",
};

const transactionText = {
  margin: "6px 0",
  color: "#475569",
  lineHeight: 1.6,
};

const transactionRight = {
  textAlign: "right",
  minWidth: "160px",
};

const metaText = {
  margin: 0,
  color: "#64748b",
  fontSize: "13px",
};

const amountText = (type) => ({
  margin: 0,
  fontWeight: 700,
  color: type === "credit" ? "#15803d" : "#b91c1c",
});

const typePill = (type) => ({
  background: type === "credit" ? "#dcfce7" : "#fee2e2",
  color: type === "credit" ? "#166534" : "#991b1b",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "capitalize",
});

const messageBanner = (tone) => ({
  marginTop: "18px",
  padding: "14px 18px",
  borderRadius: "16px",
  border: tone === "error" ? "1px solid #fecaca" : "1px solid #a7f3d0",
  background: tone === "error" ? "#fff1f2" : "#ecfdf5",
  color: tone === "error" ? "#b91c1c" : "#047857",
  fontWeight: 600,
});
