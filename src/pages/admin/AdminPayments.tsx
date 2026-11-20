import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileText,
  Filter,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Wallet,
  Users,
  X,
} from "lucide-react";
import api from "../../services/api";

type TabKey = "overview" | "drivers" | "settlements" | "ledger" | "payments";
type PaymentMethod = "online" | "cash_on_delivery";
type SettlementStatus = "pending_payout" | "paid" | "no_payout";
type PayoutMethod = "bank_transfer" | "upi" | "manual";
type LedgerEntryType =
  | "platform_commission_earned"
  | "driver_earning_payable"
  | "driver_earning_retained_cod"
  | "online_payment_received"
  | "cod_cash_collected_by_driver"
  | "cod_commission_receivable";

type Settings = {
  codMaxDistanceKm: number;
  onlinePaymentsEnabled: boolean;
  razorpayKeyId?: string;
};

type Person = { _id?: string; name?: string; email?: string; phone?: string };
type Vehicle = { _id?: string; name?: string; slug?: string };

type PaymentRecord = {
  _id: string;
  bookingCode: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: PaymentMethod;
  payableAmount?: number;
  createdAt: string;
  customer?: Person | null;
  driver?: Person | null;
  vehicle?: Vehicle | null;
  route?: { distanceKm?: number };
  payment?: {
    gatewayPaymentId?: string;
    paidAt?: string;
    cashCollectedAt?: string | null;
    cashCollectedBy?: Person | string | null;
    cashCollectionVerifiedAt?: string | null;
    cashCollectionVerifiedBy?: Person | string | null;
    cashCollectionVerificationNote?: string;
  } | null;
};

type LedgerSummary = {
  platformCommissionEarnedRupees?: number;
  driverEarningsPayableRupees?: number;
  driverEarningsRetainedCodRupees?: number;
  onlinePaymentsReceivedRupees?: number;
  codCashCollectedByDriversRupees?: number;
  codCommissionReceivableRupees?: number;
  entryCount?: number;
};

type SettlementSummary = {
  pendingPayoutCount?: number;
  pendingPayoutRupees?: number;
  paidPayoutCount?: number;
  paidPayoutRupees?: number;
  noPayoutCount?: number;
  codCommissionOutstandingRupees?: number;
};

type Settlement = {
  _id: string;
  settlementDate: string;
  driver?: Person | string | null;
  onlinePaymentGrossRupees?: number;
  driverEarningsGrossRupees?: number;
  codCommissionAddedRupees?: number;
  codCommissionDueBeforeRupees?: number;
  codCommissionOffsetRupees?: number;
  netPayoutRupees?: number;
  codCommissionOutstandingRupees?: number;
  paidAmountRupees?: number;
  status: SettlementStatus;
  payoutMethod?: PayoutMethod | null;
  payoutReference?: string;
  payoutNote?: string;
  paidAt?: string | null;
  generatedAt?: string;
};

type LedgerEntry = {
  _id: string;
  bookingCode: string;
  entryType: LedgerEntryType;
  amountRupees: number;
  paymentMethod: PaymentMethod;
  source: string;
  sourceReference?: string;
  occurredAt: string;
  driver?: Person | string | null;
  customer?: Person | string | null;
  vehicle?: Vehicle | string | null;
  vehicleName?: string;
};


type DriverFinancialStatus =
  | "active"
  | "legacy_only"
  | "reconciliation_required"
  | "no_ledger_activity"
  | "no_activity";

type DriverFinancialSummary = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  completedBookingCount: number;
  legacyCompletedBookingCount: number;
  finalizedCompletedBookingCount: number;
  ledgerReconciliationNeededBookingCount: number;
  financialStatus: DriverFinancialStatus;
  financialStatusMessage: string;
  driverEarningsAccruedRupees: number;
  driverEarningsEligibleForSettlementRupees: number;
  driverEarningsAwaitingCustomerPaymentRupees: number;
  driverEarningsRetainedCodRupees: number;
  platformCommissionEarnedRupees: number;
  codCashCollectedByDriversRupees: number;
  codCommissionOutstandingRupees: number;
  pendingPayoutCount: number;
  pendingPayoutRupees: number;
  paidPayoutCount: number;
  paidPayoutRupees: number;
  ledgerEntryCount: number;
};

type Pagination = { page: number; limit: number; total: number; pages: number };
type Envelope<T> = { success?: boolean; message?: string; summary?: T };

