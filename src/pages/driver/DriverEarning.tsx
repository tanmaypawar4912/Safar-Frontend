import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, RefreshCw, Wallet } from "lucide-react";
import api from "../../services/api";

type FinancialSummary = {
  driverEarningsAccruedRupees?: number;
  driverEarningsEligibleForSettlementRupees?: number;
  driverEarningsAwaitingCustomerPaymentRupees?: number;
  estimatedNetSettlementRupees?: number;
  platformCommissionEarnedRupees?: number;
  codCommissionOutstandingRupees?: number;
  codCommissionReceivableRupees?: number;
  onlinePaymentsReceivedRupees?: number;
};
type Settlement = {
  _id: string;
  settlementDate: string;
  status: "pending_payout" | "paid" | "no_payout";
  netPayoutRupees?: number;
  paidAmountRupees?: number;
  codCommissionOffsetRupees?: number;
  paidAt?: string;
};

const money = (value?: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const dateLabel = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const statusLabel = (status: Settlement["status"]) =>
  status === "paid" ? "Paid" : status === "pending_payout" ? "Pending payout" : "No payout";

export default function DriverEarning() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [financialResult, settlementResult] = await Promise.all([
        api.get("/financial-ledger/driver/summary"),
        api.get("/settlements/driver", { params: { page: 1, limit: 50 } }),
      ]);
      if (!financialResult.data?.success) throw new Error("Unable to load your earnings summary.");

      // Keep the main earnings view available even when the optional settlement
      // summary endpoint is temporarily unavailable.
      let codCommissionOutstandingRupees = 0;
      try {
        const settlementSummaryResult = await api.get("/settlements/driver/summary");
        codCommissionOutstandingRupees = Number(
          settlementSummaryResult.data?.summary?.codCommissionOutstandingRupees || 0
        );
      } catch {
        // The accrued and eligible figures are still available from the ledger.
      }

      setSummary({
        ...(financialResult.data.summary || {}),
        codCommissionOutstandingRupees,
      });
      setSettlements(Array.isArray(settlementResult.data?.settlements) ? settlementResult.data.settlements : []);
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (requestError as { message?: string })?.message
        || "Unable to load earnings. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cards = [
    { label: "Total earned", value: money(summary?.driverEarningsAccruedRupees), icon: Wallet, tone: "blue" },
    { label: "Eligible for settlement", value: money(summary?.driverEarningsEligibleForSettlementRupees), icon: CheckCircle2, tone: "green" },
    { label: "Awaiting customer payment", value: money(summary?.driverEarningsAwaitingCustomerPaymentRupees), icon: Clock3, tone: "amber" },
    { label: "Estimated net settlement", value: money(summary?.estimatedNetSettlementRupees), icon: CalendarDays, tone: "orange" },
  ];

  return (
    <main className="lgp space-y-6">
      <header className="lgp-head lgp-head-split">
        <div><h1>My Earnings</h1><p>Your earnings, payment eligibility and daily settlement history</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="lgp-btn lgp-btn-ghost">
          <RefreshCw aria-hidden="true" className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      {error && <div role="alert" className="lgp-alert lgp-alert-block"><AlertCircle aria-hidden="true" />{error}</div>}

      <section className="lgp-stats" aria-label="Earnings summary">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="lgp-stat">
            <span className={`lgp-stat-icon lgp-tone-${tone}`}><Icon aria-hidden="true" /></span>
            <span className="lgp-stat-copy"><small>{label}</small><strong>{loading ? "—" : value}</strong></span>
          </article>
        ))}
      </section>

      <section className="lgp-card">
        <header className="lgp-card-head"><div><h2>Financial breakdown</h2><p>Values are sourced from your server-side financial ledger, not gross booking fares.</p></div></header>
        {loading ? <p className="p-5 text-sm text-slate-500">Loading financial summary…</p> : (
          <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-sm text-slate-500">Platform commission recorded</dt><dd className="mt-1 text-xl font-extrabold">{money(summary?.platformCommissionEarnedRupees)}</dd></div>
            <div><dt className="text-sm text-slate-500">Online payments received</dt><dd className="mt-1 text-xl font-extrabold">{money(summary?.onlinePaymentsReceivedRupees)}</dd></div>
            <div><dt className="text-sm text-slate-500">Outstanding COD commission</dt><dd className="mt-1 text-xl font-extrabold">{money(summary?.codCommissionOutstandingRupees)}</dd></div>
          </dl>
        )}
        <p className="border-t border-slate-100 px-5 py-4 text-xs leading-5 text-slate-500">
          Earnings are calculated using the configured vehicle commission rules. Online earnings become payout-eligible after customer payment is captured. COD commission offsets are reflected in settlement calculations.
        </p>
      </section>

      <section className="lgp-card overflow-hidden">
        <header className="lgp-card-head"><div><h2>Daily settlement history</h2><p>Settlement batches and payout status recorded by the administrator</p></div></header>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading settlements…</p> : settlements.length === 0 ? (
          <div className="lgp-empty"><CalendarDays aria-hidden="true" /><p>No settlements yet</p><small>Your daily settlement records will appear here once generated.</small></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Settlement date</th><th className="px-5 py-3">Net payout</th><th className="px-5 py-3">COD adjustment</th><th className="px-5 py-3">Paid amount</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{settlements.map((item) => (
                <tr key={item._id}>
                  <td className="px-5 py-4 font-semibold">{dateLabel(item.settlementDate)}</td>
                  <td className="px-5 py-4 font-bold">{money(item.netPayoutRupees)}</td>
                  <td className="px-5 py-4">{money(item.codCommissionOffsetRupees)}</td>
                  <td className="px-5 py-4">{money(item.paidAmountRupees)}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "paid" ? "bg-emerald-50 text-emerald-700" : item.status === "pending_payout" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{statusLabel(item.status)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
