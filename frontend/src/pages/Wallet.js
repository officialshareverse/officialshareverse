import { useEffect, useMemo, useRef, useState } from "react";

import API from "../api/axios";
import Drawer from "../components/Drawer";
import { useToast } from "../components/ToastProvider";
import {
  BankIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditIcon,
  DebitIcon,
  LoadingSpinner,
  SearchIcon,
  ShieldIcon,
  WalletIcon as WalletGlyph,
} from "../components/UiIcons";
import useRevealOnScroll from "../hooks/useRevealOnScroll";

const RAZORPAY_CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const QUICK_AMOUNTS = ["100", "300", "500", "1000"];
const ACTION_TABS = [
  { id: "topup", label: "Top Up" },
  { id: "payout", label: "Payout Setup" },
  { id: "withdraw", label: "Withdraw" },
];
const ACTION_TAB_META = {
  topup: {
    summary: "Add money with Razorpay in a few taps.",
    drawerDescription: "Use UPI, cards, or netbanking, then come back with balance ready to join groups.",
    icon: CreditIcon,
  },
  payout: {
    summary: "Save your bank account or UPI destination.",
    drawerDescription: "Keep one payout destination ready so withdrawals do not need setup every time.",
    icon: BankIcon,
  },
  withdraw: {
    summary: "Move wallet money back out when you need it.",
    drawerDescription: "Request a withdrawal to your saved destination with the same wallet balance and status controls.",
    icon: DebitIcon,
  },
};
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

function formatShortCurrency(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 100000) {
    return `Rs ${(amount / 100000).toFixed(1)}L`;
  }
  if (Math.abs(amount) >= 1000) {
    return `Rs ${(amount / 1000).toFixed(1)}k`;
  }
  return formatCurrency(amount);
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

function toTimestamp(value) {
  return new Date(value || 0).getTime();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeWalletTime(value) {
  if (!value) {
    return "Just now";
  }
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Just now";
  }
  const deltaMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }
  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 7) {
    return `${deltaDays}d ago`;
  }
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function bucketTransactions(items) {
  const now = new Date();
  const today = startOfDay(now).getTime();
  const yesterday = today - 86400000;
  const weekStart = today - 6 * 86400000;

  const buckets = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "Older", items: [] },
  ];

  items.forEach((transaction) => {
    const createdAt = startOfDay(new Date(transaction.created_at)).getTime();
    if (createdAt >= today) {
      buckets[0].items.push(transaction);
    } else if (createdAt >= yesterday) {
      buckets[1].items.push(transaction);
    } else if (createdAt >= weekStart) {
      buckets[2].items.push(transaction);
    } else {
      buckets[3].items.push(transaction);
    }
  });

  return buckets.filter((bucket) => bucket.items.length > 0);
}

function buildTrendPoints(transactions) {
  const today = startOfDay(new Date());
  const points = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    return {
      key: day.toISOString(),
      label: day.toLocaleDateString("en-IN", { weekday: "short" }),
      credit: 0,
      debit: 0,
    };
  });

  const pointMap = new Map(points.map((point) => [startOfDay(new Date(point.key)).getTime(), point]));

  transactions.forEach((transaction) => {
    const dayKey = startOfDay(new Date(transaction.created_at)).getTime();
    const point = pointMap.get(dayKey);
    if (!point) {
      return;
    }

    if (transaction.type === "credit") {
      point.credit += Number(transaction.amount || 0);
    } else {
      point.debit += Number(transaction.amount || 0);
    }
  });

  return points;
}

function getWalletDelta(transactions) {
  const today = startOfDay(new Date()).getTime();
  const weekStart = today - 6 * 86400000;

  const summarize = (items) =>
    items.reduce(
      (acc, transaction) => {
        const amount = Number(transaction.amount || 0);
        if (transaction.type === "credit") {
          acc.credit += amount;
          acc.net += amount;
        } else {
          acc.debit += amount;
          acc.net -= amount;
        }
        return acc;
      },
      { credit: 0, debit: 0, net: 0 }
    );

  const todayItems = transactions.filter((transaction) => startOfDay(new Date(transaction.created_at)).getTime() === today);
  const weeklyItems = transactions.filter((transaction) => startOfDay(new Date(transaction.created_at)).getTime() >= weekStart);

  if (todayItems.length > 0) {
    const summary = summarize(todayItems);
    return {
      label: `${summary.net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(summary.net))} today`,
      tone: summary.net >= 0 ? "is-up" : "is-down",
    };
  }

  const weekSummary = summarize(weeklyItems);
  return {
    label: `${weekSummary.net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(weekSummary.net))} this week`,
    tone: weekSummary.net >= 0 ? "is-up" : "is-down",
  };
}

