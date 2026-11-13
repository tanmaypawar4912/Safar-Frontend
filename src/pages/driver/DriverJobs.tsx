import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Route,
  Search,
  Truck,
  Weight,
  XCircle,
} from "lucide-react";
import api from "../../services/api";
import DriverLiveLocationControl from "../../components/driver/DriverLiveLocationControl";
import {
  type BookingStatus,
  type DriverJob,
  type JobFilter,
  formatDriverPrice,
  getDriverError,
  statusLabel,
  useDriverJobs,
} from "../../hooks/useDriverJobs";

const activeStatuses: BookingStatus[] = [
  "accepted",
  "arriving_at_pickup",
  "arrived_at_pickup",
  "picked_up",
  "in_transit",
  "arrived_at_drop",
];

const nextAction: Partial<Record<BookingStatus, { status: BookingStatus; label: string; helper: string }>> = {
  accepted: {
    status: "arriving_at_pickup",
    label: "Start heading to pickup",
    helper: "Confirm when you start travelling to pickup.",
  },
  arriving_at_pickup: {
    status: "arrived_at_pickup",
    label: "I've reached pickup",
    helper: "Confirm that you reached the pickup location.",
  },
  arrived_at_pickup: {
    status: "picked_up",
    label: "Package picked up",
    helper: "Use after you collect the package.",
  },
  picked_up: {
    status: "in_transit",
    label: "Start delivery trip",
    helper: "Confirm the package is on its way.",
  },
  in_transit: {
    status: "arrived_at_drop",
    label: "I've reached destination",
    helper: "Confirm that you reached drop-off.",
  },
  arrived_at_drop: {
    status: "delivered",
    label: "Confirm delivery",
    helper: "Only confirm after handing the package over.",
  },
};

function statusClass(status: BookingStatus) {
  if (status === "delivered") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "cancelled") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "assigned") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function customerName(customer: DriverJob["customer"]) {
  return typeof customer === "object" && customer
    ? customer.name || "Customer"
    : "Customer details unavailable";
}

function customerPhone(customer: DriverJob["customer"]) {
  return typeof customer === "object" && customer ? customer.phone || "" : "";
}

function vehicleName(vehicle: DriverJob["vehicle"]) {
  return typeof vehicle === "object" && vehicle
    ? vehicle.name || "Vehicle"
    : typeof vehicle === "string"
      ? vehicle
      : "Vehicle not specified";
}