const currency = (value?: number | null) => {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

function previousIstDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const todayUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
  return new Date(todayUtc - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dateLabel(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00+05:30` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(date);
}

function dateTimeLabel(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function personName(person?: Person | string | null): string {
  if (!person) return "—";
  if (typeof person === "string") return person;
  return person.name || person.email || "Driver";
}

function statusLabel(status: SettlementStatus): string {
  if (status === "paid") return "Paid";
  if (status === "pending_payout") return "Pending payout";
  return "No payout due";
}

function ledgerLabel(type: LedgerEntryType): string {
  const labels: Record<LedgerEntryType, string> = {
    platform_commission_earned: "LogiGo commission earned",
    driver_earning_payable: "Online driver earning payable",
    driver_earning_retained_cod: "Driver earning retained from COD",
    online_payment_received: "Customer online payment received",
    cod_cash_collected_by_driver: "COD cash collected by driver",
    cod_commission_receivable: "COD commission receivable",
  };
  return labels[type] || "Financial entry";
}

function toIstIsoDateTime(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined;
  return new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30`).toISOString();
}

function StatCard({ label, value, hint, icon: Icon, accent = "orange" }: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
  accent?: "orange" | "green" | "blue" | "amber";
}) {
  const colors = {
    orange: "bg-orange-50 text-orange-600",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-black tracking-tight text-slate-950">{value}</p>
          {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[accent]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export default function AdminPayments() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [settings, setSettings] = useState<Settings>({ codMaxDistanceKm: 25, onlinePaymentsEnabled: false });
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(null);
  const [settlementSummary, setSettlementSummary] = useState<SettlementSummary | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementPagination, setSettlementPagination] = useState<Pagination | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerPagination, setLedgerPagination] = useState<Pagination | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [driverSummaries, setDriverSummaries] = useState<DriverFinancialSummary[]>([]);
  const [driverSummaryPagination, setDriverSummaryPagination] = useState<Pagination | null>(null);
  const [driverSummaryPage, setDriverSummaryPage] = useState(1);
  const [driverSummarySearch, setDriverSummarySearch] = useState("");
  const [settlementStatusFilter, setSettlementStatusFilter] = useState("all");
  const [settlementDateFilter, setSettlementDateFilter] = useState("");
  const [settlementPage, setSettlementPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState("");
  const [ledgerDriverFilter, setLedgerDriverFilter] = useState("");
  const [ledgerFrom, setLedgerFrom] = useState("");
  const [ledgerTo, setLedgerTo] = useState("");
  const [generationDate, setGenerationDate] = useState(previousIstDate);
  const [generationResult, setGenerationResult] = useState<Record<string, unknown> | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("bank_transfer");
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [driverSummariesLoading, setDriverSummariesLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [settlementError, setSettlementError] = useState("");
  const [ledgerError, setLedgerError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [driverSummaryError, setDriverSummaryError] = useState("");

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const [ledgerResponse, settlementResponse] = await Promise.all([
        api.get<Envelope<LedgerSummary>>("/financial-ledger/admin/summary"),
        api.get<Envelope<SettlementSummary>>("/settlements/admin/summary"),
      ]);
      setLedgerSummary(ledgerResponse.data.summary || null);
      setSettlementSummary(settlementResponse.data.summary || null);
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError, "Unable to load financial summaries."));
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadSettlements = useCallback(async (page = 1, statusFilter = "all", dateFilter = "") => {
    setSettlementsLoading(true);
    setSettlementError("");
    try {
      const params: Record<string, string | number> = { page, limit: 25 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      const response = await api.get("/settlements/admin", { params });
      setSettlements(response.data.settlements || []);
      setSettlementPagination(response.data.pagination || null);
    } catch (loadError) {
      setSettlementError(errorMessage(loadError, "Unable to load driver settlements."));
      setSettlements([]);
      setSettlementPagination(null);
    } finally {
      setSettlementsLoading(false);
    }
  }, []);

  const loadLedger = useCallback(async (page = 1, filters: {
    entryType?: string; driverId?: string; from?: string; to?: string;
  } = {}) => {
    setLedgerLoading(true);
    setLedgerError("");
    try {
      const params: Record<string, string | number> = { page, limit: 50 };
      if (filters.entryType) params.entryType = filters.entryType;
      if (filters.driverId?.trim()) params.driverId = filters.driverId.trim();
      const from = toIstIsoDateTime(filters.from || "");
      const to = toIstIsoDateTime(filters.to || "", true);
      if (from) params.from = from;
      if (to) params.to = to;
      const response = await api.get("/financial-ledger/admin/entries", { params });
      setLedgerEntries(response.data.entries || []);
      setLedgerPagination(response.data.pagination || null);
    } catch (loadError) {
      setLedgerError(errorMessage(loadError, "Unable to load financial ledger entries."));
      setLedgerEntries([]);
      setLedgerPagination(null);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadDriverSummaries = useCallback(async (page = 1) => {
    setDriverSummariesLoading(true);
    setDriverSummaryError("");
    try {
      const response = await api.get("/financial-ledger/admin/drivers/summary", {
        params: { page, limit: 50 },
      });
      setDriverSummaries(response.data.drivers || []);
      setDriverSummaryPagination(response.data.pagination || null);
    } catch (loadError) {
      setDriverSummaryError(errorMessage(loadError, "Unable to load driver-wise earnings."));
      setDriverSummaries([]);
      setDriverSummaryPagination(null);
    } finally {
      setDriverSummariesLoading(false);
    }
  }, []);

  const loadPaymentRecords = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentError("");
    try {
      const [settingsResponse, recordsResponse] = await Promise.all([
        api.get("/payments/settings"),
        api.get("/payments/admin/records"),
      ]);
      setSettings(settingsResponse.data.settings);
      setPaymentRecords(recordsResponse.data.bookings || []);
    } catch (loadError) {
      setPaymentError(errorMessage(loadError, "Unable to load payment and COD records."));
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOverview(), loadSettlements(1), loadLedger(1), loadPaymentRecords(), loadDriverSummaries(1)]);
  }, [loadDriverSummaries, loadLedger, loadOverview, loadPaymentRecords, loadSettlements]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const pendingPaymentCount = useMemo(
    () => paymentRecords.filter((record) => record.paymentStatus !== "paid").length,
    [paymentRecords]
  );
  const paidPaymentCount = useMemo(
    () => paymentRecords.filter((record) => record.paymentStatus === "paid").length,
    [paymentRecords]
  );

  async function saveCodPolicy() {
    setSavingSettings(true);
    setError("");
    setNotice("");
    try {
      const response = await api.patch("/payments/settings", {
        codMaxDistanceKm: Number(settings.codMaxDistanceKm),
      });
      setSettings(response.data.settings);
      setNotice("Cash-on-delivery distance policy saved.");
    } catch (saveError) {
      setError(errorMessage(saveError, "Could not save COD policy."));
    } finally {
      setSavingSettings(false);
    }
  }

  async function recordAdminCodSettlement(bookingId: string) {
    const approved = window.confirm("Verify that the assigned driver has reported receiving the full COD cash amount from the customer. This does not record cash collection on the driver's behalf.");
    if (!approved) return;
    setNotice("");
    setPaymentError("");
    try {
      await api.patch(`/payments/admin/${bookingId}/settle-cash`);
      setNotice("Driver-reported COD cash collection has been verified.");
      await Promise.all([loadPaymentRecords(), loadOverview(), loadLedger(1)]);
    } catch (actionError) {
      setPaymentError(errorMessage(actionError, "Could not record COD settlement."));
    }
  }

  async function generateDailySettlements() {
    if (!generationDate) {
      setSettlementError("Select a completed settlement date first.");
      return;
    }
    setGenerating(true);
    setSettlementError("");
    setNotice("");
    setGenerationResult(null);
    try {
      const response = await api.post("/settlements/admin/generate", { date: generationDate });
      const result = response.data.result || {};
      setGenerationResult(result);
      setNotice(response.data.message || "Daily settlement generation finished. Review each result.");
      setSettlementPage(1);
      await Promise.all([loadSettlements(1, settlementStatusFilter, settlementDateFilter), loadOverview()]);
    } catch (actionError) {
      setSettlementError(errorMessage(actionError, "Unable to generate daily settlements."));
    } finally {
      setGenerating(false);
    }
  }

  function openConfirm(settlement: Settlement) {
    setSelectedSettlement(settlement);
    setPayoutMethod("bank_transfer");
    setPayoutReference("");
    setPayoutNote("");
  }

  async function confirmPayout() {
    if (!selectedSettlement) return;
    if (payoutReference.trim().length < 4) {
      setSettlementError("Enter the actual bank UTR or UPI reference (at least 4 characters).");
      return;
    }
    setConfirming(true);
    setSettlementError("");
    setNotice("");
    try {
      await api.patch(`/settlements/admin/${selectedSettlement._id}/confirm`, {
        payoutMethod,
        payoutReference: payoutReference.trim(),
        payoutNote: payoutNote.trim(),
      });
      setSelectedSettlement(null);
      setNotice("Payout confirmation recorded. Keep the bank/UPI reference for audit.");
      await Promise.all([loadSettlements(1, settlementStatusFilter, settlementDateFilter), loadOverview()]);
    } catch (actionError) {
      setSettlementError(errorMessage(actionError, "Unable to confirm payout."));
    } finally {
      setConfirming(false);
    }
  }

  const summaryLoading = overviewLoading && !ledgerSummary && !settlementSummary;

  return (
    <div className="min-h-full bg-[#f4f7fb] p-4 text-slate-900 sm:p-6 lg:p-8">
      <main className="mx-auto max-w-[1600px] space-y-6">
        <section className="rounded-[26px] bg-gradient-to-br from-[#101c30] via-[#172943] to-[#282a34] p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[.16em] text-orange-300">
                Admin control center / finance
              </span>
              <h1 className="mt-4 text-3xl font-black sm:text-4xl">Financial management</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Review platform commission, driver settlements, COD balances and payment activity in one place.
                Commission is gross platform revenue before operating expenses and applicable taxes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={overviewLoading || settlementsLoading || ledgerLoading || paymentsLoading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-extrabold text-white hover:bg-white/15 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${overviewLoading || settlementsLoading || ledgerLoading || paymentsLoading ? "animate-spin" : ""}`} />
              Refresh financial data
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs text-slate-300">LogiGo commission</p>
              <p className="mt-1 text-xl font-black">{summaryLoading ? "…" : currency(ledgerSummary?.platformCommissionEarnedRupees)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs text-slate-300">Online received</p>
              <p className="mt-1 text-xl font-black">{summaryLoading ? "…" : currency(ledgerSummary?.onlinePaymentsReceivedRupees)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs text-slate-300">COD collected</p>
              <p className="mt-1 text-xl font-black">{summaryLoading ? "…" : currency(ledgerSummary?.codCashCollectedByDriversRupees)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs text-slate-300">Driver earnings accrued</p>
              <p className="mt-1 text-xl font-black">{summaryLoading ? "…" : currency(ledgerSummary?.driverEarningsPayableRupees)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs text-slate-300">COD commission due</p>
              <p className="mt-1 text-xl font-black">{summaryLoading ? "…" : currency(settlementSummary?.codCommissionOutstandingRupees)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs text-slate-300">Pending driver payouts</p>
              <p className="mt-1 text-xl font-black">{summaryLoading ? "…" : currency(settlementSummary?.pendingPayoutRupees)}</p>
              <p className="mt-1 text-xs text-slate-300">{settlementSummary?.pendingPayoutCount ?? 0} pending</p>
            </div>
          </div>
        </section>

        {(error || notice) && (
          <div className="space-y-2">
            {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
            {notice && <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5 shrink-0" />{notice}</div>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {([
            ["overview", "Overview", Wallet],
            ["drivers", "Driver earnings", Users],
            ["settlements", "Driver settlements", Banknote],
            ["ledger", "Financial ledger", ClipboardList],
            ["payments", "Payments & COD", CreditCard],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition ${activeTab === key ? "bg-orange-500 text-white shadow-md shadow-orange-200" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Gross commission earned" value={currency(ledgerSummary?.platformCommissionEarnedRupees)} hint="Before gateway charges, taxes and operating expenses" icon={CircleDollarSign} accent="green" />
              <StatCard label="Driver payable entries" value={currency(ledgerSummary?.driverEarningsPayableRupees)} hint="Online driver earnings recorded in the ledger" icon={Wallet} accent="blue" />
              <StatCard label="COD commission outstanding" value={currency(settlementSummary?.codCommissionOutstandingRupees)} hint="Driver-wise COD commission still due to LogiGo" icon={Banknote} accent="amber" />
              <StatCard label="Paid driver settlements" value={currency(settlementSummary?.paidPayoutRupees)} hint={`${settlementSummary?.paidPayoutCount ?? 0} payout records confirmed`} icon={CheckCircle2} accent="green" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black">Settlement snapshot</h2>
                    <p className="mt-1 text-sm text-slate-500">Current payout queue across all drivers.</p>
                  </div>
                  <button type="button" onClick={() => setActiveTab("settlements")} className="text-sm font-extrabold text-orange-600 hover:text-orange-700">Manage payouts →</button>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-800">Pending payout</p><p className="mt-1 text-xl font-black text-slate-950">{currency(settlementSummary?.pendingPayoutRupees)}</p><p className="mt-1 text-xs text-amber-800">{settlementSummary?.pendingPayoutCount ?? 0} settlements</p></div>
                  <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-800">Paid</p><p className="mt-1 text-xl font-black text-slate-950">{currency(settlementSummary?.paidPayoutRupees)}</p><p className="mt-1 text-xs text-emerald-800">{settlementSummary?.paidPayoutCount ?? 0} settlements</p></div>
                  <div className="rounded-xl bg-slate-100 p-4"><p className="text-xs font-bold text-slate-600">No payout due</p><p className="mt-1 text-xl font-black text-slate-950">{settlementSummary?.noPayoutCount ?? 0}</p><p className="mt-1 text-xs text-slate-500">COD-only or fully offset days</p></div>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-black">Financial controls</h2>
                <p className="mt-1 text-sm text-slate-500">Commission configuration remains in Vehicle Types.</p>
                <div className="mt-4 grid gap-3">
                  <button type="button" onClick={() => setActiveTab("drivers")} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left hover:border-orange-300 hover:bg-orange-50/40"><span className="flex items-center gap-3"><Users className="h-5 w-5 text-blue-600" /><span><strong className="block text-sm">View all driver earnings</strong><small className="text-xs text-slate-500">Includes drivers with zero or legacy activity</small></span></span><ChevronRight className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setActiveTab("settlements")} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left hover:border-orange-300 hover:bg-orange-50/40"><span className="flex items-center gap-3"><Banknote className="h-5 w-5 text-orange-600" /><span><strong className="block text-sm">Generate daily settlements</strong><small className="text-xs text-slate-500">Calculate driver net payouts</small></span></span><ChevronRight className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setActiveTab("ledger")} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left hover:border-orange-300 hover:bg-orange-50/40"><span className="flex items-center gap-3"><FileText className="h-5 w-5 text-blue-600" /><span><strong className="block text-sm">Review financial ledger</strong><small className="text-xs text-slate-500">Inspect source entries and booking references</small></span></span><ChevronRight className="h-4 w-4" /></button>
                  <a href="/admin/vehicles" className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left hover:border-orange-300 hover:bg-orange-50/40"><span className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-600" /><span><strong className="block text-sm">Vehicle commission rules</strong><small className="text-xs text-slate-500">Manage per-vehicle commission rates</small></span></span><ChevronRight className="h-4 w-4" /></a>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "drivers" && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <h2 className="text-lg font-black">Driver-wise earnings</h2>
                <p className="mt-1 text-sm text-slate-500">Every registered driver is listed, including drivers with no ledger activity. Legacy bookings are identified separately and are not retroactively charged commission.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={driverSummarySearch} onChange={(event) => setDriverSummarySearch(event.target.value)} placeholder="Search driver name or email" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                <button type="button" onClick={() => void loadDriverSummaries(driverSummaryPage)} disabled={driverSummariesLoading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${driverSummariesLoading ? "animate-spin" : ""}`} />Refresh</button>
              </div>
            </div>
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-xs leading-5 text-slate-600 sm:px-5">
              <strong>How to read this table:</strong> Driver earnings include online payable plus COD earnings already retained in cash. Online payout eligibility requires a captured customer payment. COD commission due is shown separately.
            </div>
            {driverSummaryError && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{driverSummaryError}</p>}
            {driverSummariesLoading ? (
              <div className="p-12 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading all driver earnings…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1320px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Driver</th><th className="px-4 py-3">Completed</th><th className="px-4 py-3">Total accrued</th><th className="px-4 py-3">Online eligible</th><th className="px-4 py-3">Awaiting payment</th><th className="px-4 py-3">COD retained</th><th className="px-4 py-3">COD commission due</th><th className="px-4 py-3">Pending payout</th><th className="px-4 py-3">Paid payout</th><th className="px-4 py-3">Financial status</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {driverSummaries.filter((driver) => {
                      const term = driverSummarySearch.trim().toLowerCase();
                      return !term || driver.name.toLowerCase().includes(term) || driver.email.toLowerCase().includes(term);
                    }).map((driver) => {
                      const statusLabel = driver.financialStatus === "active" ? "Ledger active" : driver.financialStatus === "legacy_only" ? "Legacy only" : driver.financialStatus === "reconciliation_required" ? "Reconciliation needed" : driver.financialStatus === "no_ledger_activity" ? "No ledger activity" : "No activity";
                      const statusClass = driver.financialStatus === "active" ? "bg-emerald-50 text-emerald-700" : driver.financialStatus === "reconciliation_required" ? "bg-red-50 text-red-700" : driver.financialStatus === "legacy_only" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600";
                      return (
                        <tr key={driver._id} className="align-top hover:bg-orange-50/30">
                          <td className="px-4 py-3"><strong className="block">{driver.name}</strong><span className="block text-xs text-slate-500">{driver.email || "No email"}</span><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${driver.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{driver.isActive ? "Active account" : "Inactive account"}</span></td>
                          <td className="px-4 py-3">{driver.completedBookingCount}<span className="block text-xs text-slate-400">{driver.legacyCompletedBookingCount} legacy</span></td>
                          <td className="px-4 py-3 font-black">{currency(driver.driverEarningsAccruedRupees)}</td>
                          <td className="px-4 py-3 font-semibold text-emerald-700">{currency(driver.driverEarningsEligibleForSettlementRupees)}</td>
                          <td className="px-4 py-3">{currency(driver.driverEarningsAwaitingCustomerPaymentRupees)}</td>
                          <td className="px-4 py-3">{currency(driver.driverEarningsRetainedCodRupees)}</td>
                          <td className="px-4 py-3 font-semibold text-amber-700">{currency(driver.codCommissionOutstandingRupees)}</td>
                          <td className="px-4 py-3">{currency(driver.pendingPayoutRupees)}<span className="block text-xs text-slate-400">{driver.pendingPayoutCount} batches</span></td>
                          <td className="px-4 py-3">{currency(driver.paidPayoutRupees)}<span className="block text-xs text-slate-400">{driver.paidPayoutCount} batches</span></td>
                          <td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${statusClass}`}>{statusLabel}</span><span className="mt-1 block max-w-56 whitespace-normal text-[11px] leading-4 text-slate-500">{driver.financialStatusMessage}</span>{driver.ledgerReconciliationNeededBookingCount > 0 && <span className="mt-1 block text-xs font-bold text-red-700">{driver.ledgerReconciliationNeededBookingCount} booking(s) need repair</span>}</td>
                          <td className="px-4 py-3"><button type="button" onClick={() => { setLedgerDriverFilter(driver._id); setLedgerTypeFilter(""); setLedgerFrom(""); setLedgerTo(""); setLedgerPage(1); setActiveTab("ledger"); void loadLedger(1, { driverId: driver._id }); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-700 hover:border-orange-300 hover:bg-orange-50">View ledger</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {driverSummaries.filter((driver) => { const term = driverSummarySearch.trim().toLowerCase(); return !term || driver.name.toLowerCase().includes(term) || driver.email.toLowerCase().includes(term); }).length === 0 && <p className="p-10 text-center text-sm text-slate-500">No drivers match this search.</p>}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm"><span className="text-slate-500">{driverSummaryPagination?.total ?? driverSummaries.length} registered drivers</span><div className="flex items-center gap-2"><button type="button" disabled={!driverSummaryPagination || driverSummaryPage <= 1 || driverSummariesLoading} onClick={() => { const next = Math.max(1, driverSummaryPage - 1); setDriverSummaryPage(next); void loadDriverSummaries(next); }} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="px-2 py-2 text-xs font-bold text-slate-600">{driverSummaryPagination?.page ?? 1} / {Math.max(1, driverSummaryPagination?.pages ?? 1)}</span><button type="button" disabled={!driverSummaryPagination || driverSummaryPage >= driverSummaryPagination.pages || driverSummariesLoading} onClick={() => { const next = driverSummaryPage + 1; setDriverSummaryPage(next); void loadDriverSummaries(next); }} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
          </section>
        )}

        {activeTab === "settlements" && (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-black">Generate daily driver settlements</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Generate a settlement batch for a completed India-local calendar day. Resolve earlier pending payouts before generating a later day. Generation does not transfer money.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="text-xs font-bold text-slate-600">Settlement date (IST)<input type="date" value={generationDate} max={previousIstDate()} onChange={(event) => setGenerationDate(event.target.value)} className="mt-1 block min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900" /></label>
                  <button type="button" onClick={() => void generateDailySettlements()} disabled={generating || !generationDate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-extrabold text-white hover:bg-orange-600 disabled:opacity-50"><CalendarDays className="h-4 w-4" />{generating ? "Generating…" : "Generate settlements"}</button>
                </div>
              </div>
              {generationResult && (
                <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                  <p className="font-extrabold">Generation result for {String(generationResult.settlementDate || generationDate)}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold">
                    <span>Created: {String(generationResult.created ?? 0)}</span><span>Existing: {String(generationResult.existing ?? 0)}</span><span>Blocked: {String(generationResult.blocked ?? 0)}</span><span>Skipped: {String(generationResult.skipped ?? 0)}</span><span>Failed: {String(generationResult.failed ?? 0)}</span>
                  </div>
                  {Array.isArray(generationResult.results) && generationResult.results.length > 0 && <div className="mt-3 max-h-48 overflow-auto rounded-lg bg-white/80 p-3"><ul className="space-y-1 text-xs">{(generationResult.results as Array<Record<string, unknown>>).map((item, index) => <li key={`${String(item.driverId || "driver")}-${index}`} className="flex flex-wrap justify-between gap-2"><span>{String(item.driverName || item.driverId || "Driver")}</span><strong>{String(item.status || "unknown")}{item.message ? ` — ${String(item.message)}` : ""}</strong></li>)}</ul></div>}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
                <div><h2 className="text-lg font-black">Driver payout queue</h2><p className="mt-1 text-sm text-slate-500">Confirm only after the bank/UPI transfer has actually completed.</p></div>
                <div className="flex flex-wrap gap-2">
                  <input type="date" aria-label="Filter settlement date" value={settlementDateFilter} onChange={(event) => { setSettlementDateFilter(event.target.value); setSettlementPage(1); }} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                  <select aria-label="Filter settlement status" value={settlementStatusFilter} onChange={(event) => { setSettlementStatusFilter(event.target.value); setSettlementPage(1); }} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="all">All statuses</option><option value="pending_payout">Pending payout</option><option value="paid">Paid</option><option value="no_payout">No payout due</option></select>
                  <button type="button" onClick={() => { setSettlementPage(1); void loadSettlements(1, settlementStatusFilter, settlementDateFilter); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold"><Filter className="h-4 w-4" />Apply</button>
                </div>
              </div>
              {settlementError && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{settlementError}</p>}
              {settlementsLoading ? <div className="p-12 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading settlements…</div> : (
                <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Date / Driver</th><th className="px-4 py-3">Online gross</th><th className="px-4 py-3">Driver earning</th><th className="px-4 py-3">COD offset</th><th className="px-4 py-3">Net payout</th><th className="px-4 py-3">COD outstanding</th><th className="px-4 py-3">Status / reference</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{settlements.map((item) => <tr key={item._id} className="hover:bg-orange-50/30"><td className="px-4 py-4"><strong className="block">{dateLabel(item.settlementDate)}</strong><span className="text-xs text-slate-500">{personName(item.driver)}</span>{typeof item.driver === "object" && item.driver?.email && <span className="block text-xs text-slate-400">{item.driver.email}</span>}</td><td className="px-4 py-4 font-semibold">{currency(item.onlinePaymentGrossRupees)}</td><td className="px-4 py-4 font-semibold">{currency(item.driverEarningsGrossRupees)}</td><td className="px-4 py-4 font-semibold text-amber-700">{currency(item.codCommissionOffsetRupees)}</td><td className="px-4 py-4 font-black">{currency(item.netPayoutRupees)}</td><td className="px-4 py-4">{currency(item.codCommissionOutstandingRupees)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${item.status === "paid" ? "bg-emerald-50 text-emerald-700" : item.status === "pending_payout" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{statusLabel(item.status)}</span>{item.payoutReference && <span className="mt-1 block max-w-40 break-all text-xs text-slate-500">Ref: {item.payoutReference}</span>}{item.paidAt && <span className="block text-xs text-slate-400">{dateTimeLabel(item.paidAt)}</span>}</td><td className="px-4 py-4">{item.status === "pending_payout" && Number(item.netPayoutRupees || 0) > 0 ? <button type="button" onClick={() => openConfirm(item)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700">Confirm payout</button> : <span className="text-xs font-semibold text-slate-400">—</span>}</td></tr>)}</tbody></table>{settlements.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No settlements match these filters.</p>}</div>
              )}
              <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm"><span className="text-slate-500">{settlementPagination?.total ?? settlements.length} settlement records</span><div className="flex gap-2"><button type="button" disabled={!settlementPagination || settlementPage <= 1} onClick={() => { const next = Math.max(1, settlementPage - 1); setSettlementPage(next); void loadSettlements(next, settlementStatusFilter, settlementDateFilter); }} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="px-2 py-2 text-xs font-bold text-slate-600">{settlementPagination?.page ?? 1} / {Math.max(1, settlementPagination?.pages ?? 1)}</span><button type="button" disabled={!settlementPagination || settlementPage >= settlementPagination.pages} onClick={() => { const next = settlementPage + 1; setSettlementPage(next); void loadSettlements(next, settlementStatusFilter, settlementDateFilter); }} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
            </section>
          </div>
        )}

        {activeTab === "ledger" && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">Financial ledger entries</h2><p className="mt-1 text-sm text-slate-500">Append-only financial events generated by bookings, captured payments and COD collection.</p></div><button type="button" onClick={() => void loadLedger(1, { entryType: ledgerTypeFilter, driverId: ledgerDriverFilter, from: ledgerFrom, to: ledgerTo })} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold"><RefreshCw className="h-4 w-4" />Refresh</button></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><select value={ledgerTypeFilter} onChange={(event) => setLedgerTypeFilter(event.target.value)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="">All entry types</option><option value="platform_commission_earned">LogiGo commission</option><option value="driver_earning_payable">Online driver earning</option><option value="driver_earning_retained_cod">COD driver earning retained</option><option value="online_payment_received">Online payment received</option><option value="cod_cash_collected_by_driver">COD cash collected</option><option value="cod_commission_receivable">COD commission receivable</option></select><input value={ledgerDriverFilter} onChange={(event) => setLedgerDriverFilter(event.target.value)} placeholder="Driver Mongo ID" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /><input type="date" value={ledgerFrom} onChange={(event) => setLedgerFrom(event.target.value)} aria-label="From date" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /><input type="date" value={ledgerTo} onChange={(event) => setLedgerTo(event.target.value)} aria-label="To date" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm" /><button type="button" onClick={() => { setLedgerPage(1); void loadLedger(1, { entryType: ledgerTypeFilter, driverId: ledgerDriverFilter, from: ledgerFrom, to: ledgerTo }); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-extrabold text-white"><Filter className="h-4 w-4" />Filter ledger</button></div>
            </div>
            {ledgerError && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{ledgerError}</p>}
            {ledgerLoading ? <div className="p-12 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading ledger…</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Occurred</th><th className="px-4 py-3">Booking</th><th className="px-4 py-3">Driver</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Entry</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Source ref</th></tr></thead><tbody className="divide-y divide-slate-100">{ledgerEntries.map((entry) => <tr key={entry._id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{dateTimeLabel(entry.occurredAt)}</td><td className="px-4 py-3 font-extrabold">{entry.bookingCode}</td><td className="px-4 py-3">{personName(entry.driver)}</td><td className="px-4 py-3">{typeof entry.vehicle === "object" && entry.vehicle ? entry.vehicle.name || entry.vehicleName || "—" : entry.vehicleName || "—"}</td><td className="px-4 py-3">{ledgerLabel(entry.entryType)}</td><td className="px-4 py-3">{entry.paymentMethod === "online" ? "Online" : "COD"}</td><td className="whitespace-nowrap px-4 py-3 font-black">{currency(entry.amountRupees)}</td><td className="max-w-48 truncate px-4 py-3 text-xs text-slate-500" title={entry.sourceReference || entry.source}>{entry.sourceReference || entry.source || "—"}</td></tr>)}</tbody></table>{ledgerEntries.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No ledger entries found.</p>}</div>}
            <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm"><span className="text-slate-500">{ledgerPagination?.total ?? ledgerEntries.length} entries</span><div className="flex gap-2"><button type="button" disabled={!ledgerPagination || ledgerPage <= 1} onClick={() => { const next = Math.max(1, ledgerPage - 1); setLedgerPage(next); void loadLedger(next, { entryType: ledgerTypeFilter, driverId: ledgerDriverFilter, from: ledgerFrom, to: ledgerTo }); }} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="px-2 py-2 text-xs font-bold text-slate-600">{ledgerPagination?.page ?? 1} / {Math.max(1, ledgerPagination?.pages ?? 1)}</span><button type="button" disabled={!ledgerPagination || ledgerPage >= ledgerPagination.pages} onClick={() => { const next = ledgerPage + 1; setLedgerPage(next); void loadLedger(next, { entryType: ledgerTypeFilter, driverId: ledgerDriverFilter, from: ledgerFrom, to: ledgerTo }); }} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
          </section>
        )}

        {activeTab === "payments" && (
          <div className="space-y-6">
            {paymentError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{paymentError}</div>}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-black">Cash-on-delivery policy</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">COD is available only when server-calculated route distance is within this limit. Longer routes must use online payment.</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="text-xs font-bold text-slate-600">Maximum COD distance (km)<input type="number" min="0" max="1000" step="0.5" value={settings.codMaxDistanceKm} onChange={(event) => setSettings((current) => ({ ...current, codMaxDistanceKm: Number(event.target.value) }))} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm sm:w-48" /></label><button type="button" onClick={() => void saveCodPolicy()} disabled={savingSettings} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"><Save className="h-4 w-4" />{savingSettings ? "Saving…" : "Save policy"}</button></div></div>
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4"><CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" /><div><p className="text-sm font-extrabold">Online payment gateway</p><p className="mt-1 text-sm text-slate-600">{settings.onlinePaymentsEnabled ? "Razorpay keys are configured. Customers must complete and verify UPI / Razorpay payment before an online booking is placed." : "Not configured. Add Razorpay test/live keys to backend/.env and restart the API."}</p></div></div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="text-lg font-black">Booking payment records</h2><p className="mt-1 text-sm text-slate-500">{paidPaymentCount} paid / driver-reported collections · {pendingPaymentCount} awaiting payment</p></div><button type="button" onClick={() => void loadPaymentRecords()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold"><RefreshCw className="h-4 w-4" />Refresh</button></div>{paymentsLoading ? <div className="p-10 text-center text-sm text-slate-500">Loading payment records…</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Booking</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Driver / vehicle</th><th className="px-4 py-3">Distance</th><th className="px-4 py-3">Fare</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{paymentRecords.map((record) => <tr key={record._id} className="hover:bg-orange-50/30"><td className="px-4 py-3"><strong>{record.bookingCode}</strong><span className="mt-1 block text-xs text-slate-500">{dateTimeLabel(record.createdAt)}</span><span className="mt-1 block text-[11px] font-semibold capitalize text-slate-500">Delivery: {record.status.replaceAll("_", " ")}</span></td><td className="px-4 py-3"><strong>{record.customer?.name || "Customer"}</strong><span className="block text-xs text-slate-500">{record.customer?.email || "—"}</span></td><td className="px-4 py-3">{record.driver?.name || "—"}<span className="block text-xs text-slate-500">{record.vehicle?.name || "Vehicle"}</span></td><td className="px-4 py-3">{record.route?.distanceKm ?? "—"} km</td><td className="px-4 py-3 font-black">{currency(record.payableAmount)}</td><td className="px-4 py-3">{record.paymentMethod === "online" ? "Online / Razorpay" : "Cash on delivery"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${record.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{record.paymentStatus || "unpaid"}</span>{record.paymentMethod === "cash_on_delivery" && record.payment?.cashCollectedBy && <span className="mt-1 block text-[11px] leading-5 text-slate-500">Driver reported collected{record.payment.cashCollectedBy && typeof record.payment.cashCollectedBy === "object" ? ` by ${record.payment.cashCollectedBy.name || "assigned driver"}` : ""}{record.payment.cashCollectedAt ? ` · ${dateTimeLabel(record.payment.cashCollectedAt)}` : ""}</span>}{record.payment?.cashCollectionVerifiedAt && <span className="mt-1 block text-[11px] font-bold text-emerald-700">Admin verified by {personName(record.payment.cashCollectionVerifiedBy)} · {dateTimeLabel(record.payment.cashCollectionVerifiedAt)}</span>}{record.paymentMethod === "online" && record.paymentStatus === "paid" && <span className="mt-1 block text-[11px] text-emerald-700">Razorpay captured{record.payment.gatewayPaymentId ? ` · ${record.payment.gatewayPaymentId}` : ""}</span>}</td><td className="px-4 py-3">{record.paymentMethod === "cash_on_delivery" && record.paymentStatus === "paid" && record.payment?.cashCollectedBy && !record.payment.cashCollectionVerifiedAt ? <button type="button" onClick={() => void recordAdminCodSettlement(record._id)} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-extrabold text-white hover:bg-orange-600">Verify COD</button> : record.paymentMethod === "cash_on_delivery" && record.paymentStatus !== "paid" ? <span className="text-xs font-semibold text-amber-700">Awaiting driver collection</span> : record.paymentMethod === "cash_on_delivery" && record.paymentStatus === "paid" && record.payment?.cashCollectionVerifiedAt ? <span className="text-xs font-bold text-emerald-700">Collection verified</span> : record.paymentMethod === "cash_on_delivery" && record.paymentStatus === "paid" ? <span className="text-xs font-semibold text-amber-700">Legacy/manual record — review</span> : record.paymentMethod === "cash_on_delivery" ? <span className="text-xs font-semibold text-amber-700">Awaiting driver collection</span> : record.paymentStatus === "paid" ? <span className="text-xs font-bold text-emerald-700">Paid online</span> : <span className="text-xs text-slate-400">Online payment not completed</span>}</td></tr>)}</tbody></table>{paymentRecords.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No completed delivery payments found.</p>}</div>}</section>
          </div>
        )}
      </main>

      {selectedSettlement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !confirming) setSelectedSettlement(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="confirm-payout-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-orange-600">Admin payout verification</p><h2 id="confirm-payout-title" className="mt-2 text-xl font-black">Confirm driver payout</h2></div><button type="button" aria-label="Close" disabled={confirming} onClick={() => setSelectedSettlement(null)} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-50"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Driver / settlement date</p><p className="mt-1 font-extrabold">{personName(selectedSettlement.driver)} · {dateLabel(selectedSettlement.settlementDate)}</p><p className="mt-3 text-xs text-slate-500">Net payout amount</p><p className="mt-1 text-2xl font-black text-emerald-700">{currency(selectedSettlement.netPayoutRupees)}</p><p className="mt-2 text-xs leading-5 text-slate-500">Only confirm after the actual bank transfer or UPI payment has completed. This action records the payout; it does not send money.</p></div>
            <div className="mt-4 space-y-4"><label className="block text-sm font-bold text-slate-700">Payout method<select value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value as PayoutMethod)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="manual">Manual / other</option></select></label><label className="block text-sm font-bold text-slate-700">Bank UTR / UPI reference *<input value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} minLength={4} maxLength={100} required placeholder="Enter actual transaction reference" className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 font-normal" /></label><label className="block text-sm font-bold text-slate-700">Admin note (optional)<textarea value={payoutNote} onChange={(event) => setPayoutNote(event.target.value)} maxLength={500} rows={3} placeholder="Optional settlement note" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" /></label></div>
            {settlementError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{settlementError}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={confirming} onClick={() => setSelectedSettlement(null)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold">Cancel</button><button type="button" disabled={confirming || payoutReference.trim().length < 4} onClick={() => void confirmPayout()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white disabled:opacity-50">{confirming ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Confirm actual payout</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
