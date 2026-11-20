import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { isAxiosError } from "axios";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Banknote,
  CheckCircle2,
  X,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { Link } from "react-router";

import api from "../../services/api";

interface CompletedJob {
  _id: string;
  bookingCode?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  pickup?: { address?: string };
  drop?: { address?: string };
  package?: { description?: string; weightKg?: number };
  route?: { distanceKm?: number };
  vehicle?: { name?: string } | string | null;
  customer?: { name?: string } | string | null;
  fare?: { estimatedFare?: number; finalFare?: number | null };
  paymentMethod?: "online" | "cash_on_delivery";
  paymentStatus?: string;
  payment?: {
    cashCollectedAt?: string | null;
    paidAt?: string | null;
    cashCollectedBy?: { name?: string } | string | null;
    cashCollectionVerifiedAt?: string | null;
    cashCollectionVerifiedBy?: { name?: string } | string | null;
  } | null;
}

interface HistoryEvent {
  status: string;
  note?: string;
  createdAt?: string;
  changedBy?: { name?: string } | string | null;
}

interface BookingHistoryDetails extends CompletedJob {
  // Reuse the parent's exact payment types to keep API values consistent.
  paymentMethod?: CompletedJob["paymentMethod"];
  paymentStatus?: CompletedJob["paymentStatus"];
  statusHistory?: HistoryEvent[];
  financialSnapshot?: {
    calculationStatus?: string;
    driverEarningPaise?: number | null;
    platformCommissionPaise?: number | null;
    commissionRateBps?: number | null;
    reviewReason?: string;
  } | null;
  package?: CompletedJob["package"] & { specialInstructions?: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const formatDate = (value?: string) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(
    typeof value === "number" && Number.isFinite(value) ? value : 0
  );

function vehicleName(value: CompletedJob["vehicle"]) {
  if (value && typeof value === "object") {
    return value.name || "Vehicle";
  }
  return "Vehicle";
}

function getError(error: unknown) {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) {
      return "Your session may have expired. Please sign in again.";
    }
    if (error.response?.status === 403) {
      return error.response?.data?.message ||
        "This account cannot access completed deliveries.";
    }

    return error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Cannot connect to LogiGo. Check that the backend is running."
        : "Unable to load completed deliveries.");
  }

  return error instanceof Error
    ? error.message
    : "Unable to load completed deliveries.";
}