function jobDate(value?: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function offerExpiry(job: DriverJob) {
  const offer = (job.dispatch?.offers || []).find((item) => item.status === "offered");
  if (!offer?.expiresAt) return "Offer expires shortly";

  const date = new Date(offer.expiresAt);
  if (Number.isNaN(date.getTime())) return "Offer expires shortly";

  return `Respond by ${jobDate(date.toISOString())}`;
}

export default function DriverJobs() {
  const { jobs, offers, loading, refreshing, error, loadJobs } = useDriverJobs();
  const [filter, setFilter] = useState<JobFilter>("all");
  const [search, setSearch] = useState("");
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [rejectingJobId, setRejectingJobId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const currentJobs = useMemo(
    () => jobs.filter((job) => job.status === "assigned" || activeStatuses.includes(job.status)),
    [jobs],
  );

  const counts = useMemo(
    () => ({
      all: currentJobs.length,
      action: currentJobs.filter((job) => job.status === "assigned").length + offers.length,
      active: currentJobs.filter((job) => activeStatuses.includes(job.status)).length,
    }),
    [currentJobs, offers],
  );

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return currentJobs.filter((job) => {
      const matchesFilter = filter === "all" || (filter === "action" && job.status === "assigned") || (filter === "active" && activeStatuses.includes(job.status));
      const matchesSearch = !query || [job.bookingCode, job.pickup?.address, job.drop?.address, job.package?.description, customerName(job.customer)].some((value) => String(value || "").toLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [currentJobs, filter, search]);

  const filteredOffers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return offers;

    return offers.filter((job) =>
      [
        job.bookingCode,
        job.pickup?.address,
        job.drop?.address,
        job.package?.description,
        customerName(job.customer),
      ].some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [offers, search]);

  async function respond(jobId: string, action: "accept" | "reject") {
    if (action === "reject" && rejectionReason.trim().length < 3) {
      setActionError("Please enter a short reason before declining this job.");
      return;
    }

    setBusyJobId(jobId);
    setActionError("");
    setSuccessMessage("");

    try {
      const response = await api.patch(
        `/bookings/${jobId}/respond`,
        action === "accept"
          ? { action }
          : { action, rejectionReason: rejectionReason.trim() }
      );

      if (response.data?.success === false) {
        throw new Error(response.data.message || `Could not ${action} this job.`);
      }

      setSuccessMessage(
        action === "accept"
          ? "Job accepted. Other driver offers for this booking are now unavailable. You can begin updating its delivery progress."
          : "Job declined. It remains available to other drivers or will be redispatched."
      );
      setRejectingJobId(null);
      setRejectionReason("");
      await loadJobs(true);
    } catch (e: unknown) {
      setActionError(getDriverError(e, `Could not ${action} this job.`));
      await loadJobs(true);
    } finally {
      setBusyJobId(null);
    }
  }

  async function updateStatus(jobId: string, status: BookingStatus) {
    setBusyJobId(jobId);
    setActionError("");
    setSuccessMessage("");

    try {
      const response = await api.patch(`/bookings/${jobId}/status`, { status });
      if (response.data?.success === false) {
        throw new Error(response.data.message || "Could not update delivery status.");
      }
      if (status === "delivered") {
        // Best effort immediate deletion after the delivery status is saved;
        // the backend TTL is a fallback if the driver is offline.
        await api.delete(`/bookings/${jobId}/location`).catch(() => undefined);
      }

      setSuccessMessage(
        status === "delivered"
          ? "Delivery marked complete. Great work! You are available for new offers again."
          : `Delivery updated: ${statusLabel(status)}.`
      );
      await loadJobs(true);
    } catch (e: unknown) {
      setActionError(getDriverError(e, "Could not update delivery status."));
    } finally {
      setBusyJobId(null);
    }
  }

  function responseControls(jobId: string) {
    return rejectingJobId === jobId ? (
      <div className="mt-3 space-y-3">
        <label className="block text-xs font-bold text-slate-700">
          Reason for declining
          <textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            maxLength={500}
            rows={2}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            placeholder="Enter a brief reason"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyJobId === jobId}
            onClick={() => void respond(jobId, "reject")}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busyJobId === jobId ? "Submitting…" : "Confirm decline"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRejectingJobId(null);
              setRejectionReason("");
              setActionError("");
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busyJobId === jobId}
          onClick={() => void respond(jobId, "accept")}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-extrabold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {busyJobId === jobId ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Accept job
        </button>
        <button
          type="button"
          disabled={busyJobId === jobId}
          onClick={() => {
            setRejectingJobId(jobId);
            setActionError("");
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-extrabold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" />
          Decline
        </button>
      </div>
    );
  }

  function jobDetailsAndActions(job: DriverJob) {
    const action = nextAction[job.status];
    const phone = customerPhone(job.customer);
    return (
      <div className="mt-3 space-y-4 border-t border-slate-100 pt-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Customer</p><p className="mt-1 break-words text-sm font-bold text-slate-800">{customerName(job.customer)}</p>{phone && <a href={`tel:${phone}`} className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-orange-700"><Phone className="h-3.5 w-3.5" />{phone}</a>}</div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Package and vehicle</p><p className="mt-1 break-words text-sm font-bold text-slate-800">{job.package?.description || "Package not specified"} · {job.package?.weightKg ?? "—"} kg</p><p className="mt-1 break-words text-xs text-slate-500">{vehicleName(job.vehicle)} · {typeof job.route?.distanceKm === "number" ? `${job.route.distanceKm.toFixed(1)} km` : "Distance pending"}</p></div>
        </div>
        {job.package?.specialInstructions && <p className="break-words rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Special instructions:</strong> {job.package.specialInstructions}</p>}
        {job.status === "assigned" ? <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3"><p className="text-sm font-extrabold text-amber-950">This job needs your response</p><p className="mt-1 text-xs leading-5 text-amber-900/80">Accept to begin the delivery workflow, or decline with a short reason.</p>{responseControls(job._id)}</div> : action ? <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3"><p className="text-xs leading-5 text-blue-900/80">{action.helper}</p><button type="button" disabled={busyJobId === job._id} onClick={() => void updateStatus(job._id, action.status)} className="mt-3 inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl bg-[#101c30] px-4 py-3 text-sm font-extrabold text-white hover:bg-[#1c2e49] disabled:opacity-50">{busyJobId === job._id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{busyJobId === job._id ? "Updating status…" : action.label}</button></div> : null}
      </div>
    );
  }

  return (
    <main className="min-h-screen min-w-0 overflow-x-clip bg-[#f7f9fc] px-4 py-5 text-slate-900 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-[26px] bg-gradient-to-br from-[#101c30] via-[#101c30] to-[#28242a] p-5 text-white shadow-xl shadow-slate-900/10 sm:p-7 lg:p-8">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-orange-300 sm:text-xs">
            Driver workspace / assignments
          </p>
          <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-[clamp(1.9rem,4vw,3rem)] font-black tracking-tight">
                My jobs
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Review new automatic dispatch offers, accept one job, and update
                each delivery through its permitted status steps.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadJobs(true)}
              disabled={loading || refreshing}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh jobs
            </button>
          </div>
        </section>

        <section
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          aria-label="Search and filter jobs"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search booking, pickup, drop or customer…"
                aria-label="Search assigned jobs and offers"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { id: "all", label: "Current & upcoming", count: counts.all },
                  { id: "action", label: "Needs action", count: counts.action },
                  { id: "active", label: "In progress", count: counts.active },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  aria-pressed={filter === item.id}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold transition sm:text-sm ${
                    filter === item.id
                      ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50"
                  }`}
                >
                  {item.label}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${filter === item.id ? "bg-white/20" : "bg-slate-100"}`}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {(error || actionError) && (
          <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              {actionError || error}
              <button
                type="button"
                onClick={() => {
                  setActionError("");
                  void loadJobs();
                }}
                className="ml-2 font-extrabold underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {successMessage && (
          <div role="status" className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Keep the GPS watcher mounted even when a driver changes job filters/search. */}
        {jobs.filter((job) => activeStatuses.includes(job.status)).map((job) => (
          <DriverLiveLocationControl key={job._id} bookingId={job._id} status={job.status} bookingCode={job.bookingCode} />
        ))}

        {!loading && filteredOffers.length > 0 && (
          <section className="mt-6 space-y-4" aria-label="Automatic driver offers">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-orange-700">
                  Automatic dispatch
                </p>
                <h2 className="mt-1 text-xl font-black">New job offers</h2>
              </div>
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-extrabold text-orange-800">
                {filteredOffers.length} available
              </span>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Only one eligible driver receives a booking offer at a time. If that
              driver declines or the offer expires, LogiGo checks the next eligible
              driver. Offers expire, so respond promptly.
            </p>

            {filteredOffers.map((job) => (
              <article key={job._id} className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
                <div className="h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-300" />
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                          <Package className="h-4 w-4" />
                        </span>
                        <h3 className="break-all text-base font-black">
                          {job.bookingCode || `Booking ${job._id.slice(-6)}`}
                        </h3>
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-extrabold text-orange-800">
                          New offer
                        </span>
                      </div>
                      <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-amber-700">
                        <Clock3 className="h-3.5 w-3.5" />
                        {offerExpiry(job)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-4 py-3 sm:min-w-36 sm:text-right">
                      <p className="text-xs font-semibold text-slate-500">Estimated fare</p>
                      <p className="mt-1 text-xl font-black">
                        {formatDriverPrice(job.fare?.estimatedFare)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    <div className="flex min-w-0 gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Pickup</p>
                        <p className="mt-1 break-words text-sm font-bold leading-5 text-slate-900">
                          {job.pickup?.address || "Pickup address unavailable"}
                        </p>
                      </div>
                    </div>
                    <div className="flex min-w-0 gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Destination</p>
                        <p className="mt-1 break-words text-sm font-bold leading-5 text-slate-900">
                          {job.drop?.address || "Drop address unavailable"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-100 p-3.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Package</p>
                      <p className="mt-1 break-words text-sm font-bold">{job.package?.description || "Not specified"}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <Weight className="h-3.5 w-3.5" />{job.package?.weightKg ?? "—"} kg
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Vehicle</p>
                      <p className="mt-1 break-words text-sm font-bold">{vehicleName(job.vehicle)}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <Route className="h-3.5 w-3.5" />{job.route?.distanceKm ?? "—"} km
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Route estimate</p>
                      <p className="mt-1 text-sm font-bold">{job.route?.durationMinutes ?? "—"} minutes</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Offer issued</p>
                      <p className="mt-1 text-sm font-bold">{jobDate(job.createdAt)}</p>
                    </div>
                  </div>

                  {responseControls(job._id)}
                </div>
              </article>
            ))}
          </section>
        )}

        {loading && (
          <div className="mt-5 space-y-4">
            {[1, 2].map((item) => (
              <div key={item} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
                <div className="h-4 w-48 rounded bg-slate-200" />
                <div className="mt-4 h-20 rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filteredJobs.length === 0 && filteredOffers.length === 0 && (
          <section className="mt-5 rounded-3xl border border-slate-200 bg-white px-5 py-14 text-center shadow-sm sm:py-16">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <Truck className="h-8 w-8" />
            </span>
            <h2 className="mt-5 text-xl font-black sm:text-2xl">
              {currentJobs.length === 0 && offers.length === 0
                ? "No current jobs or offers"
                : "No current jobs match this filter"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              {currentJobs.length === 0 && offers.length === 0
                ? "New offers and active deliveries will appear here. Completed deliveries are kept separately in Completed Deliveries. This page checks for offers every 15 seconds."
                : "Try another filter or clear the search field."}
            </p>
            {(search || filter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-5 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold hover:bg-slate-50"
              >
                Clear search and filters
              </button>
            )}
          </section>
        )}

        {!loading && filteredJobs.length > 0 && (
          <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Current and upcoming jobs">
            <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-base font-black text-slate-900 sm:text-lg">Current and upcoming jobs</h2><p className="mt-1 text-xs text-slate-500">Completed deliveries are available in the separate history page.</p></div><span className="text-xs font-semibold text-slate-500">{filteredJobs.length} shown</span></div>
            <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500"><tr><th scope="col" className="px-4 py-3">Booking</th><th scope="col" className="px-4 py-3">Route</th><th scope="col" className="px-4 py-3">Package</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Fare</th><th scope="col" className="px-4 py-3">Details / action</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredJobs.map((job) => <tr key={job._id} className="align-top hover:bg-orange-50/30"><td className="px-4 py-4"><p className="break-all font-extrabold text-slate-900">{job.bookingCode || `Booking ${job._id.slice(-6).toUpperCase()}`}</p><p className="mt-1 whitespace-nowrap text-[11px] text-slate-500">{jobDate(job.updatedAt || job.createdAt)}</p></td><td className="max-w-[270px] px-4 py-4"><p className="break-words text-xs leading-5"><span className="font-bold text-emerald-700">From:</span> {job.pickup?.address || "Pickup unavailable"}</p><p className="mt-1 break-words text-xs leading-5"><span className="font-bold text-orange-700">To:</span> {job.drop?.address || "Drop unavailable"}</p></td><td className="max-w-[160px] px-4 py-4"><p className="break-words text-xs font-bold text-slate-800">{job.package?.description || "Package"}</p><p className="mt-1 text-[11px] text-slate-500">{job.package?.weightKg ?? "—"} kg · {vehicleName(job.vehicle)}</p></td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1.5 text-[10px] font-extrabold ${statusClass(job.status)}`}>{statusLabel(job.status)}</span></td><td className="whitespace-nowrap px-4 py-4 font-black text-slate-900">{formatDriverPrice(job.fare?.finalFare ?? job.fare?.estimatedFare)}</td><td className="px-4 py-4"><details className="min-w-[150px]"><summary className="min-h-9 cursor-pointer text-xs font-extrabold text-orange-700">View / manage</summary>{jobDetailsAndActions(job)}</details></td></tr>)}</tbody></table></div>
            <div className="divide-y divide-slate-100 lg:hidden">{filteredJobs.map((job) => <article key={job._id} className="min-w-0 p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-black text-slate-900">{job.bookingCode || `Booking ${job._id.slice(-6).toUpperCase()}`}</p><p className="mt-1 text-[11px] text-slate-500">{jobDate(job.updatedAt || job.createdAt)}</p></div><span className={`max-w-[45%] shrink-0 break-words rounded-full border px-2 py-1 text-[10px] font-extrabold ${statusClass(job.status)}`}>{statusLabel(job.status)}</span></div><div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3"><p className="break-words text-xs leading-5"><span className="font-bold text-emerald-700">Pickup:</span> {job.pickup?.address || "Pickup unavailable"}</p><p className="break-words text-xs leading-5"><span className="font-bold text-orange-700">Drop:</span> {job.drop?.address || "Drop unavailable"}</p></div><div className="mt-3 flex items-end justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs font-bold text-slate-800">{job.package?.description || "Package"} · {job.package?.weightKg ?? "—"} kg</p><p className="mt-1 break-words text-[11px] text-slate-500">{vehicleName(job.vehicle)} · {typeof job.route?.distanceKm === "number" ? `${job.route.distanceKm.toFixed(1)} km` : "Distance pending"}</p></div><p className="shrink-0 text-sm font-black text-slate-900">{formatDriverPrice(job.fare?.finalFare ?? job.fare?.estimatedFare)}</p></div><details className="mt-3"><summary className="min-h-10 cursor-pointer rounded-lg bg-slate-100 px-3 py-2.5 text-xs font-extrabold text-slate-700">View details and update status</summary>{jobDetailsAndActions(job)}</details></article>)}</div>
          </section>
        )}
      </div>
    </main>
  );
}
