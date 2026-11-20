import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw, FileText, ShieldAlert } from "lucide-react";
import api from "../../services/api";

type DriverRow = {
  _id: string; name: string; email?: string; isActive: boolean; completedBookingCount: number;
  legacyCompletedBookingCount: number; finalizedCompletedBookingCount: number;
  fullyRecordedDeliveryLedgerBookingCount: number; ledgerReconciliationNeededBookingCount: number;
  financialStatus: string; financialStatusMessage?: string;
  driverEarningsAccruedRupees: number; driverEarningsPayableRupees: number;
  driverEarningsRetainedCodRupees: number; driverEarningsEligibleForSettlementRupees: number;
  driverEarningsAwaitingCustomerPaymentRupees: number; codCommissionOutstandingRupees: number;
  pendingPayoutRupees: number; paidPayoutRupees: number;
};
const money = (value?: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
const statusLabel: Record<string, string> = { active: "Ledger active", legacy_only: "Legacy only", reconciliation_required: "Reconciliation needed", no_activity: "No activity", no_ledger_activity: "No ledger activity" };
export default function AdminDriverEarnings() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<DriverRow | null>(null);
  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await api.get("/financial-ledger/admin/drivers/summary", { params: { page: 1, limit: 100 } });
      setDrivers(Array.isArray(response.data?.drivers) ? response.data.drivers : []);
    } catch (requestError) {
      const candidate = requestError as { response?: { data?: { message?: string } }; message?: string };
      setError(candidate.response?.data?.message || candidate.message || "Unable to load driver financial summaries.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const totalAccrued = drivers.reduce((sum, row) => sum + (row.driverEarningsAccruedRupees || 0), 0);
  const activeCount = drivers.filter((row) => row.financialStatus === "active").length;
  const repairCount = drivers.reduce((sum, row) => sum + (row.ledgerReconciliationNeededBookingCount || 0), 0);
  return <main className="min-h-screen bg-[#f4f7fb] p-4 text-slate-900 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-orange-700">Admin / finance</span><h1 className="mt-3 text-3xl font-black tracking-tight">Driver earnings</h1><p className="mt-2 text-sm text-slate-500">All registered drivers, including legacy-only and zero-activity accounts.</p></div><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</button></div>
    {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
    <section className="grid gap-3 sm:grid-cols-3"><SummaryCard label="Registered drivers" value={loading ? "—" : String(drivers.length)} /><SummaryCard label="Drivers with ledger activity" value={loading ? "—" : String(activeCount)} /><SummaryCard label="Accrued driver earnings" value={loading ? "—" : money(totalAccrued)} /></section>
    {repairCount > 0 && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{repairCount} delivered booking(s) require ledger reconciliation. Review the booking and its existing entries before using the reconciliation action.</div>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-4"><h2 className="font-black">All driver accounts</h2><span className="text-xs text-slate-500">{drivers.length} shown</span></div>{loading ? <p className="p-8 text-center text-sm text-slate-500">Loading driver earnings…</p> : drivers.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No driver accounts found.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Driver</th><th className="px-4 py-3">Bookings</th><th className="px-4 py-3">Accrued</th><th className="px-4 py-3">COD retained</th><th className="px-4 py-3">Online eligible</th><th className="px-4 py-3">COD due</th><th className="px-4 py-3">Pending / paid</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{drivers.map((row) => <tr key={row._id} className="hover:bg-slate-50/70"><td className="px-4 py-4"><p className="font-extrabold">{row.name}</p><p className="mt-1 text-xs text-slate-500">{row.email || "Email unavailable"}</p><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.isActive ? "Active account" : "Inactive account"}</span></td><td className="px-4 py-4">{row.completedBookingCount}<p className="text-[11px] text-slate-500">{row.legacyCompletedBookingCount} legacy</p></td><td className="px-4 py-4 font-black">{money(row.driverEarningsAccruedRupees)}</td><td className="px-4 py-4">{money(row.driverEarningsRetainedCodRupees)}</td><td className="px-4 py-4">{money(row.driverEarningsEligibleForSettlementRupees)}</td><td className="px-4 py-4">{money(row.codCommissionOutstandingRupees)}</td><td className="px-4 py-4">{money(row.pendingPayoutRupees)}<p className="text-[11px] text-slate-500">Paid {money(row.paidPayoutRupees)}</p></td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${row.financialStatus === "active" ? "bg-emerald-50 text-emerald-700" : row.financialStatus === "reconciliation_required" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{statusLabel[row.financialStatus] || row.financialStatus}</span><p className="mt-1 max-w-[190px] text-[11px] leading-4 text-slate-500">{row.financialStatusMessage}</p></td><td className="px-4 py-4"><button type="button" onClick={() => setSelected(row)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50"><FileText className="h-3.5 w-3.5" />Details</button></td></tr>)}</tbody></table></div>}</section>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="driver-financial-title" className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 id="driver-financial-title" className="text-xl font-black">{selected.name}</h2><p className="text-sm text-slate-500">{selected.financialStatusMessage}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Close</button></div><div className="mt-4 grid grid-cols-2 gap-3">{[["Accrued earnings",selected.driverEarningsAccruedRupees],["COD retained",selected.driverEarningsRetainedCodRupees],["Online eligible",selected.driverEarningsEligibleForSettlementRupees],["Awaiting payment",selected.driverEarningsAwaitingCustomerPaymentRupees],["COD commission due",selected.codCommissionOutstandingRupees],["Pending payout",selected.pendingPayoutRupees],["Paid payout",selected.paidPayoutRupees],["Ledger entries",selected.fullyRecordedDeliveryLedgerBookingCount]].map(([label,value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-black">{typeof value === "number" && String(label) !== "Ledger entries" ? money(value) : value}</p></div>)}</div></section></div>}
  </div></main>;
}
function SummaryCard({ label, value }: { label: string; value: string }) { return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black tabular-nums">{value}</p></article>; }
