import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  RefreshCw,
  ReceiptText,
  Wallet,
  WalletCards,
} from "lucide-react";
import api from "../../services/api";

type LedgerEntryType =
  | "platform_commission_earned"
  | "driver_earning_payable"
  | "driver_earning_retained_cod"
  | "online_payment_received"
  | "cod_cash_collected_by_driver"
  | "cod_commission_receivable";

interface DriverLedgerSummary {
  platformCommissionEarnedRupees?: number;
  driverEarningsPayableRupees?: number;
  driverEarningsRetainedCodRupees?: number;
  onlinePaymentsReceivedRupees?: number;
  codCashCollectedByDriversRupees?: number;
  codCommissionReceivableRupees?: number;
  driverEarningsAccruedRupees?: number;
  driverEarningsEligibleForSettlementRupees?: number;
  driverEarningsAwaitingCustomerPaymentRupees?: number;
  estimatedNetSettlementRupees?: number;
  note?: string;
}

interface DriverSettlementSummary {
  pendingPayoutCount?: number;
  pendingPayoutRupees?: number;
  paidPayoutCount?: number;
  paidPayoutRupees?: number;
  noPayoutCount?: number;
  codCommissionOutstandingRupees?: number;
}

interface LedgerEntry {
  _id: string;
  bookingCode?: string;
  vehicleName?: string;
  entryType: LedgerEntryType;
  amountPaise?: number;
  amountRupees?: number;
  paymentMethod?: "online" | "cash_on_delivery";
  occurredAt: string;
  source?: string;
  sourceReference?: string;
}

interface DriverSettlement {
  _id: string;
  settlementDate: string;
  onlinePaymentGrossRupees?: number;
  driverEarningsGrossRupees?: number;
  codCommissionAddedRupees?: number;
  codCommissionDueBeforeRupees?: number;
  codCommissionOffsetRupees?: number;
  netPayoutRupees?: number;
  codCommissionOutstandingRupees?: number;
  paidAmountRupees?: number;
  status: "pending_payout" | "paid" | "no_payout";
  payoutMethod?: "bank_transfer" | "upi" | "manual" | null;
  payoutReference?: string;
  payoutNote?: string;
  paidAt?: string | null;
  generatedAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  summary?: T;
  entries?: LedgerEntry[];
  settlements?: DriverSettlement[];
  pagination?: Pagination;
}

