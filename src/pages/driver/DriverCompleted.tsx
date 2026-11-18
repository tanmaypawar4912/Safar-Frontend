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
  package?: { description?: string; weightKg?: number; specialInstructions?: string };
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

type BookingParty = {
  _id?: string;
  name?: string;
  phone?: string;
  email?: string;
} | string | null;

interface CompletedBookingDetails extends CompletedJob {
  paymentMethod?: "cash_on_delivery" | "online";
  paymentStatus?: string;
  payment?: {
    amount?: number | null;
    currency?: string;
    paidAt?: string | null;
    cashCollectedBy?: string | null;
    gatewayPaymentId?: string | null;
  };
  customer?: BookingParty;
  driver?: BookingParty;
  commissionSnapshot?: {
    vehicleName?: string;
    commissionRateBps?: number;
  };
  financialSnapshot?: {
    calculationStatus?: "finalized" | "legacy" | "review_required";
    commissionBasePaise?: number | null;
    commissionRateBps?: number | null;
    platformCommissionPaise?: number | null;
    driverEarningPaise?: number | null;
    reviewReason?: string;
  };
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

const formatExactMoney = (value?: number | null) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(
    typeof value === "number" && Number.isFinite(value) ? value : 0
  );

function partyName(value: BookingParty | undefined) {
  if (value && typeof value === "object") return value.name || "Not available";
  return typeof value === "string" ? "Contact details unavailable" : "Not available";
}

function partyPhone(value: BookingParty | undefined) {
  return value && typeof value === "object" ? value.phone || "" : "";
}

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
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<CompletedBookingDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [collectingCash, setCollectingCash] = useState(false);
  const [confirmCashCollection, setConfirmCashCollection] = useState(false);
  const [collectionNotice, setCollectionNotice] = useState("");

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

