import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, Wallet, ArrowDownRight, ArrowUpRight } from "lucide-react";
import api from "../../services/api";

type FinancialSummary = {
  driverEarningsAccruedRupees?: number;
  driverEarningsEligibleForSettlementRupees?: number;
  driverEarningsAwaitingCustomerPaymentRupees?: number;
  driverEarningsRetainedCodRupees?: number;
  driverEarningsPayableRupees?: number;
  codCommissionReceivableRupees?: number;
  codCommissionAppliedRupees?: number;
  platformCommissionEarnedRupees?: number;
  onlinePaymentsReceivedRupees?: number;
  codCashCollectedByDriversRupees?: number;
  estimatedNetSettlementRupees?: number;
  note?: string;
};
type SettlementSummary = { pendingPayoutCount?: number; pendingPayoutRupees?: number; paidPayoutCount?: number; paidPayoutRupees?: number; codCommissionOutstandingRupees?: number };
type LedgerEntry = { _id: string; bookingCode: string; entryType: string; amountRupees: number; paymentMethod?: string; occurredAt?: string; vehicle?: { name?: string } | null };
type Settlement = { _id: string; settlementDate: string; status: string; netPayoutRupees?: number; codCommissionOffsetPaise?: number; codCommissionOffsetRupees?: number; codCommissionOutstandingRupees?: number; payoutMethod?: string; payoutReference?: string; paidAt?: string };
const money = (value?: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value || 0 : 0);
const dateTime = (value?: string) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const labels: Record<string, string> = { driver_earning_payable: "Online driver earning", driver_earning_retained_cod: "COD driver earning (cash retained)", platform_commission_earned: "LogiGo commission", online_payment_received: "Online payment received", cod_cash_collected_by_driver: "COD cash collected", cod_commission_receivable: "COD commission due to LogiGo" };
export default function DriverEarning() {
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);
  const [settlementSummary, setSettlementSummary] = useState<SettlementSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [ledger, ledgerEntries, payout, payoutHistory] = await Promise.all([
        api.get("/financial-ledger/driver/summary"),
        api.get("/financial-ledger/driver/entries", { params: { page: 1, limit: 50 } }),
        api.get("/settlements/driver/summary"),
        api.get("/settlements/driver", { params: { page: 1, limit: 20 } }),
      ]);
      setFinancial(ledger.data?.summary || {});
      setEntries(Array.isArray(ledgerEntries.data?.entries) ? ledgerEntries.data.entries : []);
      setSettlementSummary(payout.data?.summary || {});
      setSettlements(Array.isArray(payoutHistory.data?.settlements) ? payoutHistory.data.settlements : []);
    } catch (requestError) {
      const candidate = requestError as { response?: { data?: { message?: string } }; message?: string };
      setError(candidate.response?.data?.message || candidate.message || "Unable to load your earnings.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const totalDriverEarnings = (financial?.driverEarningsAccruedRupees || 0) + (financial?.driverEarningsRetainedCodRupees || 0);
  const eligible = financial?.driverEarningsEligibleForSettlementRupees || 0;
  const codDue = settlementSummary?.codCommissionOutstandingRupees ?? financial?.codCommissionReceivableRupees ?? 0;
  const netPayout = Math.max(0, eligible - codDue);
  const carryForward = Math.max(0, codDue - eligible);
  return (
    <main className="min-h-screen bg-[#f4f7fb] p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-orange-700">Driver financials</span><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Earnings & settlements</h1><p className="mt-2 text-sm text-slate-500">Track your delivery earnings, COD commission adjustments and daily payouts.</p></div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
        </section>
        {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Total driver earnings" value={money(totalDriverEarnings)} icon={<Wallet />} detail="Online earnings accrued + COD share retained" loading={loading} />
          <Metric label="Estimated net payout" value={money(netPayout)} icon={<CheckCircle2 />} detail={carryForward > 0 ? `${money(carryForward)} COD commission carries forward; no negative payout.` : "Eligible online earnings after COD commission adjustment"} loading={loading} />
          <Metric label="Pending payout" value={money(settlementSummary?.pendingPayoutRupees)} icon={<Clock3 />} detail={`${settlementSummary?.pendingPayoutCount || 0} settlement(s) awaiting admin confirmation`} loading={loading} />
          <Metric label="Already paid" value={money(settlementSummary?.paidPayoutRupees)} icon={<CheckCircle2 />} detail={`${settlementSummary?.paidPayoutCount || 0} paid settlement(s)`} loading={loading} />
          <Metric label="COD commission due" value={money(codDue)} icon={<ArrowDownRight />} detail="Outstanding amount carried forward against eligible online earnings" loading={loading} />
          <Metric label="Awaiting customer payment" value={money(financial?.driverEarningsAwaitingCustomerPaymentRupees)} icon={<ArrowUpRight />} detail="Online driver earnings not yet payout-eligible" loading={loading} />
        </section>
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950"><h2 className="font-black">How your earnings are calculated</h2><p className="mt-1">Your COD share is already retained from cash collected from the customer. Online earnings become eligible for settlement only after the customer's payment is captured. Outstanding COD commission is adjusted only against eligible online earnings. The estimated payout never goes below zero; any excess COD commission carries forward until future eligible earnings are available. Admin confirms the actual bank or UPI transfer before a settlement is marked paid.</p>{carryForward > 0 && <p className="mt-2 font-bold text-orange-800">COD commission carried forward: {money(carryForward)}. This is due to LogiGo and is not an additional driver payout.</p>}</section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5"><div><h2 className="font-black">Earnings activity</h2><p className="mt-1 text-xs text-slate-500">Booking-wise immutable financial ledger entries.</p></div><span className="text-xs text-slate-500">{entries.length} entries</span></div>{entries.length ? <div className="divide-y divide-slate-100">{entries.map((entry) => { const isCredit = ["driver_earning_payable", "driver_earning_retained_cod", "online_payment_received"].includes(entry.entryType); return <article key={entry._id} className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center sm:px-5"><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isCredit ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>{isCredit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</span><div className="min-w-0"><p className="break-words text-sm font-extrabold text-slate-900">{labels[entry.entryType] || entry.entryType.replaceAll("_", " ")}</p><p className="mt-1 break-all text-xs text-slate-500">{entry.bookingCode} · {entry.vehicle?.name || "Vehicle"} · {entry.paymentMethod || "Payment"}</p><p className="mt-1 text-[11px] text-slate-400">{dateTime(entry.occurredAt)}</p></div></div><p className={`shrink-0 text-base font-black tabular-nums ${isCredit ? "text-emerald-700" : "text-orange-700"}`}>{isCredit ? "+" : "−"}{money(entry.amountRupees)}</p></article>; })}</div> : <p className="p-8 text-center text-sm text-slate-500">No financial entries are available yet. Completed deliveries will appear here after eligible payment collection.</p>}</section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4 sm:p-5"><h2 className="font-black">Daily settlement history</h2><p className="mt-1 text-xs text-slate-500">A payout is marked paid only after Admin confirms the actual transfer reference.</p></div>{settlements.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Net payout</th><th className="px-4 py-3">COD offset</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Paid at</th></tr></thead><tbody className="divide-y divide-slate-100">{settlements.map((item) => <tr key={item._id}><td className="px-4 py-3 font-semibold">{item.settlementDate}</td><td className="px-4 py-3 font-black">{money(item.netPayoutRupees)}</td><td className="px-4 py-3">{money(item.codCommissionOffsetPaise === undefined ? 0 : item.codCommissionOffsetPaise / 100)}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{item.status.replaceAll("_", " ")}</span></td><td className="px-4 py-3 text-xs text-slate-500">{dateTime(item.paidAt)}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">No daily settlements have been generated for this driver yet.</p>}</section>
      </div>
    </main>
  );
}
function Metric({ label, value, detail, icon, loading }: { label: string; value: string; detail: string; icon: ReactNode; loading: boolean }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black tabular-nums text-slate-950">{loading ? "—" : value}</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">{icon}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></article>;
}