function getPayoutTimeline(status, payoutsLive) {
  const reviewLabel = payoutsLive ? "Processing" : "Manual review";

  if (["processed", "success"].includes(status)) {
    return [
      { label: "Requested", state: "done" },
      { label: reviewLabel, state: "done" },
      { label: "Completed", state: "done" },
    ];
  }

  if (["failed", "rejected", "reversed", "cancelled"].includes(status)) {
    return [
      { label: "Requested", state: "done" },
      { label: reviewLabel, state: "done" },
      { label: "Issue", state: "active" },
    ];
  }

  return [
    { label: "Requested", state: "done" },
    { label: reviewLabel, state: "active" },
    { label: "Completed", state: "pending" },
  ];
}

function getEstimatedPayoutLabel(payout, payoutsLive) {
  if (payout.processed_at) {
    return `Completed ${formatDateTime(payout.processed_at)}`;
  }
  if (["failed", "rejected", "reversed", "cancelled"].includes(payout.status)) {
    return "Needs attention before funds can move";
  }
  return payoutsLive ? "Usually updates shortly after provider processing" : "Usually reviewed within 24 hours";
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("topup");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const [isMobileActionDrawerOpen, setIsMobileActionDrawerOpen] = useState(false);
  const [isMobileHistoryDrawerOpen, setIsMobileHistoryDrawerOpen] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionFilter, setTransactionFilter] = useState("all");
  const payoutsLive = Boolean(payoutConfig?.payout_enabled);
  const toast = useToast();
  const fetchDataRef = useRef(null);

  useRevealOnScroll();

  useEffect(() => {
    fetchDataRef.current?.();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (event) => setIsMobile(event.matches);
    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileActionDrawerOpen(false);
      setIsMobileHistoryDrawerOpen(false);
    }
  }, [isMobile]);

  const payoutModes = useMemo(
    () => (payoutForm.account_type === "vpa" ? ["UPI"] : ["IMPS", "NEFT", "RTGS"]),
    [payoutForm.account_type]
  );

  const sortedTransactions = useMemo(
    () => [...transactions].sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at)),
    [transactions]
  );

  const transactionSummary = useMemo(() => {
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

  const walletDelta = useMemo(() => getWalletDelta(sortedTransactions), [sortedTransactions]);
  const trendPoints = useMemo(() => buildTrendPoints(sortedTransactions), [sortedTransactions]);
  const trendMax = useMemo(
    () => Math.max(1, ...trendPoints.map((point) => Math.max(point.credit, point.debit))),
    [trendPoints]
  );

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = transactionSearch.trim().toLowerCase();

    return sortedTransactions.filter((transaction) => {
      const matchesFilter = transactionFilter === "all" ? true : transaction.type === transactionFilter;
      if (!matchesFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        transaction.title,
        transaction.description,
        transaction.group_name,
        transaction.mode_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [sortedTransactions, transactionSearch, transactionFilter]);

  const groupedTransactions = useMemo(
    () => bucketTransactions(filteredTransactions),
    [filteredTransactions]
  );

  const activeTransactionFilterLabel =
    transactionFilter === "all" ? "All" : transactionFilter === "credit" ? "Credits" : "Debits";

  const sortedPayouts = useMemo(
    () => [...payouts].sort((left, right) => toTimestamp(right.requested_at) - toTimestamp(left.requested_at)),
    [payouts]
  );

  const pendingPayoutCount = useMemo(
    () => sortedPayouts.filter((payout) => ["pending", "queued", "processing"].includes(payout.status)).length,
    [sortedPayouts]
  );

  const payoutFormState = useMemo(() => {
    const contactReady =
      Boolean(payoutForm.contact_name.trim()) &&
      Boolean(payoutForm.contact_email.trim()) &&
      Boolean(payoutForm.contact_phone.trim());

    const bankNumbersMatch =
      payoutForm.account_type !== "bank_account" ||
      !payoutForm.bank_account_number ||
      payoutForm.bank_account_number === payoutForm.confirm_bank_account_number;

    const bankDestinationReady =
      Boolean(payoutForm.bank_account_holder_name.trim()) &&
      Boolean(payoutForm.bank_account_ifsc.trim()) &&
      (Boolean(payoutForm.bank_account_number.trim()) || payoutAccount?.account_type === "bank_account") &&
      bankNumbersMatch;

    const upiDestinationReady =
      payoutForm.account_type === "vpa" &&
      (Boolean(payoutForm.vpa_address.trim()) || payoutAccount?.account_type === "vpa");

    const destinationReady =
      payoutForm.account_type === "bank_account" ? bankDestinationReady : upiDestinationReady;

    return {
      contactReady,
      destinationReady,
      bankNumbersMatch,
      steps: [
        { label: "Contact", ready: contactReady },
        { label: payoutForm.account_type === "bank_account" ? "Bank details" : "UPI details", ready: destinationReady },
        { label: "Ready to save", ready: contactReady && destinationReady && bankNumbersMatch },
      ],
    };
  }, [payoutAccount, payoutForm]);

  const withdrawExceedsBalance = Number(withdrawAmount || 0) > Number(balance || 0);

  const focusActionTab = (tabId) => {
    setActiveTab(tabId);
    if (isMobile) {
      setIsMobileActionDrawerOpen(true);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById("wallet-actions")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const renderActionTabs = (className = "") => (
    <div className={`sv-wallet-tab-row ${className}`.trim()}>
      {ACTION_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          className={`sv-wallet-tab ${activeTab === tab.id ? "is-active" : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const activeActionPanel =
    activeTab === "topup" ? (
      <div className="sv-wallet-action-panel mt-5">
        <div className="sv-wallet-action-copy">
          <p className="sv-eyebrow">Top Up</p>
          <h3 className="sv-title mt-2">Add money with Razorpay and credit the wallet after verification</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Use UPI, cards, or netbanking. The wallet updates only after the payment is verified successfully.
          </p>

          <div className="sv-wallet-inline-grid sv-wallet-mobile-secondary mt-4">
            <WalletOverviewStat label="Current amount" value={`Rs ${topupAmount || "0"}`} note="ready for checkout" />
            <WalletOverviewStat label="Gateway" value={topupConfig?.mode_label || "Razorpay"} note="secure payment rail" />
          </div>
        </div>

        <form className="sv-wallet-form-panel" onSubmit={startWalletTopup}>
          <div className="sv-wallet-quick-amounts">
            {QUICK_AMOUNTS.map((amount, index) => (
              <button
                key={amount}
                type="button"
                onClick={() => setTopupAmount(amount)}
                className={`sv-wallet-amount-chip ${topupAmount === amount ? "is-active" : ""} ${index === 2 ? "is-popular" : ""}`}
              >
                <span className="sv-wallet-amount-main">Rs {amount}</span>
                <span className="sv-wallet-amount-note">
                  {index === 2 ? "Popular" : index === 0 ? "Starter" : index === 3 ? "Fast refill" : "Quick pick"}
                </span>
                {topupAmount === amount ? <CheckCircleIcon className="h-4 w-4" /> : null}
              </button>
            ))}
          </div>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Amount
            <input
              className="sv-input"
              type="number"
              min="1"
              step="0.01"
              value={topupAmount}
              onChange={(event) => setTopupAmount(event.target.value)}
            />
          </label>

          <button
            className="sv-btn-primary w-full justify-center"
            type="submit"
            disabled={workingAction !== "" || !topupConfig?.topup_enabled}
          >
            {workingAction === "topup" ? (
              <>
                <LoadingSpinner />
                Opening checkout...
              </>
            ) : (
              <>
                <CreditIcon className="h-4 w-4" />
                Add money securely
              </>
            )}
          </button>
        </form>
      </div>
    ) : activeTab === "payout" ? (
      <div className="sv-wallet-action-panel mt-5">
        <div className="sv-wallet-action-copy">
          <p className="sv-eyebrow">Payout Setup</p>
          <h3 className="sv-title mt-2">
            {payoutsLive ? "Save where live withdrawals should go" : "Save the destination for manual withdrawals"}
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Keep contact details and bank or UPI information in one place so future payouts can move smoothly.
          </p>

          <div className="sv-wallet-step-list sv-wallet-mobile-secondary mt-4">
            {payoutFormState.steps.map((step) => (
              <div key={step.label} className={`sv-wallet-step ${step.ready ? "is-complete" : ""}`}>
                <span className="sv-wallet-step-dot" />
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          <div className="sv-wallet-helper-card sv-wallet-mobile-secondary mt-4">
            <p className="sv-wallet-helper-title">Saved destination</p>
            <p className="sv-wallet-helper-body">
              {payoutAccount
                ? payoutAccount.masked_destination || "Ready to use"
                : payoutsLive
                  ? "No payout method saved yet."
                  : "No withdrawal destination saved yet."}
            </p>
          </div>
        </div>

        <form className="sv-wallet-form-panel" onSubmit={savePayoutAccount}>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Destination type
            <select
              className="sv-input"
              value={payoutForm.account_type}
              onChange={(event) => {
                const accountType = event.target.value;
                setPayoutForm((current) => ({
                  ...current,
                  account_type: accountType,
                  bank_account_number: "",
                  confirm_bank_account_number: "",
                  vpa_address: "",
                }));
                setWithdrawMode(accountType === "vpa" ? "UPI" : "IMPS");
              }}
            >
              <option value="bank_account">Bank account</option>
              <option value="vpa">UPI ID</option>
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Contact name
              <input
                className="sv-input"
                value={payoutForm.contact_name}
                onChange={(event) => setPayoutForm((current) => ({ ...current, contact_name: event.target.value }))}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Contact phone
              <input
                className="sv-input"
                value={payoutForm.contact_phone}
                onChange={(event) => setPayoutForm((current) => ({ ...current, contact_phone: event.target.value }))}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Contact email
            <input
              className="sv-input"
              type="email"
              value={payoutForm.contact_email}
              onChange={(event) => setPayoutForm((current) => ({ ...current, contact_email: event.target.value }))}
            />
          </label>

          {payoutForm.account_type === "bank_account" ? (
            <>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Account holder name
                <input
                  className="sv-input"
                  value={payoutForm.bank_account_holder_name}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, bank_account_holder_name: event.target.value }))}
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Account number
                  <input
                    className="sv-input"
                    type="password"
                    value={payoutForm.bank_account_number}
                    onChange={(event) => setPayoutForm((current) => ({ ...current, bank_account_number: event.target.value }))}
                    placeholder={payoutAccount?.bank_account_last4 ? "Re-enter to update" : "Account number"}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Confirm account number
                  <input
                    className="sv-input"
                    type="password"
                    value={payoutForm.confirm_bank_account_number}
                    onChange={(event) =>
                      setPayoutForm((current) => ({ ...current, confirm_bank_account_number: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                IFSC
                <input
                  className="sv-input"
                  value={payoutForm.bank_account_ifsc}
                  onChange={(event) =>
                    setPayoutForm((current) => ({ ...current, bank_account_ifsc: event.target.value.toUpperCase() }))
                  }
                />
              </label>
            </>
          ) : (
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              UPI ID
              <input
                className="sv-input"
                value={payoutForm.vpa_address}
                onChange={(event) => setPayoutForm((current) => ({ ...current, vpa_address: event.target.value }))}
                placeholder={payoutAccount?.account_type === "vpa" ? "Re-enter to update" : "name@bank"}
              />
            </label>
          )}

          {!payoutFormState.bankNumbersMatch ? (
            <div className="sv-feedback-banner is-error">Account numbers do not match yet.</div>
          ) : null}

          <button
            className="sv-btn-secondary w-full justify-center"
            type="submit"
            disabled={workingAction !== "" || !payoutFormState.bankNumbersMatch}
          >
            {workingAction === "save-payout" ? (
              <>
                <LoadingSpinner />
                Saving payout method...
              </>
            ) : (
              <>
                <BankIcon className="h-4 w-4" />
                {payoutsLive ? "Save payout method" : "Save withdrawal destination"}
              </>
            )}
          </button>
        </form>
      </div>
    ) : (
      <div className="sv-wallet-action-panel mt-5">
        <div className="sv-wallet-action-copy">
          <p className="sv-eyebrow">Withdraw</p>
          <h3 className="sv-title mt-2">
            {payoutsLive ? "Send wallet money to your saved payout method" : "Request a manual wallet withdrawal"}
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {payoutsLive
              ? "Live payouts reserve balance immediately. Failed or reversed transfers are returned automatically."
              : "Manual withdrawal requests do not deduct the wallet immediately. They are reviewed first, then settled manually."}
          </p>

          <div className="sv-wallet-helper-card sv-wallet-mobile-secondary mt-4">
            <p className="sv-wallet-helper-title">Destination</p>
            <p className="sv-wallet-helper-body">
              {payoutAccount ? payoutAccount.masked_destination : "Save a payout method before requesting money out."}
            </p>
          </div>
        </div>

        <form className="sv-wallet-form-panel" onSubmit={withdrawMoney}>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Amount
            <input
              className="sv-input"
              type="number"
              min="1"
              step="0.01"
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Transfer mode
            <select
              className="sv-input"
              value={payoutAccount?.account_type === "vpa" ? "UPI" : withdrawMode}
              onChange={(event) => setWithdrawMode(event.target.value)}
              disabled={payoutAccount?.account_type === "vpa"}
            >
              {payoutModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>

          <div className="sv-wallet-inline-grid sv-wallet-mobile-secondary">
            <WalletOverviewStat label="Available" value={formatCurrency(balance)} note="wallet balance now" />
            <WalletOverviewStat
              label="ETA"
              value={payoutsLive ? "Fast" : "24h"}
              note={payoutsLive ? "provider processing time" : "manual review window"}
            />
          </div>

          {withdrawExceedsBalance ? (
            <div className="sv-feedback-banner is-error">The withdrawal amount is above your available balance.</div>
          ) : null}

          <button
            className="sv-btn-primary w-full justify-center"
            type="submit"
            disabled={!payoutAccount || workingAction !== "" || withdrawExceedsBalance}
          >
            {workingAction === "withdraw" ? (
              payoutsLive ? (
                <>
                  <LoadingSpinner />
                  Creating payout...
                </>
              ) : (
                <>
                  <LoadingSpinner />
                  Submitting request...
                </>
              )
            ) : payoutsLive ? (
              <>
                <DebitIcon className="h-4 w-4" />
                Withdraw to payout method
              </>
            ) : (
              <>
                <ClockIcon className="h-4 w-4" />
                Request manual withdrawal
              </>
            )}
          </button>
        </form>
      </div>
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
      toast.error("Unable to load your wallet right now.", { title: "Wallet unavailable" });
    } finally {
      setLoading(false);
    }
  }

  fetchDataRef.current = fetchData;

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
          : response.data.message ||
              "Withdrawal request submitted. Money will be transferred within 24 hours after review.",
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
        <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
          <section className="grid gap-4 sm:gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="sv-skeleton h-72 rounded-[32px]" />
            <div className="sv-skeleton h-72 rounded-[32px]" />
          </section>
          <section className="sv-skeleton h-[32rem] rounded-[32px]" />
          <section className="grid gap-4 xl:grid-cols-[0.94fr_1.06fr]">
            <div className="sv-skeleton h-[24rem] rounded-[32px]" />
            <div className="sv-skeleton h-[32rem] rounded-[32px]" />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      {isMobile ? (
        <Drawer
          open={isMobileActionDrawerOpen}
          onClose={() => setIsMobileActionDrawerOpen(false)}
          eyebrow="Wallet actions"
          title={ACTION_TABS.find((tab) => tab.id === activeTab)?.label}
          description={ACTION_TAB_META[activeTab]?.drawerDescription}
          className="sv-wallet-mobile-drawer"
          footer={(
            <p className="sv-drawer-footnote">
              <strong>Tip:</strong> choose the action you need, finish it here, then come back to the wallet summary.
            </p>
          )}
        >
          {renderActionTabs("sv-wallet-tab-row-drawer")}
          {activeActionPanel}
        </Drawer>
      ) : null}

      {isMobile ? (
        <Drawer
          open={isMobileHistoryDrawerOpen}
          onClose={() => setIsMobileHistoryDrawerOpen(false)}
          eyebrow="History filters"
          title="Find wallet activity"
          description="Search transactions or narrow the list before jumping back to the compact wallet feed."
          className="sv-wallet-history-mobile-drawer"
          footer={(
            <button
              type="button"
              onClick={() => setIsMobileHistoryDrawerOpen(false)}
              className="sv-btn-secondary w-full justify-center"
            >
              Done
            </button>
          )}
        >
          <label className="sv-wallet-search">
            <SearchIcon className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={transactionSearch}
              onChange={(event) => setTransactionSearch(event.target.value)}
              placeholder="Search titles, groups, or descriptions"
              className="sv-wallet-search-input"
            />
          </label>

          <div className="sv-wallet-filter-row">
            {[
              { value: "all", label: "All" },
              { value: "credit", label: "Credits" },
              { value: "debit", label: "Debits" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTransactionFilter(option.value)}
                className={`sv-wallet-filter-pill ${transactionFilter === option.value ? "is-active" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Drawer>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <section className="grid gap-4 sm:gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="sv-card-solid sv-wallet-balance-card sv-reveal">
            <div className="sv-wallet-balance-backdrop" aria-hidden="true">
              <span className="sv-wallet-orb sv-wallet-orb-a" />
              <span className="sv-wallet-orb sv-wallet-orb-b" />
              <span className="sv-wallet-orb sv-wallet-orb-c" />
            </div>

            <div className="relative z-[1]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="sv-eyebrow-on-dark">Wallet</p>
                  <h1 className="sv-display-on-dark mt-3 max-w-3xl">Keep money ready for joins, payouts, and live group activity.</h1>
                </div>
                <button
                  type="button"
                  onClick={() => focusActionTab("topup")}
                  className="sv-wallet-quick-cta"
                >
                  <CreditIcon className="h-4 w-4" />
                  Quick top-up
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Available balance</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="sv-wallet-glyph">
                      <WalletGlyph className="h-5 w-5 sm:h-6 sm:w-6" />
                    </span>
                    <h2 className="sv-count-up text-3xl font-bold text-white sm:text-5xl">
                      <AnimatedValue value={formatCurrency(balance)} />
                    </h2>
                  </div>
                  <p className={`mt-3 text-sm font-semibold ${walletDelta.tone === "is-up" ? "text-emerald-200" : "text-rose-200"}`}>
                    {walletDelta.label}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {topupConfig ? <span className="sv-wallet-info-pill">{topupConfig.mode_label}</span> : null}
                  <span className={`sv-wallet-info-pill ${payoutsLive ? "is-light" : "is-warning"}`}>
                    {payoutConfig?.mode_label || (payoutsLive ? "Payouts live" : "Manual review")}
                  </span>
                </div>
              </div>

              <div className="sv-wallet-trend mt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">7-day flow</p>
                    <p className="mt-1 text-sm text-slate-200">Credits vs debits in your recent activity.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                    <span className="sv-wallet-legend"><span className="sv-wallet-legend-dot is-credit" /> Credit</span>
                    <span className="sv-wallet-legend"><span className="sv-wallet-legend-dot is-debit" /> Debit</span>
                  </div>
                </div>

                <div className="sv-wallet-trend-grid mt-4">
                  {trendPoints.map((point) => (
                    <TrendColumn key={point.key} point={point} maxValue={trendMax} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="sv-card sv-reveal sv-wallet-overview">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="sv-eyebrow">Quick setup</p>
                <h2 className="sv-title mt-2">{isMobile ? "Pick an amount, then open one simple action sheet" : "Tap an amount, then manage the rest in one place"}</h2>
              </div>
              <span className="sv-chip">{sortedTransactions.length} wallet records</span>
            </div>

            <div className="sv-wallet-quick-amounts mt-5">
              {QUICK_AMOUNTS.map((amount, index) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setTopupAmount(amount);
                    focusActionTab("topup");
                  }}
                  className={`sv-wallet-amount-chip ${topupAmount === amount ? "is-active" : ""} ${index === 2 ? "is-popular" : ""}`}
                >
                  <span className="sv-wallet-amount-main">Rs {amount}</span>
                  <span className="sv-wallet-amount-note">
                    {index === 2 ? "Popular" : index === 0 ? "Starter" : index === 3 ? "Fast refill" : "Quick pick"}
                  </span>
                  {topupAmount === amount ? <CheckCircleIcon className="h-4 w-4" /> : null}
                </button>
              ))}
            </div>

            <div className="sv-wallet-overview-stats mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <WalletOverviewStat
                label="Total credits"
                value={formatShortCurrency(transactionSummary.credit)}
                note="top-ups and refunds"
              />
              <WalletOverviewStat
                label="Total debits"
                value={formatShortCurrency(transactionSummary.debit)}
                note="joins and payouts"
              />
              <WalletOverviewStat
                label="Pending payouts"
                value={pendingPayoutCount}
                note={payoutsLive ? "provider updates pending" : "under manual review"}
              />
            </div>

            <div className="sv-wallet-support-cards mt-5 space-y-3">
              {topupConfig ? (
                <div className="sv-wallet-helper-card">
                  <p className="sv-wallet-helper-title">Top-ups</p>
                  <p className="sv-wallet-helper-body">{topupConfig.helper_text}</p>
                </div>
              ) : null}

              <div className={`sv-wallet-helper-card ${payoutsLive ? "" : "is-warning"}`}>
                <p className="sv-wallet-helper-title">{payoutsLive ? "Withdrawals" : "Manual review mode"}</p>
                <p className="sv-wallet-helper-body">
                  {payoutsLive
                    ? payoutConfig?.helper_text || "Withdrawals move to your saved payout method through the live payout rail."
                    : "Automated payouts are pending activation. Save a destination and manual withdrawal requests are usually reviewed within 24 hours."}
                </p>
              </div>
            </div>
          </aside>
        </section>

        {isMobile ? (
          <section className="sv-card sv-reveal sv-wallet-mobile-actions-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="sv-eyebrow">Wallet actions</p>
                <h2 className="sv-title mt-2">Open only the action you need</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Keep this screen focused, then handle top-up, payout setup, or withdrawals in a bottom sheet.
                </p>
              </div>
              <span className="sv-chip">3 actions</span>
            </div>

            <div className="sv-wallet-mobile-action-list mt-5">
              {ACTION_TABS.map((tab) => {
                const meta = ACTION_TAB_META[tab.id];
                const Icon = meta.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => focusActionTab(tab.id)}
                    className={`sv-wallet-mobile-action ${activeTab === tab.id ? "is-active" : ""}`}
                  >
                    <span className="sv-wallet-mobile-action-icon">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="sv-wallet-mobile-action-copy">
                      <strong>{tab.label}</strong>
                      <span>{meta.summary}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {!isMobile ? (
        <section id="wallet-actions" className="sv-card sv-reveal">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="sv-eyebrow">Actions</p>
              <h2 className="sv-title mt-2">Top up, save a destination, or withdraw without leaving the page</h2>
            </div>
            <span className="sv-chip">
              {activeTab === "topup" ? "Add money" : activeTab === "payout" ? "Destination setup" : "Move money out"}
            </span>
          </div>

          {renderActionTabs("mt-5")}
          {activeActionPanel}
        </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[0.94fr_1.06fr]">
          <section className="sv-card sv-reveal">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="sv-eyebrow">Payout Requests</p>
                <h2 className="sv-title mt-2">{isMobile ? "Payouts" : payoutsLive ? "Recent withdrawals" : "Recent withdrawal requests"}</h2>
              </div>
              <span className="sv-chip">
                {sortedPayouts.length} request{sortedPayouts.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {sortedPayouts.length === 0 ? (
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
              ) : (
                sortedPayouts.map((payout) => {
                  const canSync = Boolean(payout.provider_payout_id) && ["pending", "queued", "processing"].includes(payout.status);
                  return (
                    <article key={payout.id} className={`sv-wallet-payout-card ${isMobile ? "is-compact" : ""}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="sv-wallet-transaction-icon">
                              {payout.mode === "UPI" ? <WalletGlyph className="h-4.5 w-4.5" /> : <BankIcon className="h-4.5 w-4.5" />}
                            </span>
                            <p className="text-base font-semibold text-slate-950">{payout.destination_label}</p>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(payout.status)} ${["pending", "queued", "processing"].includes(payout.status) ? "sv-status-pulse" : ""}`}
                            >
                              {payout.status}
                            </span>
                          </div>
                          <p className={`mt-2 text-sm text-slate-600 ${isMobile ? "leading-6 sv-wallet-message-compact" : "leading-7"}`}>
                            {payout.failure_reason || `Mode: ${payout.mode}${payout.utr ? ` | UTR: ${payout.utr}` : ""}`}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>Requested {formatDateTime(payout.requested_at)}</span>
                            {isMobile ? <span>{getEstimatedPayoutLabel(payout, payoutsLive)}</span> : null}
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-lg font-semibold text-rose-700">- {formatCurrency(payout.amount)}</p>
                          {!isMobile ? <p className="mt-2 text-xs text-slate-500">{getEstimatedPayoutLabel(payout, payoutsLive)}</p> : null}
                        </div>
                      </div>

                      {!isMobile ? <PayoutTimeline steps={getPayoutTimeline(payout.status, payoutsLive)} /> : null}

                      {canSync ? (
                        <button
                          type="button"
                          className="sv-btn-secondary mt-4"
                          onClick={() => syncPayout(payout.id)}
                          disabled={workingAction !== "" && workingAction !== `sync-${payout.id}`}
                        >
                          {workingAction === `sync-${payout.id}` ? "Refreshing..." : isMobile ? "Refresh" : "Refresh status"}
                        </button>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="sv-card sv-reveal">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="sv-eyebrow">History</p>
                <h2 className="sv-title mt-2">{isMobile ? "Transactions" : "Transaction activity"}</h2>
              </div>
              <span className="sv-chip">
                {filteredTransactions.length} record{filteredTransactions.length === 1 ? "" : "s"}
              </span>
            </div>

            {isMobile ? (
              <button
                type="button"
                onClick={() => setIsMobileHistoryDrawerOpen(true)}
                className="sv-wallet-history-mobile-trigger mt-5"
              >
                <span className="sv-wallet-history-mobile-trigger-copy">
                  <span>Search &amp; filter</span>
                  <strong>{transactionSearch ? `Searching "${transactionSearch}"` : activeTransactionFilterLabel}</strong>
                </span>
                <SearchIcon className="h-4 w-4" />
              </button>
            ) : (
              <div className="sv-wallet-history-top mt-5">
                <div className="sv-wallet-mini-chart">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Flow snapshot</p>
                      <p className="mt-1 text-sm text-slate-600">Recent balance movement across the last 7 days.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-700">+ {formatShortCurrency(transactionSummary.credit)}</p>
                      <p className="mt-1 text-sm font-semibold text-rose-700">- {formatShortCurrency(transactionSummary.debit)}</p>
                    </div>
                  </div>
                  <div className="sv-wallet-trend-grid mt-4">
                    {trendPoints.map((point) => (
                      <TrendColumn key={`history-${point.key}`} point={point} maxValue={trendMax} compact />
                    ))}
                  </div>
                </div>

                <div className="sv-wallet-history-controls">
                  <label className="sv-wallet-search">
                    <SearchIcon className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={transactionSearch}
                      onChange={(event) => setTransactionSearch(event.target.value)}
                      placeholder="Search titles, groups, or descriptions"
                      className="sv-wallet-search-input"
                    />
                  </label>

                  <div className="sv-wallet-filter-row">
                    {[
                      { value: "all", label: "All" },
                      { value: "credit", label: "Credits" },
                      { value: "debit", label: "Debits" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTransactionFilter(option.value)}
                        className={`sv-wallet-filter-pill ${transactionFilter === option.value ? "is-active" : ""}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-5">
              {groupedTransactions.length === 0 ? (
                <div className="sv-empty-state">
                  <div className="sv-empty-icon">
                    <ShieldIcon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">No transactions match this view.</p>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    Try a different search or filter. Top-ups, joins, payouts, and refunds all show up here.
                  </p>
                </div>
              ) : (
                groupedTransactions.map((group) => (
                  <div key={group.label}>
                    <div className="sv-wallet-group-header">{group.label}</div>
                    <div className="mt-3 space-y-3">
                      {group.items.map((transaction) => (
                        <article key={transaction.id} className={`sv-wallet-transaction-card ${isMobile ? "is-compact" : ""}`}>
                          <div className="flex items-start gap-3">
                            <span
                              className={`sv-wallet-transaction-icon ${transaction.type === "credit" ? "is-credit" : "is-debit"}`}
                            >
                              {transaction.type === "credit" ? <CreditIcon className="h-4.5 w-4.5" /> : <DebitIcon className="h-4.5 w-4.5" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={`min-w-0 flex-1 text-base font-semibold ${transaction.type === "credit" ? "text-emerald-800" : "text-slate-950"}`}>
                                  {transaction.title}
                                </p>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${transaction.type === "credit" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
                                >
                                  {transaction.type}
                                </span>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(transaction.status)} ${["pending", "queued", "processing"].includes(transaction.status) ? "sv-status-pulse" : ""}`}
                                >
                                  {transaction.status}
                                </span>
                              </div>
                              <p className={`mt-2 text-sm text-slate-600 ${isMobile ? "leading-6 sv-wallet-message-compact" : "leading-7"}`}>{transaction.description}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {isMobile
                                  ? transaction.group_name || transaction.mode_label
                                  : `${transaction.mode_label}${transaction.group_name ? ` | ${transaction.group_name}` : ""}`}
                              </p>
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className={`text-lg font-semibold ${transaction.type === "credit" ? "text-emerald-700" : "text-rose-700"}`}>
                              {transaction.type === "credit" ? "+" : "-"} {formatCurrency(transaction.amount)}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">{isMobile ? formatRelativeWalletTime(transaction.created_at) : formatDateTime(transaction.created_at)}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}

function WalletOverviewStat({ label, value, note }) {
  return (
    <div className="sv-wallet-overview-stat">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950 sm:text-xl">{value}</p>
      <p className="mt-1 text-[12px] leading-5 text-slate-500">{note}</p>
    </div>
  );
}

function TrendColumn({ point, maxValue, compact = false }) {
  const creditHeight = point.credit > 0 ? Math.max(14, (point.credit / maxValue) * 100) : 10;
  const debitHeight = point.debit > 0 ? Math.max(14, (point.debit / maxValue) * 100) : 10;

  return (
    <div className={`sv-wallet-trend-column ${compact ? "is-compact" : ""}`}>
      <div className="sv-wallet-trend-bars">
        <span className={`sv-wallet-trend-bar is-credit ${point.credit === 0 ? "is-empty" : ""}`} style={{ height: `${creditHeight}%` }} />
        <span className={`sv-wallet-trend-bar is-debit ${point.debit === 0 ? "is-empty" : ""}`} style={{ height: `${debitHeight}%` }} />
      </div>
      <span className="sv-wallet-trend-label">{point.label}</span>
    </div>
  );
}

function PayoutTimeline({ steps }) {
  return (
    <div className="sv-wallet-payout-timeline">
      {steps.map((step, index) => (
        <div key={step.label} className={`sv-wallet-payout-step ${step.state}`}>
          <span className="sv-wallet-payout-node" />
          <span className="sv-wallet-payout-label">{step.label}</span>
          {index < steps.length - 1 ? <span className="sv-wallet-payout-line" /> : null}
        </div>
      ))}
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
