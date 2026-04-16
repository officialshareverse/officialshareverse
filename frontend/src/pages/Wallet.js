import { useEffect, useMemo, useState } from "react";

import API from "../api/axios";
import {
  BankIcon,
  ClockIcon,
  CreditIcon,
  DebitIcon,
  LoadingSpinner,
  ShieldIcon,
  WalletIcon as WalletGlyph,
} from "../components/UiIcons";
import useRevealOnScroll from "../hooks/useRevealOnScroll";

const RAZORPAY_CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const SUPPORT_EMAIL = "support.shareverse@gmail.com";
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
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

function parseError(err, fallback) {
  return err?.response?.data?.error || fallback;
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

function statusTone(status) {
  if (["processed", "success"].includes(status)) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (["pending", "queued", "processing"].includes(status)) {
    return "bg-amber-100 text-amber-800";
  }
  if (["failed", "rejected", "reversed", "cancelled"].includes(status)) {
    return "bg-rose-100 text-rose-800";
  }
  return "bg-slate-100 text-slate-700";
}

export default function Wallet() {
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
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const payoutsLive = Boolean(payoutConfig?.payout_enabled);

  useRevealOnScroll();

  useEffect(() => {
    fetchData();
  }, []);

  const payoutModes = useMemo(
    () => (payoutForm.account_type === "vpa" ? ["UPI"] : ["IMPS", "NEFT", "RTGS"]),
    [payoutForm.account_type]
  );

  async function fetchData() {
    try {
      setLoading(true);
      const [dashboardResponse, transactionsResponse] = await Promise.all([
        API.get("dashboard/"),
        API.get("transactions/"),
      ]);

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
      setErrorMessage("Unable to load your wallet right now.");
    } finally {
      setLoading(false);
    }
  }

  async function startWalletTopup(event) {
    event.preventDefault();
    setFeedbackMessage("");
    setErrorMessage("");

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
              setFeedbackMessage(verifyResponse.data.message || "Wallet top-up credited successfully.");
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
      setErrorMessage(parseError(err, err.message || "Unable to start wallet top-up."));
    } finally {
      setWorkingAction("");
    }
  }

  async function savePayoutAccount(event) {
    event.preventDefault();
    setFeedbackMessage("");
    setErrorMessage("");

    try {
      setWorkingAction("save-payout");
      const response = await API.put("wallet/payout-account/", payoutForm);
      setFeedbackMessage(response.data.message || "Payout method saved successfully.");
      await fetchData();
    } catch (err) {
      setErrorMessage(parseError(err, "Unable to save your payout method."));
    } finally {
      setWorkingAction("");
    }
  }

  async function withdrawMoney(event) {
    event.preventDefault();
    setFeedbackMessage("");
    setErrorMessage("");

    try {
      setWorkingAction("withdraw");
      const response = await API.post("withdraw-money/", {
        amount: withdrawAmount,
        payout_mode: withdrawMode,
      });
      setFeedbackMessage(
        payoutsLive
          ? response.data.message || "Withdrawal request created."
          : response.data.message || "Withdrawal request submitted. Money will be transferred within 24 hours after review."
      );
      setWithdrawAmount("");
      await fetchData();
    } catch (err) {
      setErrorMessage(parseError(err, "Failed to create withdrawal request."));
    } finally {
      setWorkingAction("");
    }
  }

  async function syncPayout(payoutId) {
    setFeedbackMessage("");
    setErrorMessage("");

    try {
      setWorkingAction(`sync-${payoutId}`);
      const response = await API.post(`wallet/payouts/${payoutId}/sync/`);
      setFeedbackMessage(response.data.message || "Payout status refreshed.");
      await fetchData();
    } catch (err) {
      setErrorMessage(parseError(err, "Unable to refresh payout status."));
    } finally {
      setWorkingAction("");
    }
  }

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="sv-skeleton-card space-y-4">
              <div className="sv-skeleton h-4 w-20" />
              <div className="sv-skeleton h-14 w-4/5 rounded-[22px]" />
              <div className="sv-skeleton h-4 w-full" />
              <div className="sv-skeleton h-4 w-4/5" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="sv-skeleton h-9 w-20 rounded-full" />
                ))}
              </div>
            </div>
            <div className="sv-skeleton-card space-y-4">
              <div className="sv-skeleton h-4 w-28" />
              <div className="sv-skeleton h-12 w-40 rounded-[20px]" />
              <div className="sv-skeleton h-4 w-3/4" />
            </div>
          </section>
          <section className="grid gap-6 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="sv-skeleton-card space-y-4">
                <div className="sv-skeleton h-4 w-24" />
                <div className="sv-skeleton h-10 w-2/3 rounded-[18px]" />
                <div className="sv-skeleton h-12 w-full rounded-[18px]" />
                <div className="sv-skeleton h-12 w-full rounded-[18px]" />
                <div className="sv-skeleton h-12 w-full rounded-full" />
              </div>
            ))}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="sv-light-hero sv-reveal">
            <p className="sv-eyebrow">Wallet</p>
            <h1 className="sv-display mt-4 max-w-3xl">
              Top up your wallet and keep shared-cost activity moving.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
              Razorpay handles live wallet top-ups today. You can also submit withdrawal requests
              from this page now, and we will review and settle them manually within 24 hours
              until the automated payout rail is fully activated.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["100", "300", "500", "1000"].map((amount) => (
                <button key={amount} type="button" className="sv-chip normal-case" onClick={() => setTopupAmount(amount)}>
                  Rs {amount}
                </button>
              ))}
            </div>
          </div>

          <aside className="sv-card sv-reveal bg-[linear-gradient(135deg,#0f172a_0%,#132033_60%,#0f766e_100%)] text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Available balance</p>
            <div className="mt-4 flex items-center gap-4">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/10 text-white shadow-[0_18px_42px_rgba(15,23,42,0.2)]">
                <WalletGlyph className="h-7 w-7" />
              </span>
              <h2 className="sv-count-up text-4xl font-bold">
                <AnimatedValue value={formatCurrency(balance)} />
              </h2>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Used for joins, shared-cost group activity, and buy-together flows inside ShareVerse.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {topupConfig ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">{topupConfig.mode_label}</span> : null}
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${payoutsLive ? "bg-white/10 text-white" : "bg-amber-400/15 text-amber-100 sv-status-pulse"}`}>
                {payoutConfig?.mode_label || (payoutsLive ? "Payouts live" : "Manual withdrawal review")}
              </span>
            </div>
          </aside>
        </section>

        {topupConfig ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{topupConfig.helper_text}</div> : null}
        {payoutsLive ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{payoutConfig.helper_text}</div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Automated payouts are still pending provider activation, but you can now save a
            withdrawal destination and submit a request here for manual review. We will reach out
            on {SUPPORT_EMAIL} if we need anything before settling it. Approved requests are
            typically transferred within 24 hours.
          </div>
        )}
        {feedbackMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{feedbackMessage}</div> : null}
        {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{errorMessage}</div> : null}

        <section className="grid gap-6 xl:grid-cols-3">
          <form className="sv-card sv-reveal space-y-4" onSubmit={startWalletTopup}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="sv-eyebrow">Top Up</p>
                <h2 className="sv-title mt-2">Add money with Razorpay</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">UPI, cards, netbanking</span>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Amount
              <input className="sv-input" type="number" min="1" step="0.01" value={topupAmount} onChange={(event) => setTopupAmount(event.target.value)} />
            </label>
            <p className="text-sm leading-7 text-slate-600">Your wallet is credited only after the payment is verified successfully.</p>
            <button className="sv-btn-primary w-full justify-center" type="submit" disabled={workingAction !== "" || !topupConfig?.topup_enabled}>
              {workingAction === "topup" ? <><LoadingSpinner />Opening checkout...</> : <><CreditIcon className="h-4 w-4" />Add money securely</>}
            </button>
          </form>

          <>
            <form className="sv-card sv-reveal space-y-4" onSubmit={savePayoutAccount}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="sv-eyebrow">Payout Method</p>
                  <h2 className="sv-title mt-2">
                    {payoutsLive ? "Save where withdrawals should go" : "Save your withdrawal destination"}
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Bank or UPI</span>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Destination type
                <select className="sv-input" value={payoutForm.account_type} onChange={(event) => {
                  const accountType = event.target.value;
                  setPayoutForm((current) => ({ ...current, account_type: accountType, bank_account_number: "", confirm_bank_account_number: "", vpa_address: "" }));
                  setWithdrawMode(accountType === "vpa" ? "UPI" : "IMPS");
                }}>
                  <option value="bank_account">Bank account</option>
                  <option value="vpa">UPI ID</option>
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Contact name
                  <input className="sv-input" value={payoutForm.contact_name} onChange={(event) => setPayoutForm((current) => ({ ...current, contact_name: event.target.value }))} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Contact phone
                  <input className="sv-input" value={payoutForm.contact_phone} onChange={(event) => setPayoutForm((current) => ({ ...current, contact_phone: event.target.value }))} />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Contact email
                <input className="sv-input" type="email" value={payoutForm.contact_email} onChange={(event) => setPayoutForm((current) => ({ ...current, contact_email: event.target.value }))} />
              </label>

              {payoutForm.account_type === "bank_account" ? (
                <>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Account holder name
                    <input className="sv-input" value={payoutForm.bank_account_holder_name} onChange={(event) => setPayoutForm((current) => ({ ...current, bank_account_holder_name: event.target.value }))} />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold text-slate-700">
                      Account number
                      <input className="sv-input" type="password" value={payoutForm.bank_account_number} onChange={(event) => setPayoutForm((current) => ({ ...current, bank_account_number: event.target.value }))} placeholder={payoutAccount?.bank_account_last4 ? "Re-enter to update" : "Account number"} />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-slate-700">
                      Confirm account number
                      <input className="sv-input" type="password" value={payoutForm.confirm_bank_account_number} onChange={(event) => setPayoutForm((current) => ({ ...current, confirm_bank_account_number: event.target.value }))} />
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    IFSC
                    <input className="sv-input" value={payoutForm.bank_account_ifsc} onChange={(event) => setPayoutForm((current) => ({ ...current, bank_account_ifsc: event.target.value.toUpperCase() }))} />
                  </label>
                </>
              ) : (
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  UPI ID
                  <input className="sv-input" value={payoutForm.vpa_address} onChange={(event) => setPayoutForm((current) => ({ ...current, vpa_address: event.target.value }))} placeholder={payoutAccount?.account_type === "vpa" ? "Re-enter to update" : "name@bank"} />
                </label>
              )}

              <p className="text-sm leading-7 text-slate-600">
                {payoutAccount
                  ? `Saved destination: ${payoutAccount.masked_destination || "Ready to use"}`
                  : payoutsLive
                    ? "Save this once so future withdrawals can go through the real payout rail."
                    : "Save this once so manual withdrawal reviews know exactly where your money should go."}
              </p>
              <button className="sv-btn-secondary w-full justify-center" type="submit" disabled={workingAction !== ""}>
                {workingAction === "save-payout"
                  ? <><LoadingSpinner />Saving payout method...</>
                  : payoutsLive
                    ? <><BankIcon className="h-4 w-4" />Save payout method</>
                    : <><BankIcon className="h-4 w-4" />Save withdrawal destination</>}
              </button>
            </form>

            <form className="sv-card sv-reveal space-y-4" onSubmit={withdrawMoney}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="sv-eyebrow">Withdraw</p>
                  <h2 className="sv-title mt-2">
                    {payoutsLive ? "Send money to your payout method" : "Request a manual withdrawal"}
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {payoutAccount ? payoutAccount.masked_destination : "Payout method required"}
                </span>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Amount
                <input className="sv-input" type="number" min="1" step="0.01" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Transfer mode
                <select className="sv-input" value={payoutAccount?.account_type === "vpa" ? "UPI" : withdrawMode} onChange={(event) => setWithdrawMode(event.target.value)} disabled={payoutAccount?.account_type === "vpa"}>
                  {payoutModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                </select>
              </label>

              <p className="text-sm leading-7 text-slate-600">
                {payoutsLive
                  ? "Real withdrawals reserve wallet balance immediately. Failed or reversed payouts are returned automatically."
                  : "Manual withdrawal requests do not deduct wallet balance yet. We review the request first, send the money manually within 24 hours, and only then record the deduction."}
              </p>
              <button className="sv-btn-primary w-full justify-center" type="submit" disabled={!payoutAccount || workingAction !== ""}>
                {workingAction === "withdraw"
                  ? payoutsLive
                    ? <><LoadingSpinner />Creating payout...</>
                    : <><LoadingSpinner />Submitting request...</>
                  : payoutsLive
                    ? <><DebitIcon className="h-4 w-4" />Withdraw to payout method</>
                    : <><ClockIcon className="h-4 w-4" />Request manual withdrawal</>}
              </button>
            </form>
          </>
        </section>

        <section className="sv-card sv-reveal">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="sv-eyebrow">Payout Requests</p>
              <h2 className="sv-title mt-2">{payoutsLive ? "Recent withdrawals" : "Recent withdrawal requests"}</h2>
            </div>
            <span className="text-sm text-slate-500">{payouts.length} request(s)</span>
          </div>
          <div className="mt-5 space-y-4">
            {payouts.length === 0 ? (
              <div className="sv-empty-state">
                <div className="sv-empty-icon">
                  <ClockIcon className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {payoutsLive ? "No payout requests yet." : "No manual withdrawal requests yet."}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Your recent withdrawal requests and their review status will appear here.
                </p>
              </div>
            ) : payouts.map((payout) => {
              const canSync = Boolean(payout.provider_payout_id) && ["pending", "queued", "processing"].includes(payout.status);
              return (
                <div key={payout.id} className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white/80 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        {payout.mode === "UPI" ? <WalletGlyph className="h-4.5 w-4.5" /> : <BankIcon className="h-4.5 w-4.5" />}
                      </span>
                      <p className="text-base font-semibold text-slate-950">{payout.destination_label}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(payout.status)} ${["pending", "queued", "processing"].includes(payout.status) ? "sv-status-pulse" : ""}`}>{payout.status}</span>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{payout.failure_reason || `Mode: ${payout.mode}${payout.utr ? ` | UTR: ${payout.utr}` : ""}`}</p>
                    <p className="text-xs text-slate-500">Requested on {new Date(payout.requested_at).toLocaleString()}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-lg font-semibold text-rose-700">- {formatCurrency(payout.amount)}</p>
                    {canSync ? (
                      <button type="button" className="sv-btn-secondary mt-3" onClick={() => syncPayout(payout.id)} disabled={workingAction !== "" && workingAction !== `sync-${payout.id}`}>
                        {workingAction === `sync-${payout.id}` ? "Refreshing..." : "Refresh status"}
                      </button>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        {payout.processed_at
                          ? new Date(payout.processed_at).toLocaleString()
                          : payout.status === "pending"
                            ? "Under manual review, usually within 24 hours"
                            : "Status settled"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="sv-card sv-reveal">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="sv-eyebrow">History</p>
              <h2 className="sv-title mt-2">Transaction activity</h2>
            </div>
            <span className="text-sm text-slate-500">{transactions.length} record(s)</span>
          </div>
          <div className="mt-5 space-y-4">
            {transactions.length === 0 ? (
              <div className="sv-empty-state">
                <div className="sv-empty-icon">
                  <ShieldIcon className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-900">No transactions yet.</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Top-ups, joins, payouts, and refunds will all appear here with their status.
                </p>
              </div>
            ) : transactions.map((transaction) => (
              <div key={transaction.id} className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white/80 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${transaction.type === "credit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {transaction.type === "credit" ? <CreditIcon className="h-4.5 w-4.5" /> : <DebitIcon className="h-4.5 w-4.5" />}
                    </span>
                    <p className="text-base font-semibold text-slate-950">{transaction.title}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${transaction.type === "credit" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{transaction.type}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(transaction.status)} ${["pending", "queued", "processing"].includes(transaction.status) ? "sv-status-pulse" : ""}`}>{transaction.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{transaction.description}</p>
                  <p className="text-xs text-slate-500">{transaction.mode_label}{transaction.group_name ? ` | ${transaction.group_name}` : ""}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className={`text-lg font-semibold ${transaction.type === "credit" ? "text-emerald-700" : "text-rose-700"}`}>
                    {transaction.type === "credit" ? "+" : "-"} {formatCurrency(transaction.amount)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{new Date(transaction.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AnimatedValue({ value }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const raw = String(value);
    const numericMatch = raw.match(/-?\d+(\.\d+)?/);
    if (!numericMatch) {
      setDisplayValue(raw);
      return undefined;
    }

    const target = Number(numericMatch[0]);
    const prefix = raw.slice(0, numericMatch.index);
    const suffix = raw.slice((numericMatch.index || 0) + numericMatch[0].length);
    const duration = 700;
    const startedAt = performance.now();
    let frameId = 0;

    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const current = (target * progress).toFixed(2);
      setDisplayValue(`${prefix}${current}${suffix}`);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [value]);

  return displayValue;
}