export default function DriverCompleted() {
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyTargetId, setHistoryTargetId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyBooking, setHistoryBooking] = useState<BookingHistoryDetails | null>(null);
  const [cashCollectingId, setCashCollectingId] = useState<string | null>(null);
  const [paymentActionError, setPaymentActionError] = useState("");
  const [paymentActionNotice, setPaymentActionNotice] = useState("");

  const loadJobs = useCallback(
    async (targetPage: number, query: string) => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/bookings/driver/completed", {
          params: {
            page: targetPage,
            limit: 10,
            ...(query ? { search: query } : {}),
          },
        });

        if (!response.data?.success) {
          throw new Error(
            response.data?.message || "Unable to load completed deliveries."
          );
        }

        const records = Array.isArray(response.data?.jobs)
          ? response.data.jobs
          : [];

        setJobs(records);
        setPagination(
          response.data?.pagination || {
            page: targetPage,
            limit: 10,
            total: records.length,
            totalPages: records.length ? 1 : 0,
          }
        );
      } catch (requestError: unknown) {
        setError(getError(requestError));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadJobs(page, appliedSearch);
  }, [loadJobs, page, appliedSearch]);

  async function openHistory(job: CompletedJob) {
    setHistoryTargetId(job._id);
    setHistoryBooking(null);
    setHistoryError("");
    setHistoryLoading(true);

    try {
      // Reuse the existing ownership-protected booking details endpoint.
      const response = await api.get(`/bookings/${job._id}`);
      if (!response.data?.success || !response.data?.booking) {
        throw new Error(response.data?.message || "Unable to load this delivery's history.");
      }
      setHistoryBooking(response.data.booking as BookingHistoryDetails);
    } catch (requestError: unknown) {
      setHistoryError(getError(requestError));
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistory() {
    if (historyLoading) return;
    setHistoryTargetId(null);
    setHistoryBooking(null);
    setHistoryError("");
  }

  async function markCodAsCollected(job: CompletedJob) {
    if (job.paymentMethod !== "cash_on_delivery" || job.paymentStatus === "paid" || cashCollectingId) return;
    const confirmed = window.confirm(`Confirm that you physically received ${formatMoney(job.fare?.finalFare ?? job.fare?.estimatedFare)} in cash from the customer for ${job.bookingCode || "this delivery"}? Only confirm after receiving the full amount.`);
    if (!confirmed) return;

    setCashCollectingId(job._id);
    setPaymentActionError("");
    setPaymentActionNotice("");
    try {
      const response = await api.patch(`/payments/${job._id}/cash-collected`);
      if (!response.data?.success) throw new Error(response.data?.message || "Cash collection could not be recorded.");
      setPaymentActionNotice("COD cash collection recorded. Your admin team can now see and verify this collection.");
      await loadJobs(page, appliedSearch);
      if (historyTargetId === job._id) await openHistory(job);
    } catch (actionError: unknown) {
      setPaymentActionError(getError(actionError));
    } finally {
      setCashCollectingId(null);
    }
  }

  function formatStatus(value: string) {
    return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  function clearSearch() {
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-5 text-slate-900 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#101c30] via-[#172943] to-[#28272e] p-5 text-white shadow-xl shadow-slate-900/10 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10"
          />

          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-300 sm:text-xs">
            <PackageCheck className="h-4 w-4" />
            Driver workspace / history
          </span>

          <div className="relative mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[clamp(2rem,4vw,3rem)] font-black leading-tight tracking-tight">
                Completed deliveries
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                A searchable history of deliveries you have successfully completed.
              </p>
            </div>

            <Link
              to="/driver/jobs"
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15"
            >
              <Truck className="h-4 w-4" />
              My jobs
            </Link>
          </div>

          <div className="relative mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
            <p className="text-sm font-semibold text-slate-300">Completed deliveries</p>
            <p className="mt-2 text-4xl font-black tabular-nums">
              {loading ? "—" : pagination.total}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              All completed bookings matching this driver account
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <form
            onSubmit={handleSearch}
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          >
            <label className="relative block min-w-0">
              <span className="sr-only">Search completed deliveries</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search booking code, pickup, drop or package"
                className="min-h-12 w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-extrabold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              Search
            </button>

            <button
              type="button"
              onClick={clearSearch}
              disabled={!search && !appliedSearch}
              className="min-h-12 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Clear
            </button>
          </form>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadJobs(page, appliedSearch)}
              className="mt-2 inline-flex items-center gap-2 font-bold underline"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {paymentActionError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{paymentActionError}</div>}
        {paymentActionNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{paymentActionNotice}</div>}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm sm:py-16">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <PackageCheck className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-black">
              {appliedSearch ? "No matching deliveries" : "No completed deliveries yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Once you complete an assigned delivery, it will be listed here with
              its route, package details and fare.
            </p>
            {appliedSearch && (
              <button
                type="button"
                onClick={clearSearch}
                className="mt-5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold"
              >
                Clear search
              </button>
            )}
          </section>
        ) : (
          <section aria-label="Completed deliveries" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><h2 className="text-base font-black text-slate-900">Delivery history</h2><span className="text-xs text-slate-500">{pagination.total} completed deliveries</span></div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500"><tr><th scope="col" className="px-5 py-3">Booking</th><th scope="col" className="px-5 py-3">Route</th><th scope="col" className="px-5 py-3">Package</th><th scope="col" className="px-5 py-3">Vehicle / distance</th><th scope="col" className="px-5 py-3">Completed</th><th scope="col" className="px-5 py-3">Fare</th><th scope="col" className="px-5 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{jobs.map((job) => <tr key={job._id} className="align-top hover:bg-emerald-50/30"><td className="px-5 py-4"><p className="break-all font-extrabold text-slate-900">{job.bookingCode || `Booking ${job._id.slice(-6).toUpperCase()}`}</p><span className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">Delivered</span></td><td className="max-w-[280px] px-5 py-4"><p className="break-words text-xs leading-5"><span className="font-bold text-emerald-700">From:</span> {job.pickup?.address || "Not available"}</p><p className="mt-1 break-words text-xs leading-5"><span className="font-bold text-orange-700">To:</span> {job.drop?.address || "Not available"}</p></td><td className="max-w-[180px] px-5 py-4"><p className="break-words font-bold text-slate-800">{job.package?.description || "Package"}</p><p className="mt-1 text-xs text-slate-500">{job.package?.weightKg ?? "—"} kg</p></td><td className="px-5 py-4"><p className="font-bold text-slate-800">{vehicleName(job.vehicle)}</p><p className="mt-1 text-xs text-slate-500">{typeof job.route?.distanceKm === "number" ? `${job.route.distanceKm.toFixed(1)} km` : "Distance unavailable"}</p></td><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">{formatDate(job.updatedAt || job.createdAt)}</td><td className="whitespace-nowrap px-5 py-4 font-black text-slate-900">{formatMoney(job.fare?.finalFare ?? job.fare?.estimatedFare)}</td><td className="whitespace-nowrap px-5 py-4"><div className="flex flex-col items-start gap-2"><button type="button" onClick={() => void openHistory(job)} disabled={historyLoading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-extrabold text-orange-800 transition hover:bg-orange-100 disabled:cursor-wait disabled:opacity-60"><Eye className="h-4 w-4" />{historyLoading && historyTargetId === job._id ? "Loading…" : "View history"}</button>{job.paymentMethod === "cash_on_delivery" && job.paymentStatus !== "paid" ? <button type="button" onClick={() => void markCodAsCollected(job)} disabled={cashCollectingId === job._id} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"><Banknote className="h-4 w-4" />{cashCollectingId === job._id ? "Recording…" : "Mark as collected"}</button> : job.paymentMethod === "cash_on_delivery" ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{job.payment?.cashCollectionVerifiedAt ? "Admin verified" : job.payment?.cashCollectedAt ? "Collected · awaiting admin verification" : "Legacy paid record · contact admin"}</span> : <span className="text-[11px] font-bold text-emerald-700">Online paid</span>}</div></td></tr>)}</tbody></table></div>
            <div className="divide-y divide-slate-100 md:hidden">{jobs.map((job) => <article key={job._id} className="min-w-0 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-black text-slate-900">{job.bookingCode || `Booking ${job._id.slice(-6).toUpperCase()}`}</p><p className="mt-1 text-[11px] text-slate-500">{formatDate(job.updatedAt || job.createdAt)}</p></div><span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">Delivered</span></div><div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3"><p className="break-words text-xs leading-5"><span className="font-bold text-emerald-700">Pickup:</span> {job.pickup?.address || "Not available"}</p><p className="break-words text-xs leading-5"><span className="font-bold text-orange-700">Drop:</span> {job.drop?.address || "Not available"}</p></div><div className="mt-3 flex items-end justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs font-bold text-slate-800">{job.package?.description || "Package"} · {job.package?.weightKg ?? "—"} kg</p><p className="mt-1 text-[11px] text-slate-500">{vehicleName(job.vehicle)} · {typeof job.route?.distanceKm === "number" ? `${job.route.distanceKm.toFixed(1)} km` : "Distance unavailable"}</p></div><div className="shrink-0 text-right"><p className="text-base font-black text-slate-900">{formatMoney(job.fare?.finalFare ?? job.fare?.estimatedFare)}</p><button type="button" onClick={() => void openHistory(job)} disabled={historyLoading} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-extrabold text-orange-800 transition hover:bg-orange-100 disabled:cursor-wait disabled:opacity-60"><Eye className="h-4 w-4" />{historyLoading && historyTargetId === job._id ? "Loading…" : "View history"}</button>{job.paymentMethod === "cash_on_delivery" && job.paymentStatus !== "paid" ? <button type="button" onClick={() => void markCodAsCollected(job)} disabled={cashCollectingId === job._id} className="mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60"><Banknote className="h-4 w-4" />{cashCollectingId === job._id ? "Recording…" : "Mark collected"}</button> : <p className="mt-2 text-[11px] font-bold text-emerald-700">{job.paymentMethod === "online" ? "Paid online" : job.payment?.cashCollectionVerifiedAt ? "Admin verified" : job.payment?.cashCollectedAt ? "Collected · awaiting admin verification" : "Legacy paid record · contact admin"}</p>}</div></div></article>)}</div>
          </section>
        )}

        {historyTargetId && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation">
            <section role="dialog" aria-modal="true" aria-labelledby="driver-history-title" className="my-auto max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
              <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur sm:p-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-orange-600">Completed delivery record</p>
                  <h2 id="driver-history-title" className="mt-1 break-all text-xl font-black text-slate-900 sm:text-2xl">{historyBooking?.bookingCode || "Delivery history"}</h2>
                  <p className="mt-1 text-xs text-slate-500">Full status timeline and booking details</p>
                </div>
                <button type="button" onClick={closeHistory} disabled={historyLoading} aria-label="Close delivery history" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><X className="h-5 w-5" /></button>
              </header>
              <div className="space-y-5 p-5 sm:p-6">
                {historyLoading && <div className="flex min-h-40 items-center justify-center gap-3 text-sm font-semibold text-slate-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />Loading booking history…</div>}
                {historyError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{historyError}</div>}
                {historyBooking && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Route</p><p className="mt-2 text-sm font-semibold text-slate-800"><span className="text-emerald-700">From:</span> {historyBooking.pickup?.address || "—"}</p><p className="mt-2 text-sm font-semibold text-slate-800"><span className="text-orange-700">To:</span> {historyBooking.drop?.address || "—"}</p></div>
                      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Delivery summary</p><p className="mt-2 text-sm font-bold text-slate-800">{historyBooking.package?.description || "Package"}</p><p className="mt-1 text-xs text-slate-600">{historyBooking.package?.weightKg ?? "—"} kg · {vehicleName(historyBooking.vehicle)}</p><p className="mt-1 text-xs text-slate-600">{typeof historyBooking.route?.distanceKm === "number" ? `${historyBooking.route.distanceKm.toFixed(1)} km` : "Distance unavailable"}</p></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Final fare</p><p className="mt-1 text-lg font-black">{formatMoney(historyBooking.fare?.finalFare ?? historyBooking.fare?.estimatedFare)}</p></div>
                      <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Payment method</p><p className="mt-1 text-sm font-extrabold">{historyBooking.paymentMethod === "online" ? "Online payment" : "Cash on delivery"}</p></div>
                      <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Payment status</p><p className="mt-1 text-sm font-extrabold capitalize">{historyBooking.paymentStatus || "—"}</p>{historyBooking.paymentMethod === "cash_on_delivery" && historyBooking.payment?.cashCollectedAt && <p className="mt-1 text-[11px] leading-5 text-emerald-700">Cash reported collected {formatDate(historyBooking.payment.cashCollectedAt)}{historyBooking.payment.cashCollectionVerifiedAt ? " · Admin verified" : " · Awaiting admin verification"}</p>}</div>
                    </div>
                    {historyBooking.package?.specialInstructions && <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Special instructions</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{historyBooking.package.specialInstructions}</p></div>}
                    <div>
                      <div className="mb-3 flex items-center gap-2"><Clock3 className="h-5 w-5 text-orange-600" /><h3 className="text-base font-black text-slate-900">Delivery status timeline</h3></div>
                      {(historyBooking.statusHistory || []).length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No status history is available for this delivery.</p> : (
                        <ol className="space-y-0">
                          {[...(historyBooking.statusHistory || [])].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()).map((entry, index, list) => (
                            <li key={`${entry.status}-${entry.createdAt || index}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
                              <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"><PackageCheck className="h-4 w-4" />{index < list.length - 1 && <span aria-hidden="true" className="absolute left-1/2 top-8 h-full w-px -translate-x-1/2 bg-slate-200" />}</span>
                              <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-extrabold capitalize text-slate-900">{formatStatus(entry.status)}</p><time className="text-[11px] text-slate-500">{formatDate(entry.createdAt)}</time></div>{entry.note && <p className="mt-1 text-xs leading-5 text-slate-600">{entry.note}</p>}</div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    {historyBooking.financialSnapshot?.calculationStatus && <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Financial record: {formatStatus(historyBooking.financialSnapshot.calculationStatus)}{historyBooking.financialSnapshot.commissionRateBps != null ? ` · Platform commission ${(historyBooking.financialSnapshot.commissionRateBps / 100).toFixed(2)}%` : ""}</p>}
                  </>
                )}
              </div>
            </section>
          </div>
        )}

        {!loading && pagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs font-medium text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} completed deliveries
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-bold disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-bold disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}