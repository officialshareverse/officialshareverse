import { useCallback, useEffect, useMemo, useState } from "react";

import API from "../api/axios";
import { SkeletonCard, SkeletonList, SkeletonTextGroup } from "../components/SkeletonFactory";
import { useToast } from "../components/ToastProvider";
import { WalletIcon as WalletGlyph } from "../components/UiIcons";
import { formatCurrency } from "../utils/format";
import { HistoryPanel, SimpleStat, TopUpPanel, WithdrawPanel } from "./walletUi";

const RAZORPAY_CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const ACTION_TABS = [
  { id: "topup", label: "Top Up" },
  { id: "withdraw", label: "Withdraw" },
  { id: "history", label: "History" },
];

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

function parseError(err, fallback) {
  return err?.response?.data?.error || fallback;
}

function toTimestamp(value) {
  return new Date(value || 0).getTime();
}

function formatDateTime(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusTone(status) {
  if (["processed", "success"].includes(status)) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (["pending", "queued", "processing"].includes(status)) {
    return "bg-amber-100 text-amber-700";
  }
  if (["failed", "rejected", "reversed", "cancelled"].includes(status)) {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-600";
}

function getEstimatedPayoutLabel(payout, payoutsLive) {
  if (["processed", "success"].includes(payout.status)) {
    return payout.processed_at ? `Completed ${formatDateTime(payout.processed_at)}` : "Completed";
  }

  if (["failed", "rejected", "reversed", "cancelled"].includes(payout.status)) {
    return "Needs review";
  }

  return payoutsLive ? "Waiting on provider" : "Under manual review";
}

function initialPayoutForm(account) {
  return {
    account_type: account?.account_type || "bank_account",
    contact_name: account?.contact_name || "",
    contact_email: account?.contact_email || "",
    contact_phone: account?.contact_phone || "",
    bank_account_holder_name: account?.bank_account_holder_name || "",
    bank_account_number: "",
    confirm_bank_account_number: "",
    bank_account_ifsc: account?.bank_account_ifsc || "",
    vpa_address: "",
  };
}

export default function Wallet() {
  const toast = useToast();
  const [balance, setBalance] = useState("0.00");
  const [transactions, setTransactions] = useState([]);
  const [topupConfig, setTopupConfig] = useState(null);
  const [payoutConfig, setPayoutConfig] = useState(null);
  const [payoutAccount, setPayoutAccount] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [topupAmount, setTopupAmount] = useState("500");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMode, setWithdrawMode] = useState("IMPS");
  const [payoutForm, setPayoutForm] = useState(initialPayoutForm());
  const [workingAction, setWorkingAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("topup");

  const payoutsLive = Boolean(payoutConfig?.payout_enabled);
  const payoutModes = payoutForm.account_type === "vpa" ? ["UPI"] : ["IMPS", "NEFT", "RTGS"];

  const sortedTransactions = useMemo(
    () => [...transactions].sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at)),
    [transactions]
  );

  const sortedPayouts = useMemo(
    () => [...payouts].sort((left, right) => toTimestamp(right.requested_at) - toTimestamp(left.requested_at)),
    [payouts]
  );

  const totals = useMemo(() => {
    return sortedTransactions.reduce(
      (acc, transaction) => {
        const amount = Number(transaction.amount || 0);
        if (transaction.type === "credit") {
          acc.credit += amount;
        } else {
          acc.debit += amount;
        }
        return acc;
      },
      { credit: 0, debit: 0 }
    );
  }, [sortedTransactions]);

  const pendingPayoutCount = useMemo(
    () => sortedPayouts.filter((payout) => ["pending", "queued", "processing"].includes(payout.status)).length,
    [sortedPayouts]
  );

  const bankNumbersMatch =
    payoutForm.account_type !== "bank_account" ||
    !payoutForm.bank_account_number ||
    payoutForm.bank_account_number === payoutForm.confirm_bank_account_number;
  const destinationSaved = payoutAccount?.masked_destination || "No payout destination saved yet.";
  const withdrawExceedsBalance = Number(withdrawAmount || 0) > Number(balance || 0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashboardResponse, transactionsResponse] = await Promise.all([API.get("dashboard/"), API.get("transactions/")]);
      const dashboard = dashboardResponse.data || {};

      setBalance(dashboard.balance || "0.00");
      setTransactions(Array.isArray(transactionsResponse.data) ? transactionsResponse.data : []);
      setTopupConfig(dashboard.wallet_payments || null);
      setPayoutConfig(dashboard.wallet_payouts_config || null);
      setPayoutAccount(dashboard.wallet_payout_account || null);
      setPayouts(Array.isArray(dashboard.wallet_payouts) ? dashboard.wallet_payouts : []);
      setPayoutForm(initialPayoutForm(dashboard.wallet_payout_account || null));
      if ((dashboard.wallet_payout_account || {}).account_type === "vpa") {
        setWithdrawMode("UPI");
      }
    } catch (err) {
      console.error(err);
      toast.error("Unable to load your wallet right now.", { title: "Wallet unavailable" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function startWalletTopup(event) {
    event.preventDefault();

    try {
      setWorkingAction("topup");
      const orderResponse = await API.post("payments/razorpay/create-order/", {
        amount: topupAmount,
      });
      setTopupConfig(orderResponse.data.payment || topupConfig);
      const Razorpay = await loadRazorpayCheckout();

      await new Promise((resolve, reject) => {
        const paymentObject = new Razorpay({
          ...orderResponse.data.checkout,
          theme: { color: "#0f766e" },
          modal: {
            ondismiss: () => reject(new Error("Payment window closed. No money was added.")),
          },
          handler: async (paymentResponse) => {
            try {
              const verifyResponse = await API.post("payments/razorpay/verify/", paymentResponse);
              toast.success(verifyResponse.data.message || "Wallet top-up credited successfully.", {
                title: "Money added",
              });
              setTopupAmount("");
              await fetchData();
              resolve();
            } catch (verifyError) {
              reject(new Error(parseError(verifyError, "Payment verification failed.")));
            }
          },
        });

        paymentObject.on("payment.failed", (response) => {
          reject(new Error(response?.error?.description || "Payment failed before the wallet could be credited."));
        });
        paymentObject.open();
      });
    } catch (err) {
      toast.error(parseError(err, err.message || "Unable to start wallet top-up."), {
        title: "Top-up failed",
      });
    } finally {
      setWorkingAction("");
    }
  }

  async function savePayoutAccount(event) {
    event.preventDefault();

    try {
      setWorkingAction("save-payout");
      const response = await API.put("wallet/payout-account/", payoutForm);
      toast.success(response.data.message || "Payout method saved successfully.", {
        title: "Destination saved",
      });
      await fetchData();
    } catch (err) {
      toast.error(parseError(err, "Unable to save your payout method."), {
        title: "Couldn't save destination",
      });
    } finally {
      setWorkingAction("");
    }
  }

  async function withdrawMoney(event) {
    event.preventDefault();

    try {
      setWorkingAction("withdraw");
      const response = await API.post("withdraw-money/", {
        amount: withdrawAmount,
        payout_mode: withdrawMode,
      });
      toast.success(
        payoutsLive
          ? response.data.message || "Withdrawal request created."
          : response.data.message || "Withdrawal request submitted. Money will be transferred within 24 hours after review.",
        { title: payoutsLive ? "Withdrawal created" : "Withdrawal requested" }
      );
      setWithdrawAmount("");
      await fetchData();
    } catch (err) {
      toast.error(parseError(err, "Failed to create withdrawal request."), {
        title: "Couldn't request withdrawal",
      });
    } finally {
      setWorkingAction("");
    }
  }

  async function syncPayout(payoutId) {
    try {
      setWorkingAction(`sync-${payoutId}`);
      const response = await API.post(`wallet/payouts/${payoutId}/sync/`);
      toast.info(response.data.message || "Payout status refreshed.", {
        title: "Status refreshed",
      });
      await fetchData();
    } catch (err) {
      toast.error(parseError(err, "Unable to refresh payout status."), {
        title: "Refresh failed",
      });
    } finally {
      setWorkingAction("");
    }
  }

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-5xl space-y-4">
          <SkeletonCard>
            <SkeletonTextGroup titleWidth="w-72" />
          </SkeletonCard>
          <SkeletonCard className="h-48" />
          <SkeletonList count={3} itemClassName="h-28 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="sv-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Wallet</p>
              <h1 className="mt-3 text-2xl font-bold text-slate-900">Keep money ready for joins and withdrawals.</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Top up with Razorpay, save your payout destination, and track balance movement in one place.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Available balance</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <WalletGlyph className="h-5 w-5" />
                </span>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(balance)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SimpleStat label="Credits" value={formatCurrency(totals.credit)} note="top-ups and refunds" />
            <SimpleStat label="Debits" value={formatCurrency(totals.debit)} note="joins and payouts" />
            <SimpleStat
              label="Pending payouts"
              value={`${pendingPayoutCount}`}
              note={payoutsLive ? "provider updates pending" : "under manual review"}
            />
          </div>
        </section>

        <section className="sv-card space-y-4">
          <div className="flex flex-wrap gap-2">
            {ACTION_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "topup" ? (
            <TopUpPanel
              topupAmount={topupAmount}
              setTopupAmount={setTopupAmount}
              topupConfig={topupConfig}
              workingAction={workingAction}
              onSubmit={startWalletTopup}
            />
          ) : null}

          {activeTab === "withdraw" ? (
            <WithdrawPanel
              payoutForm={payoutForm}
              payoutAccount={payoutAccount}
              payoutModes={payoutModes}
              withdrawMode={withdrawMode}
              setWithdrawMode={setWithdrawMode}
              setPayoutForm={setPayoutForm}
              workingAction={workingAction}
              bankNumbersMatch={bankNumbersMatch}
              payoutsLive={payoutsLive}
              destinationSaved={destinationSaved}
              withdrawAmount={withdrawAmount}
              setWithdrawAmount={setWithdrawAmount}
              withdrawExceedsBalance={withdrawExceedsBalance}
              onSaveDestination={savePayoutAccount}
              onWithdraw={withdrawMoney}
              sortedPayouts={sortedPayouts}
              onSyncPayout={syncPayout}
              statusTone={statusTone}
              formatDateTime={formatDateTime}
              getEstimatedPayoutLabel={getEstimatedPayoutLabel}
            />
          ) : null}

          {activeTab === "history" ? (
            <HistoryPanel transactions={sortedTransactions} statusTone={statusTone} formatDateTime={formatDateTime} />
          ) : null}
        </section>
      </div>
    </div>
  );
}