function formatMoney(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) {
    return "—";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatSettlementDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function ledgerEntryLabel(type: LedgerEntryType): string {
  const labels: Record<LedgerEntryType, string> = {
    platform_commission_earned: "LogiGo commission",
    driver_earning_payable: "Online driver earning",
    driver_earning_retained_cod: "COD driver earning (cash retained)",
    online_payment_received: "Customer online payment captured",
    cod_cash_collected_by_driver: "COD cash collected",
    cod_commission_receivable: "COD commission due to LogiGo",
  };
  return labels[type] || "Financial activity";
}

function ledgerEntryHint(type: LedgerEntryType): string {
  if (type === "driver_earning_payable") return "Added to your online earnings; payout eligible after customer payment is captured.";
  if (type === "driver_earning_retained_cod") return "Your share is already retained from cash collected from the customer.";
  if (type === "platform_commission_earned") return "Platform commission retained by LogiGo.";
  if (type === "online_payment_received") return "Customer payment captured by the payment gateway.";
  if (type === "cod_cash_collected_by_driver") return "Gross cash received directly from the customer.";
  return "Commission payable to LogiGo and adjusted against eligible settlements.";
}

function ledgerImpact(type: LedgerEntryType): "positive" | "negative" | "neutral" {
  if (type === "driver_earning_payable" || type === "driver_earning_retained_cod") return "positive";
  if (type === "platform_commission_earned" || type === "cod_commission_receivable") return "negative";
  return "neutral";
}

function settlementStatusLabel(status: DriverSettlement["status"]): string {
  if (status === "paid") return "Paid";
  if (status === "pending_payout") return "Pending payout";
  return "No payout due";
}

export default function DriverEarning() {
  const [ledgerSummary, setLedgerSummary] = useState<DriverLedgerSummary | null>(null);
  const [settlementSummary, setSettlementSummary] = useState<DriverSettlementSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [settlements, setSettlements] = useState<DriverSettlement[]>([]);
  const [entryPagination, setEntryPagination] = useState<Pagination | null>(null);
  const [settlementPagination, setSettlementPagination] = useState<Pagination | null>(null);
  const [entryPage, setEntryPage] = useState(1);
  const [settlementPage, setSettlementPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [ledgerError, setLedgerError] = useState("");
  const [settlementError, setSettlementError] = useState("");

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setPageError("");

    const results = await Promise.allSettled([
      api.get<ApiEnvelope<DriverLedgerSummary>>("/financial-ledger/driver/summary"),
      api.get<ApiEnvelope<DriverSettlementSummary>>("/settlements/driver/summary"),
      api.get<ApiEnvelope<never>>("/financial-ledger/driver/entries", {
        params: { page: entryPage, limit: 20 },
      }),
      api.get<ApiEnvelope<never>>("/settlements/driver", {
        params: { page: settlementPage, limit: 10 },
      }),
    ]);

    const [ledgerSummaryResult, settlementSummaryResult, entriesResult, settlementsResult] = results;

    if (ledgerSummaryResult.status === "fulfilled" && ledgerSummaryResult.value.data?.success && ledgerSummaryResult.value.data.summary) {
      setLedgerSummary(ledgerSummaryResult.value.data.summary);
      setLedgerError("");
    } else {
      setLedgerSummary(null);
      setLedgerError(
        ledgerSummaryResult.status === "rejected"
          ? getErrorMessage(ledgerSummaryResult.reason, "Unable to load your financial summary.")
          : ledgerSummaryResult.value.data?.message || "Unable to load your financial summary."
      );
    }

    if (settlementSummaryResult.status === "fulfilled" && settlementSummaryResult.value.data?.success && settlementSummaryResult.value.data.summary) {
      setSettlementSummary(settlementSummaryResult.value.data.summary);
      setSettlementError("");
    } else {
      setSettlementSummary(null);
      setSettlementError(
        settlementSummaryResult.status === "rejected"
          ? getErrorMessage(settlementSummaryResult.reason, "Unable to load settlement summary.")
          : settlementSummaryResult.value.data?.message || "Unable to load settlement summary."
      );
    }

    if (entriesResult.status === "fulfilled" && entriesResult.value.data?.success) {
      setEntries(entriesResult.value.data.entries || []);
      setEntryPagination(entriesResult.value.data.pagination || null);
    } else {
      setEntries([]);
      setEntryPagination(null);
      setPageError((current) => current || (entriesResult.status === "rejected"
        ? getErrorMessage(entriesResult.reason, "Unable to load ledger activity.")
        : entriesResult.value.data?.message || "Unable to load ledger activity."));
    }

    if (settlementsResult.status === "fulfilled" && settlementsResult.value.data?.success) {
      setSettlements(settlementsResult.value.data.settlements || []);
      setSettlementPagination(settlementsResult.value.data.pagination || null);
    } else {
      setSettlements([]);
      setSettlementPagination(null);
      setPageError((current) => current || (settlementsResult.status === "rejected"
        ? getErrorMessage(settlementsResult.reason, "Unable to load settlement history.")
        : settlementsResult.value.data?.message || "Unable to load settlement history."));
    }

    setLoading(false);
    setRefreshing(false);
  }, [entryPage, settlementPage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalDriverEarnings = useMemo(() => {
    if (!ledgerSummary) return null;
    const onlineAccrued = Number(ledgerSummary.driverEarningsAccruedRupees ?? ledgerSummary.driverEarningsPayableRupees ?? 0);
    const codRetained = Number(ledgerSummary.driverEarningsRetainedCodRupees ?? 0);
    if (!Number.isFinite(onlineAccrued) || !Number.isFinite(codRetained)) return null;
    return Number((onlineAccrued + codRetained).toFixed(2));
  }, [ledgerSummary]);

  // A driver's COD share is already retained as cash. COD commission can only
  // reduce eligible online earnings; it must never create a negative payout.
  // Any excess COD commission remains visible in the separate COD-due metric
  // and carries forward to a future eligible settlement.
  const settlementBalances = useMemo(() => {
    if (!ledgerSummary) {
      return { estimatedNetPayout: null as number | null, codCommissionCarryForward: null as number | null };
    }

    const eligibleOnline = Number(ledgerSummary.driverEarningsEligibleForSettlementRupees);
    const codOutstandingValue = settlementSummary?.codCommissionOutstandingRupees
      ?? ledgerSummary.codCommissionReceivableRupees;
    const codOutstanding = Number(codOutstandingValue);

    if (
      ledgerSummary.driverEarningsEligibleForSettlementRupees == null
      || codOutstandingValue == null
      || !Number.isFinite(eligibleOnline)
      || !Number.isFinite(codOutstanding)
    ) {
      return { estimatedNetPayout: null as number | null, codCommissionCarryForward: null as number | null };
    }

    return {
      estimatedNetPayout: Number(Math.max(0, eligibleOnline - codOutstanding).toFixed(2)),
      codCommissionCarryForward: Number(Math.max(0, codOutstanding - eligibleOnline).toFixed(2)),
    };
  }, [ledgerSummary, settlementSummary]);

  const metrics = [
    {
      label: "Total driver earnings",
      value: formatMoney(totalDriverEarnings),
      description: "Online earnings accrued + COD share retained",
      icon: Wallet,
      tone: "blue",
    },
    {
      label: "Estimated net payout",
      value: formatMoney(settlementBalances.estimatedNetPayout),
      description: settlementBalances.codCommissionCarryForward != null && settlementBalances.codCommissionCarryForward > 0
        ? `${formatMoney(settlementBalances.codCommissionCarryForward)} COD commission carries forward; no negative payout.`
        : "Captured online earnings after outstanding COD commission adjustment",
      icon: WalletCards,
      tone: "green",
    },
    {
      label: "Pending payout",
      value: formatMoney(settlementSummary?.pendingPayoutRupees),
      description: `${settlementSummary?.pendingPayoutCount ?? 0} settlement(s) awaiting admin confirmation`,
      icon: Clock3,
      tone: "orange",
    },
    {
      label: "Already paid",
      value: formatMoney(settlementSummary?.paidPayoutRupees),
      description: `${settlementSummary?.paidPayoutCount ?? 0} paid settlement(s)`,
      icon: CheckCircle2,
      tone: "green",
    },
    {
      label: "COD commission due",
      value: formatMoney(settlementSummary?.codCommissionOutstandingRupees ?? ledgerSummary?.codCommissionReceivableRupees),
      description: "Outstanding amount adjusted against eligible payouts",
      icon: ArrowDownRight,
      tone: "orange",
    },
    {
      label: "Awaiting customer payment",
      value: formatMoney(ledgerSummary?.driverEarningsAwaitingCustomerPaymentRupees),
      description: "Online driver earnings not yet payout-eligible",
      icon: ReceiptText,
      tone: "slate",
    },
  ];

  const handleRefresh = () => void loadData(true);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-orange-700">
            <Wallet size={13} /> Driver financials
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Earnings & settlements</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Track your delivery earnings, COD commission adjustments and daily payouts in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-orange-300 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {pageError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Info className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-bold">Some financial activity could not be loaded.</p>
            <p className="mt-1">{pageError}</p>
          </div>
        </div>
      )}

      <section aria-label="Earnings overview" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const toneClass = metric.tone === "blue"
            ? "bg-blue-50 text-blue-700"
            : metric.tone === "green"
              ? "bg-emerald-50 text-emerald-700"
              : metric.tone === "orange"
                ? "bg-orange-50 text-orange-700"
                : "bg-slate-100 text-slate-700";
          return (
            <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                    {loading ? <span className="inline-block h-7 w-28 animate-pulse rounded bg-slate-100" /> : metric.value}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{metric.description}</p>
                </div>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${toneClass}`}>
                  <Icon size={20} />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      {(ledgerError || settlementError) && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {ledgerError && <p><strong>Ledger:</strong> {ledgerError}</p>}
          {settlementError && <p className={ledgerError ? "mt-1" : ""}><strong>Settlements:</strong> {settlementError}</p>}
        </div>
      )}

      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Info size={19} className="mt-0.5 shrink-0 text-blue-700" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">How your earnings are calculated</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Your COD share is already retained from the cash collected from the customer. Online earnings become eligible for settlement only after the customer's payment is captured. Outstanding COD commission is adjusted only against eligible online earnings. The payout shown here never goes below zero; any excess COD commission carries forward until future eligible earnings are available. A pending payout is not marked paid until Admin confirms the actual bank or UPI transfer.
            </p>
            {settlementBalances.codCommissionCarryForward != null && settlementBalances.codCommissionCarryForward > 0 && (
              <p className="mt-2 text-sm font-semibold text-orange-800">
                COD commission carried forward: {formatMoney(settlementBalances.codCommissionCarryForward)}. This amount is due to LogiGo and will be adjusted against future eligible online earnings; it is not an additional driver payout.
              </p>
            )}
            {ledgerSummary?.note && <p className="mt-2 text-xs text-slate-500">{ledgerSummary.note}</p>}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-lg font-black text-slate-950">Daily settlement history</h2>
            <p className="mt-1 text-xs text-slate-500">Daily payout records generated by LogiGo Admin.</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
            <CalendarDays size={15} /> India Standard Time (IST)
          </span>
        </div>

        {settlements.length === 0 && !loading ? (
          <div className="px-5 py-10 text-center">
            <CalendarDays className="mx-auto text-slate-300" size={30} />
            <p className="mt-3 font-bold text-slate-800">No daily settlements yet</p>
            <p className="mt-1 text-sm text-slate-500">Your settlement records will appear here after Admin generates the daily payout batch.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {settlements.map((settlement) => (
              <article key={settlement._id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-extrabold text-slate-900">{formatSettlementDate(settlement.settlementDate)}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${settlement.status === "paid" ? "bg-emerald-50 text-emerald-700" : settlement.status === "pending_payout" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                        {settlementStatusLabel(settlement.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Online driver earning {formatMoney(settlement.driverEarningsGrossRupees)}
                      <span className="mx-1.5">·</span>
                      COD commission offset {formatMoney(settlement.codCommissionOffsetRupees)}
                    </p>
                    {settlement.payoutReference && (
                      <p className="mt-1 break-all text-xs text-slate-500">Reference: {settlement.payoutReference} · {settlement.payoutMethod?.replaceAll("_", " ")}</p>
                    )}
                    {settlement.status === "paid" && settlement.paidAt && (
                      <p className="mt-1 text-xs text-emerald-700">Paid on {formatDateTime(settlement.paidAt)}</p>
                    )}
                    {Number(settlement.codCommissionOutstandingRupees || 0) > 0 && (
                      <p className="mt-1 text-xs font-semibold text-orange-700">COD commission carried forward: {formatMoney(settlement.codCommissionOutstandingRupees)}</p>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Net payout</p>
                    <p className="mt-1 text-xl font-black text-slate-950">{formatMoney(settlement.netPayoutRupees)}</p>
                    {settlement.status === "paid" && <p className="mt-1 text-xs font-semibold text-emerald-700">{formatMoney(settlement.paidAmountRupees ?? settlement.netPayoutRupees)} transferred</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {settlementPagination && settlementPagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5">
            <p className="text-xs text-slate-500">Page {settlementPagination.page} of {settlementPagination.pages} · {settlementPagination.total} records</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSettlementPage((page) => Math.max(1, page - 1))} disabled={settlementPage <= 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40" aria-label="Previous settlements"><ChevronLeft size={16}/></button>
              <button type="button" onClick={() => setSettlementPage((page) => Math.min(settlementPagination.pages, page + 1))} disabled={settlementPage >= settlementPagination.pages} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40" aria-label="Next settlements"><ChevronRight size={16}/></button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-lg font-black text-slate-950">Earnings activity</h2>
            <p className="mt-1 text-xs text-slate-500">Booking-wise financial ledger entries. Amounts are shown by their accounting purpose.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{entryPagination?.total ?? entries.length} entries</span>
        </div>

        {entries.length === 0 && !loading ? (
          <div className="px-5 py-10 text-center">
            <ReceiptText className="mx-auto text-slate-300" size={30} />
            <p className="mt-3 font-bold text-slate-800">No ledger activity yet</p>
            <p className="mt-1 text-sm text-slate-500">Completed eligible deliveries and confirmed customer payments will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const impact = ledgerImpact(entry.entryType);
              const Icon = impact === "positive" ? ArrowUpRight : impact === "negative" ? ArrowDownRight : ReceiptText;
              const amountClass = impact === "positive" ? "text-emerald-700" : impact === "negative" ? "text-orange-700" : "text-slate-800";
              return (
                <article key={entry._id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${impact === "positive" ? "bg-emerald-50 text-emerald-700" : impact === "negative" ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
                      <Icon size={17}/>
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{ledgerEntryLabel(entry.entryType)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {entry.bookingCode ? `${entry.bookingCode} · ` : ""}{entry.vehicleName || "Delivery"} · {entry.paymentMethod === "cash_on_delivery" ? "Cash on delivery" : "Online"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{ledgerEntryHint(entry.entryType)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-4 sm:block sm:text-right">
                    <p className={`text-base font-black ${amountClass}`}>{impact === "positive" ? "+" : impact === "negative" ? "−" : ""}{formatMoney(entry.amountRupees ?? (entry.amountPaise !== undefined ? entry.amountPaise / 100 : null))}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(entry.occurredAt)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {entryPagination && entryPagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5">
            <p className="text-xs text-slate-500">Page {entryPagination.page} of {entryPagination.pages} · {entryPagination.total} records</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEntryPage((page) => Math.max(1, page - 1))} disabled={entryPage <= 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40" aria-label="Previous ledger entries"><ChevronLeft size={16}/></button>
              <button type="button" onClick={() => setEntryPage((page) => Math.min(entryPagination.pages, page + 1))} disabled={entryPage >= entryPagination.pages} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40" aria-label="Next ledger entries"><ChevronRight size={16}/></button>
            </div>
          </div>
        )}
      </section>

      <p className="text-center text-xs leading-5 text-slate-400">
        Earnings are ledger-based. Pending settlement is not a completed bank transfer. Contact LogiGo support if a booking or payout record appears incorrect.
      </p>
    </div>
  );
}
