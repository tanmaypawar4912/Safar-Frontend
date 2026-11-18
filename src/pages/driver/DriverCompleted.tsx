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
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router";

import api from "../../services/api";

interface CompletedJob {
  _id: string;
  bookingCode?: string;
  status: string;
  paymentMethod?: "cash_on_delivery" | "online";
  paymentStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  pickup?: { address?: string };
  drop?: { address?: string };
  package?: { description?: string; weightKg?: number };
  route?: { distanceKm?: number };
  vehicle?: { name?: string } | string | null;
  customer?: { name?: string } | string | null;
  fare?: { estimatedFare?: number; finalFare?: number | null };
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
  const [cashBusyId, setCashBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

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

  async function confirmCashCollection(job: CompletedJob) {
    if (cashBusyId) return;
    const amount = job.fare?.finalFare ?? job.fare?.estimatedFare ?? 0;
    const confirmed = window.confirm(`Confirm that you physically received the full COD amount of ${formatMoney(amount)} from the customer for ${job.bookingCode || "this booking"}? This records collection in the LogiGo financial ledger.`);
    if (!confirmed) return;
    setCashBusyId(job._id);
    setError("");
    setNotice("");
    try {
      const response = await api.patch(`/payments/${job._id}/cash-collected`);
      setNotice(response.data?.message || "Cash collection recorded.");
      await loadJobs(page, appliedSearch);
    } catch (requestError: unknown) {
      setError(getError(requestError));
    } finally {
      setCashBusyId(null);
    }
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

        {notice && (
          <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>
        )}

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
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500"><tr><th scope="col" className="px-5 py-3">Booking</th><th scope="col" className="px-5 py-3">Route</th><th scope="col" className="px-5 py-3">Package</th><th scope="col" className="px-5 py-3">Vehicle / distance</th><th scope="col" className="px-5 py-3">Completed</th><th scope="col" className="px-5 py-3">Fare</th><th scope="col" className="px-5 py-3">Collection</th></tr></thead><tbody className="divide-y divide-slate-100">{jobs.map((job) => <tr key={job._id} className="align-top hover:bg-emerald-50/30"><td className="px-5 py-4"><p className="break-all font-extrabold text-slate-900">{job.bookingCode || `Booking ${job._id.slice(-6).toUpperCase()}`}</p><span className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">Delivered</span></td><td className="max-w-[280px] px-5 py-4"><p className="break-words text-xs leading-5"><span className="font-bold text-emerald-700">From:</span> {job.pickup?.address || "Not available"}</p><p className="mt-1 break-words text-xs leading-5"><span className="font-bold text-orange-700">To:</span> {job.drop?.address || "Not available"}</p></td><td className="max-w-[180px] px-5 py-4"><p className="break-words font-bold text-slate-800">{job.package?.description || "Package"}</p><p className="mt-1 text-xs text-slate-500">{job.package?.weightKg ?? "—"} kg</p></td><td className="px-5 py-4"><p className="font-bold text-slate-800">{vehicleName(job.vehicle)}</p><p className="mt-1 text-xs text-slate-500">{typeof job.route?.distanceKm === "number" ? `${job.route.distanceKm.toFixed(1)} km` : "Distance unavailable"}</p></td><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">{formatDate(job.updatedAt || job.createdAt)}</td><td className="whitespace-nowrap px-5 py-4 font-black text-slate-900">{formatMoney(job.fare?.finalFare ?? job.fare?.estimatedFare)}</td><td className="px-5 py-4">{job.paymentMethod === "cash_on_delivery" && job.paymentStatus !== "paid" ? <button type="button" disabled={cashBusyId !== null} onClick={() => void confirmCashCollection(job)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{cashBusyId === job._id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}Confirm cash</button> : job.paymentMethod === "cash_on_delivery" && job.paymentStatus === "paid" ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Collected</span> : <span className="text-xs text-slate-500">Online payment</span>}</td></tr>)}</tbody></table></div>
            <div className="divide-y divide-slate-100 md:hidden">{jobs.map((job) => <article key={job._id} className="min-w-0 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-black text-slate-900">{job.bookingCode || `Booking ${job._id.slice(-6).toUpperCase()}`}</p><p className="mt-1 text-[11px] text-slate-500">{formatDate(job.updatedAt || job.createdAt)}</p></div><span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">Delivered</span></div><div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3"><p className="break-words text-xs leading-5"><span className="font-bold text-emerald-700">Pickup:</span> {job.pickup?.address || "Not available"}</p><p className="break-words text-xs leading-5"><span className="font-bold text-orange-700">Drop:</span> {job.drop?.address || "Not available"}</p></div><div className="mt-3 flex items-end justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs font-bold text-slate-800">{job.package?.description || "Package"} · {job.package?.weightKg ?? "—"} kg</p><p className="mt-1 text-[11px] text-slate-500">{vehicleName(job.vehicle)} · {typeof job.route?.distanceKm === "number" ? `${job.route.distanceKm.toFixed(1)} km` : "Distance unavailable"}</p></div><div className="shrink-0 text-right"><p className="text-base font-black text-slate-900">{formatMoney(job.fare?.finalFare ?? job.fare?.estimatedFare)}</p>{job.paymentMethod === "cash_on_delivery" && job.paymentStatus !== "paid" ? <button type="button" disabled={cashBusyId !== null} onClick={() => void confirmCashCollection(job)} className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{cashBusyId === job._id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}Confirm cash</button> : job.paymentStatus === "paid" ? <p className="mt-2 text-xs font-bold text-emerald-700">Payment collected</p> : null}</div></div></article>)}</div>
          </section>
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