  async function loadBookingDetails(bookingId: string) {
    setDetailsLoading(true);
    setDetailsError("");

    try {
      const response = await api.get(`/bookings/${bookingId}`);
      if (!response.data?.success || !response.data?.booking) {
        throw new Error(response.data?.message || "Unable to load booking details.");
      }
      setSelectedBooking(response.data.booking as CompletedBookingDetails);
    } catch (requestError: unknown) {
      setDetailsError(getError(requestError));
      setSelectedBooking(null);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function openBookingDetails(bookingId: string) {
    setSelectedBookingId(bookingId);
    setSelectedBooking(null);
    setConfirmCashCollection(false);
    setCollectionNotice("");
    await loadBookingDetails(bookingId);
  }

  function closeBookingDetails() {
    if (collectingCash) return;
    setSelectedBookingId(null);
    setSelectedBooking(null);
    setDetailsError("");
    setConfirmCashCollection(false);
    setCollectionNotice("");
  }

  async function handleCashCollection() {
    if (!selectedBooking || collectingCash) return;

    if (
      selectedBooking.status !== "delivered" ||
      selectedBooking.paymentMethod !== "cash_on_delivery"
    ) {
      setDetailsError("Only delivered COD bookings can be marked as cash collected.");
      return;
    }

    setCollectingCash(true);
    setDetailsError("");
    setCollectionNotice("");

    try {
      const response = await api.patch(
        `/payments/${selectedBooking._id}/cash-collected`
      );
      if (!response.data?.success) {
        throw new Error(response.data?.message || "Unable to record COD collection.");
      }

      setConfirmCashCollection(false);
      setCollectionNotice(
        response.data?.alreadyRecorded
          ? "Cash collection was already recorded. Financial records have been checked."
          : response.data?.message || "Cash collection recorded successfully."
      );
      await loadBookingDetails(selectedBooking._id);
    } catch (requestError: unknown) {
      setDetailsError(getError(requestError));
    } finally {
      setCollectingCash(false);
    }
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
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500"><tr><th scope="col" className="px-5 py-3">Booking</th><th scope="col" className="px-5 py-3">Route</th><th scope="col" className="px-5 py-3">Package</th><th scope="col" className="px-5 py-3">Vehicle / distance</th><th scope="col" className="px-5 py-3">Completed</th><th scope="col" className="px-5 py-3">Fare</th><th scope="col" className="px-5 py-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{jobs.map((job) => <tr key={job._id} className="align-top hover:bg-emerald-50/30"><td className="px-5 py-4"><button type="button" onClick={() => void openBookingDetails(job._id)} className="break-all text-left font-extrabold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-orange-700 hover:decoration-orange-400">{job.bookingCode || `Booking ${job._id.slice(-6).toUpperCase()}`}</button><span className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">Delivered</span></td><td className="max-w-[280px] px-5 py-4"><p className="break-words text-xs leading-5"><span className="font-bold text-emerald-700">From:</span> {job.pickup?.address || "Not available"}</p><p className="mt-1 break-words text-xs leading-5"><span className="font-bold text-orange-700">To:</span> {job.drop?.address || "Not available"}</p></td><td className="max-w-[180px] px-5 py-4"><p className="break-words font-bold text-slate-800">{job.package?.description || "Package"}</p><p className="mt-1 text-xs text-slate-500">{job.package?.weightKg ?? "—"} kg</p></td><td className="px-5 py-4"><p className="font-bold text-slate-800">{vehicleName(job.vehicle)}</p><p className="mt-1 text-xs text-slate-500">{typeof job.route?.distanceKm === "number" ? `${job.route.distanceKm.toFixed(1)} km` : "Distance unavailable"}</p></td><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">{formatDate(job.updatedAt || job.createdAt)}</td><td className="whitespace-nowrap px-5 py-4 font-black text-slate-900">{formatMoney(job.fare?.finalFare ?? job.fare?.estimatedFare)}</td><td className="whitespace-nowrap px-5 py-4"><button type="button" onClick={() => void openBookingDetails(job._id)} className="inline-flex min-h-9 items-center rounded-lg bg-orange-50 px-3 py-2 text-xs font-extrabold text-orange-700 hover:bg-orange-100">View details</button></td></tr>)}</tbody></table></div>
            <div className="divide-y divide-slate-100 md:hidden">{jobs.map((job) => <article key={job._id} className="min-w-0 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><button type="button" onClick={() => void openBookingDetails(job._id)} className="break-all text-left text-sm font-black text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-orange-700">{job.bookingCode || `Booking ${job._id.slice(-6).toUpperCase()}`}</button><p className="mt-1 text-[11px] text-slate-500">{formatDate(job.updatedAt || job.createdAt)}</p></div><span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">Delivered</span></div><div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3"><p className="break-words text-xs leading-5"><span className="font-bold text-emerald-700">Pickup:</span> {job.pickup?.address || "Not available"}</p><p className="break-words text-xs leading-5"><span className="font-bold text-orange-700">Drop:</span> {job.drop?.address || "Not available"}</p></div><div className="mt-3 flex items-end justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs font-bold text-slate-800">{job.package?.description || "Package"} · {job.package?.weightKg ?? "—"} kg</p><p className="mt-1 text-[11px] text-slate-500">{vehicleName(job.vehicle)} · {typeof job.route?.distanceKm === "number" ? `${job.route.distanceKm.toFixed(1)} km` : "Distance unavailable"}</p></div><div className="flex shrink-0 flex-col items-end gap-2"><p className="text-base font-black text-slate-900">{formatMoney(job.fare?.finalFare ?? job.fare?.estimatedFare)}</p><button type="button" onClick={() => void openBookingDetails(job._id)} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-extrabold text-white hover:bg-orange-600">View details</button></div></div></article>)}</div>
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

      {selectedBookingId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBookingDetails();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="driver-completed-details-title"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-700">Completed delivery</p>
                <h2 id="driver-completed-details-title" className="mt-1 break-all text-lg font-black text-slate-950 sm:text-xl">
                  {selectedBooking?.bookingCode || "Booking details"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeBookingDetails}
                disabled={collectingCash}
                aria-label="Close booking details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ×
              </button>
            </header>

            <div className="space-y-5 p-5 sm:p-6">
              {detailsLoading && (
                <div className="space-y-3" role="status">
                  <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
                  <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
                  <p className="text-sm text-slate-500">Loading booking details…</p>
                </div>
              )}

              {detailsError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p>{detailsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadBookingDetails(selectedBookingId)}
                    className="mt-2 font-extrabold underline"
                  >
                    Retry loading details
                  </button>
                </div>
              )}

              {collectionNotice && (
                <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  {collectionNotice}
                </div>
              )}

              {selectedBooking && !detailsLoading && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4">
                    <div>
                      <p className="text-xs font-bold text-emerald-800">Booking status</p>
                      <p className="mt-1 text-lg font-black text-emerald-900">Delivered</p>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-extrabold text-emerald-700">Completed</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Pickup</p>
                      <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-800">{selectedBooking.pickup?.address || "Not available"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-orange-700">Drop</p>
                      <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-800">{selectedBooking.drop?.address || "Not available"}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-bold text-slate-500">Customer</p>
                      <p className="mt-1 font-extrabold text-slate-900">{partyName(selectedBooking.customer)}</p>
                      {partyPhone(selectedBooking.customer) && (
                        <a href={`tel:${partyPhone(selectedBooking.customer)}`} className="mt-1 inline-block text-sm font-semibold text-orange-700 hover:underline">{partyPhone(selectedBooking.customer)}</a>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-bold text-slate-500">Package and vehicle</p>
                      <p className="mt-1 font-extrabold text-slate-900">{selectedBooking.package?.description || "Package"}</p>
                      <p className="mt-1 text-sm text-slate-600">{selectedBooking.package?.weightKg ?? "—"} kg · {vehicleName(selectedBooking.vehicle)}</p>
                      <p className="mt-1 text-sm text-slate-600">{typeof selectedBooking.route?.distanceKm === "number" ? `${selectedBooking.route.distanceKm.toFixed(2)} km` : "Distance unavailable"}</p>
                    </div>
                  </div>

                  {selectedBooking.package?.specialInstructions && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-extrabold text-amber-800">Special instructions</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{selectedBooking.package.specialInstructions}</p>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-500">Final fare</p>
                        <p className="mt-1 text-2xl font-black text-slate-950">{formatExactMoney(selectedBooking.fare?.finalFare ?? selectedBooking.fare?.estimatedFare)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-500">Payment method</p>
                        <p className="mt-1 text-sm font-extrabold text-slate-900">{selectedBooking.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : selectedBooking.paymentMethod === "online" ? "Online payment" : "Not available"}</p>
                        <p className={`mt-1 text-xs font-bold ${selectedBooking.paymentStatus === "paid" ? "text-emerald-700" : "text-amber-700"}`}>Payment: {selectedBooking.paymentStatus || "Unknown"}</p>
                      </div>
                    </div>
                    {selectedBooking.paymentStatus === "paid" && selectedBooking.payment?.paidAt && (
                      <p className="mt-3 text-xs text-emerald-700">Recorded on {formatDate(selectedBooking.payment.paidAt)}</p>
                    )}
                  </div>

                  {selectedBooking.financialSnapshot?.calculationStatus === "finalized" && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                      <p className="text-xs font-extrabold text-blue-900">Booking earnings breakdown</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-500">Your earning</p>
                          <p className="mt-1 text-lg font-black text-emerald-700">{formatExactMoney((selectedBooking.financialSnapshot.driverEarningPaise || 0) / 100)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">LogiGo commission</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{formatExactMoney((selectedBooking.financialSnapshot.platformCommissionPaise || 0) / 100)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedBooking.status === "delivered" && selectedBooking.paymentMethod === "cash_on_delivery" && selectedBooking.paymentStatus !== "paid" && (
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                      <p className="font-extrabold text-orange-950">Cash collection pending</p>
                      <p className="mt-1 text-sm leading-6 text-orange-900">After you have actually received {formatExactMoney(selectedBooking.fare?.finalFare ?? selectedBooking.fare?.estimatedFare)} from the customer, record the COD collection below. This will also reconcile the financial ledger.</p>
                      {!confirmCashCollection ? (
                        <button
                          type="button"
                          onClick={() => setConfirmCashCollection(true)}
                          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-orange-700"
                        >
                          Mark cash collected
                        </button>
                      ) : (
                        <div className="mt-3 rounded-xl border border-orange-300 bg-white p-3">
                          <p className="text-sm font-bold text-slate-900">Confirm that you received the full cash amount from the customer.</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={collectingCash}
                              onClick={() => void handleCashCollection()}
                              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {collectingCash ? "Recording…" : "Yes, confirm collection"}
                            </button>
                            <button
                              type="button"
                              disabled={collectingCash}
                              onClick={() => setConfirmCashCollection(false)}
                              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Not yet
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedBooking.paymentMethod === "cash_on_delivery" && selectedBooking.paymentStatus === "paid" && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                      COD collection has been recorded for this booking.
                    </div>
                  )}

                  {selectedBooking.paymentMethod === "online" && selectedBooking.paymentStatus !== "paid" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      This booking uses online payment. Do not collect cash for it; the customer payment must be verified through the payment gateway.
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}