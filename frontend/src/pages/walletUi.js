import {
  BankIcon,
  ClockIcon,
  CreditIcon,
  DebitIcon,
  LoadingSpinner,
  ShieldIcon,
} from "../components/UiIcons";
import { formatCurrency } from "../utils/format";

const QUICK_AMOUNTS = ["100", "300", "500", "1000"];

export function SimpleStat({ label, value, note }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

export function TopUpPanel({
  topupAmount,
  setTopupAmount,
  topupConfig,
  workingAction,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Add money to the wallet</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use UPI, cards, or netbanking. Money is credited only after payment verification succeeds.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setTopupAmount(amount)}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                topupAmount === amount
                  ? "border-teal-600 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              Rs {amount}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
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

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Gateway: {topupConfig?.mode_label || "Razorpay"}
        </div>

        <button
          className="sv-btn-primary w-full justify-center"
          type="submit"
          disabled={workingAction !== "" || topupConfig?.topup_enabled === false}
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
      </div>
    </form>
  );
}

export function WithdrawPanel({
  payoutForm,
  payoutAccount,
  payoutModes,
  withdrawMode,
  setWithdrawMode,
  setPayoutForm,
  workingAction,
  bankNumbersMatch,
  payoutsLive,
  destinationSaved,
  withdrawAmount,
  setWithdrawAmount,
  withdrawExceedsBalance,
  onSaveDestination,
  onWithdraw,
  sortedPayouts,
  onSyncPayout,
  statusTone,
  formatDateTime,
  getEstimatedPayoutLabel,
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <form onSubmit={onSaveDestination} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Payout destination</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Save the bank account or UPI ID where withdrawals should go.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {payoutForm.account_type === "vpa" ? "UPI" : "Bank"}
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
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

            <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
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
                <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                  Account holder name
                  <input
                    className="sv-input"
                    value={payoutForm.bank_account_holder_name}
                    onChange={(event) =>
                      setPayoutForm((current) => ({ ...current, bank_account_holder_name: event.target.value }))
                    }
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Account number
                  <input
                    className="sv-input"
                    type="password"
                    value={payoutForm.bank_account_number}
                    onChange={(event) =>
                      setPayoutForm((current) => ({ ...current, bank_account_number: event.target.value }))
                    }
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
                      setPayoutForm((current) => ({
                        ...current,
                        confirm_bank_account_number: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                  IFSC
                  <input
                    className="sv-input"
                    value={payoutForm.bank_account_ifsc}
                    onChange={(event) =>
                      setPayoutForm((current) => ({
                        ...current,
                        bank_account_ifsc: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </label>
              </>
            ) : (
              <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                UPI ID
                <input
                  className="sv-input"
                  value={payoutForm.vpa_address}
                  onChange={(event) => setPayoutForm((current) => ({ ...current, vpa_address: event.target.value }))}
                  placeholder={payoutAccount?.account_type === "vpa" ? "Re-enter to update" : "name@bank"}
                />
              </label>
            )}
          </div>

          {!bankNumbersMatch ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              Account numbers do not match yet.
            </div>
          ) : null}

          <button
            className="sv-btn-secondary mt-4 w-full justify-center"
            type="submit"
            disabled={workingAction !== "" || !bankNumbersMatch}
          >
            {workingAction === "save-payout" ? (
              <>
                <LoadingSpinner />
                Saving destination...
              </>
            ) : (
              <>
                <BankIcon className="h-4 w-4" />
                {payoutsLive ? "Save payout method" : "Save withdrawal destination"}
              </>
            )}
          </button>
        </form>

        <div className="space-y-4">
          <form onSubmit={onWithdraw} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {payoutsLive ? "Withdraw to saved destination" : "Request manual withdrawal"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payoutsLive
                ? "Live payouts use your saved destination. Failed or reversed transfers are credited back."
                : "Manual withdrawals are reviewed first, then processed by the team."}
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Destination: {destinationSaved}
            </div>

            <div className="mt-4 space-y-4">
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
            </div>

            {withdrawExceedsBalance ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                The withdrawal amount is above your available balance.
              </div>
            ) : null}

            <button
              className="sv-btn-primary mt-4 w-full justify-center"
              type="submit"
              disabled={!payoutAccount || workingAction !== "" || withdrawExceedsBalance}
            >
              {workingAction === "withdraw" ? (
                <>
                  <LoadingSpinner />
                  {payoutsLive ? "Creating payout..." : "Submitting request..."}
                </>
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

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Recent payout requests</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {payoutsLive ? "Latest withdrawals" : "Latest manual review requests"}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {sortedPayouts.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {sortedPayouts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No payout requests yet.
                </div>
              ) : (
                sortedPayouts.map((payout) => {
                  const canSync = Boolean(payout.provider_payout_id) && ["pending", "queued", "processing"].includes(payout.status);
                  return (
                    <article key={payout.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{payout.destination_label}</p>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(payout.status)}`}>
                              {payout.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {payout.failure_reason || `Mode: ${payout.mode}${payout.utr ? ` | UTR: ${payout.utr}` : ""}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Requested {formatDateTime(payout.requested_at)} • {getEstimatedPayoutLabel(payout, payoutsLive)}
                          </p>
                        </div>

                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <p className="text-sm font-semibold text-rose-700">- {formatCurrency(payout.amount)}</p>
                          {canSync ? (
                            <button
                              type="button"
                              className="sv-btn-secondary justify-center"
                              onClick={() => onSyncPayout(payout.id)}
                              disabled={workingAction !== "" && workingAction !== `sync-${payout.id}`}
                            >
                              {workingAction === `sync-${payout.id}` ? "Refreshing..." : "Refresh status"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryPanel({ transactions, statusTone, formatDateTime }) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
          <ShieldIcon className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-900">No wallet activity yet.</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Top-ups, joins, payouts, and refunds will appear here after they happen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <article
          key={transaction.id}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">{transaction.title}</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  transaction.type === "credit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {transaction.type}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(transaction.status)}`}>
                {transaction.status}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{transaction.description}</p>
            <p className="mt-1 text-xs text-slate-500">
              {transaction.mode_label}
              {transaction.group_name ? ` • ${transaction.group_name}` : ""}
              {transaction.created_at ? ` • ${formatDateTime(transaction.created_at)}` : ""}
            </p>
          </div>

          <p
            className={`text-sm font-semibold ${
              transaction.type === "credit" ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {transaction.type === "credit" ? "+" : "-"} {formatCurrency(transaction.amount)}
          </p>
        </article>
      ))}
    </div>
  );
}
