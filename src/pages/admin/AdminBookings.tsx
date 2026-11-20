
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Truck,
  Users,
  Weight,
  XCircle,
} from "lucide-react";

import api from "../../services/api";
import AdminBookingDetailsModal from "../../components/admin/AdminBookingDetailsModal";
import AdminBookingTracking from "../../components/admin/AdminBookingTracking";

type BookingStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "arriving_at_pickup"
  | "arrived_at_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_at_drop"
  | "delivered"
  | "cancelled";

type StatusFilter = "all" | BookingStatus;

interface AdminUser {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface Vehicle {
  _id?: string;
  name?: string;
  slug?: string;
  capacityKg?: number;
}

interface Driver {
  profileId: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  vehicleType: string;
  vehicleMakeModel: string;
  vehicleRegistration: string;
  vehicleCapacityKg: number;
  availability: "online" | "busy" | "offline";
}

interface Booking {
  _id: string;
  bookingCode: string;
  status: BookingStatus;
  paymentStatus: string;
  paymentMethod?: string;
  createdAt: string;
  customer: AdminUser | string | null;
  driver: AdminUser | string | null;
  vehicle: Vehicle | string | null;
  pickup?: { address?: string } | null;
  drop?: { address?: string } | null;
  package?: {
    description?: string;
    weightKg?: number;
    specialInstructions?: string;
  } | null;
  route?: { distanceKm?: number; durationMinutes?: number } | null;
  fare: { estimatedFare: number; finalFare?: number | null };
  dispatch?: {
    mode?: "automatic" | "manual";
    status?: "searching" | "offering" | "accepted" | "exhausted";
    attemptCount?: number;
    nextAttemptAt?: string | null;
    offers?: {
      driver?: string;
      status?: "offered" | "accepted" | "rejected" | "expired" | "lost";
      expiresAt?: string;
    }[];
  };
}

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "accepted", label: "Accepted" },
  { value: "arriving_at_pickup", label: "Arriving at pickup" },
  { value: "arrived_at_pickup", label: "Arrived at pickup" },
  { value: "picked_up", label: "Picked up" },
  { value: "in_transit", label: "In transit" },
  { value: "arrived_at_drop", label: "Arrived at drop" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const cardClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm";

const fieldClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100";

const tableHeading =
  "whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-[9px] font-extrabold uppercase tracking-[.09em] text-slate-500";

const tableCell =
  "border-b border-slate-100 px-3 py-3 align-middle text-xs leading-5 text-slate-700";

function statusLabel(status: string) {
  return (status || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPrice(amount?: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? Number(amount) : 0);
}

function formatDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401) {
      return "Your session may have expired. Please log in again.";
    }

    if (status === 403) {
      return "You do not have permission to manage bookings.";
    }

    if (status === 429) {
      return "Too many requests. Wait a moment, then try again.";
    }

    return (
      error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Cannot connect to Safar API. Check that the backend is running."
        : fallback)
    );
  }

  return error instanceof Error ? error.message : fallback;
}

function getCustomerName(customer: Booking["customer"]) {
  return typeof customer === "object" && customer
    ? customer.name || "Customer"
    : typeof customer === "string" && customer
      ? customer
      : "Customer";
}

function getCustomerContact(customer: Booking["customer"]) {
  return typeof customer === "object" && customer
    ? customer.email || customer.phone || "Contact unavailable"
    : "Contact unavailable";
}

function getDriverName(driver: Booking["driver"]) {
  return typeof driver === "object" && driver
    ? driver.name || "Assigned driver"
    : typeof driver === "string" && driver
      ? driver
      : "Not assigned";
}

function getVehicleName(vehicle: Booking["vehicle"]) {
  if (typeof vehicle === "object" && vehicle) {
    return vehicle.name || "Vehicle unavailable";
  }

  return typeof vehicle === "string" && vehicle
    ? vehicle
    : "Vehicle unavailable";
}

function getVehicle(vehicle: Booking["vehicle"]): Vehicle | null {
  return typeof vehicle === "object" && vehicle ? vehicle : null;
}

function isActiveBooking(status: BookingStatus) {
  return [
    "assigned",
    "accepted",
    "arriving_at_pickup",
    "arrived_at_pickup",
    "picked_up",
    "in_transit",
    "arrived_at_drop",
  ].includes(status);
}

function statusClasses(status: BookingStatus) {
  if (status === "delivered") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "cancelled") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function StatCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: ReactNode;
  tone: "orange" | "amber" | "blue" | "green";
}) {
  const tones = {
    orange: "bg-orange-50 text-orange-600",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
  };

  return (
    <article className={`${cardClass} min-w-0 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{label}</p>

          <p className="mt-2 break-words text-2xl font-black tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            {note}
          </p>
        </div>

        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          {icon}
        </span>
      </div>
    </article>
  );
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [assigningBookingId, setAssigningBookingId] =
    useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [selectedDrivers, setSelectedDrivers] =
    useState<Record<string, string>>({});

  const [trackingBookingId, setTrackingBookingId] =
    useState<string | null>(null);

  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBookings = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    setPageError("");

    try {
      const response = await api.get("/bookings/admin/queue", {
        params: { status: "all", limit: 100 },
      });

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || "Unable to load bookings."
        );
      }

      const rows = Array.isArray(response.data.bookings)
        ? response.data.bookings
        : [];

      setBookings(rows);

      setAvailableDrivers(
        Array.isArray(response.data.availableDrivers)
          ? response.data.availableDrivers
          : []
      );

      setTotalBookings(response.data.pagination?.total ?? rows.length);
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, "Unable to load bookings."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const pendingCount = bookings.filter(
    (booking) => booking.status === "pending"
  ).length;

  const activeCount = bookings.filter((booking) =>
    isActiveBooking(booking.status)
  ).length;

  const deliveredCount = bookings.filter(
    (booking) => booking.status === "delivered"
  ).length;

  const cancelledCount = bookings.filter(
    (booking) => booking.status === "cancelled"
  ).length;

  const deliveredFareTotal = bookings
    .filter((booking) => booking.status === "delivered")
    .reduce(
      (sum, booking) =>
        sum + (booking.fare?.finalFare ?? booking.fare?.estimatedFare ?? 0),
      0
    );

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;

      const matchesSearch =
        !term ||
        (booking.bookingCode || "").toLowerCase().includes(term) ||
        getCustomerName(booking.customer).toLowerCase().includes(term) ||
        getCustomerContact(booking.customer).toLowerCase().includes(term) ||
        getVehicleName(booking.vehicle).toLowerCase().includes(term) ||
        (booking.pickup?.address || "").toLowerCase().includes(term) ||
        (booking.drop?.address || "").toLowerCase().includes(term) ||
        (booking.package?.description || "").toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [bookings, search, statusFilter]);

  async function handleAssignDriver(booking: Booking) {
    const driverUserId = selectedDrivers[booking._id];

    if (!driverUserId) {
      setPageError("Select an available driver before assigning the booking.");
      return;
    }

    if (booking.status !== "pending" || booking.driver) {
      setPageError("Only pending, unassigned bookings can be assigned.");
      return;
    }

    const driver = availableDrivers.find(
      (item) => item.userId === driverUserId
    );

    if (!driver) {
      setPageError(
        "The selected driver is no longer available. Refresh the list."
      );
      return;
    }

    const weight = booking.package?.weightKg ?? 0;

    if (driver.vehicleCapacityKg < weight) {
      setPageError(
        `${driver.name}'s vehicle cannot carry this package weight.`
      );
      return;
    }

    const vehicle = getVehicle(booking.vehicle);

    if (vehicle?.slug && driver.vehicleType !== vehicle.slug) {
      setPageError(
        `The selected driver vehicle type does not match ${
          vehicle.name || "the booking vehicle"
        }.`
      );
      return;
    }

    if (!window.confirm(`Assign ${booking.bookingCode} to ${driver.name}?`)) {
      return;
    }

    setAssigningBookingId(booking._id);
    setPageError("");
    setNotice("");

    try {
      const response = await api.patch(
        `/bookings/admin/${booking._id}/assign`,
        { driverUserId }
      );

      setNotice(
        response.data?.message || "Driver assigned successfully."
      );

      setSelectedDrivers((current) => {
        const next = { ...current };
        delete next[booking._id];
        return next;
      });

      await loadBookings(true);
    } catch (error: unknown) {
      setPageError(
        getErrorMessage(error, "Unable to assign this driver.")
      );
    } finally {
      setAssigningBookingId(null);
    }
  }

  function eligibleDriversFor(booking: Booking) {
    const vehicle = getVehicle(booking.vehicle);
    const weight = booking.package?.weightKg ?? 0;

    return availableDrivers.filter(
      (driver) =>
        driver.vehicleCapacityKg >= weight &&
        (!vehicle?.slug || driver.vehicleType === vehicle.slug)
    );
  }

  return (
    <main className="w-full min-w-0 space-y-5 px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
      {/* PAGE HEADER */}

      <section className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-orange-600">
            Admin operations
          </p>

          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Bookings &amp; dispatch
          </h1>

          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500 sm:text-sm">
            View every booking in one table, monitor delivery status and assign
            compatible online drivers to pending bookings.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing || loading}
          onClick={() => void loadBookings(true)}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh bookings
        </button>
      </section>

      {/* ALERTS */}

      {pageError && (
        <div
          role="alert"
          className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 sm:flex-row sm:items-center"
        >
          <span className="flex min-w-0 items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">{pageError}</span>
          </span>

          <button
            type="button"
            onClick={() => void loadBookings(true)}
            className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 font-bold"
          >
            Try again
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex min-w-0 items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{notice}</span>
        </div>
      )}

      {/* SUMMARY CARDS */}

      <section
        aria-label="Booking summary"
        className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <StatCard
          label="Total bookings"
          value={loading ? "—" : totalBookings.toLocaleString("en-IN")}
          note="Total recorded by API"
          icon={<Package className="h-4 w-4" />}
          tone="orange"
        />

        <StatCard
          label="Pending assignments"
          value={loading ? "—" : pendingCount}
          note="Waiting for driver"
          icon={<Clock3 className="h-4 w-4" />}
          tone="amber"
        />

        <StatCard
          label="Active deliveries"
          value={loading ? "—" : activeCount}
          note="Assigned or in progress"
          icon={<Truck className="h-4 w-4" />}
          tone="blue"
        />

        <StatCard
          label="Available drivers"
          value={loading ? "—" : availableDrivers.length}
          note="Eligible online drivers"
          icon={<Users className="h-4 w-4" />}
          tone="green"
        />
      </section>

      {/* SEARCH AND FILTER */}

      <section className={`${cardClass} min-w-0 p-3 sm:p-4`}>
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative block min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search booking, customer, vehicle or location..."
              aria-label="Search bookings"
              className={`${fieldClass} pl-10`}
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            aria-label="Filter bookings by status"
            className={fieldClass}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            {loading
              ? "Loading bookings..."
              : `Showing ${filteredBookings.length} of ${bookings.length} loaded bookings`}
          </span>

          <div className="flex flex-wrap items-center gap-3">
            <span>{deliveredCount} delivered</span>
            <span>{cancelledCount} cancelled</span>
            <span>Delivered fare: {formatPrice(deliveredFareTotal)}</span>

            {(search || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="font-bold text-orange-700 hover:text-orange-800"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* BOOKING TABLE */}

      <section className={`${cardClass} min-w-0 overflow-hidden`}>
        <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              Booking records
            </h2>

            <p className="mt-0.5 text-[11px] text-slate-500">
              One booking per row with its key information.
            </p>
          </div>

          <span className="text-[10px] font-semibold text-slate-400">
            Latest 100 records from the admin queue
          </span>
        </div>

        {/* Horizontal scroll stays inside this table container on mobile. */}

        <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[1120px] table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width: "13%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "21%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>

            <thead>
              <tr>
                <th className={tableHeading}>Booking / created</th>
                <th className={tableHeading}>Customer</th>
                <th className={tableHeading}>Pickup / drop</th>
                <th className={tableHeading}>Vehicle / package</th>
                <th className={tableHeading}>Fare / payment</th>
                <th className={tableHeading}>Status</th>
                <th className={tableHeading}>Driver / assignment</th>
                <th className={`${tableHeading} text-center`}>Details</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-xs text-slate-500"
                  >
                    <RefreshCw className="mr-2 inline h-4 w-4 animate-spin text-orange-500" />
                    Loading booking records...
                  </td>
                </tr>
              )}

              {!loading &&
                filteredBookings.map((booking) => {
                  const vehicle = getVehicle(booking.vehicle);
                  const selectedDriverId = selectedDrivers[booking._id] || "";
                  const eligibleDrivers = eligibleDriversFor(booking);
                  const isAssigning = assigningBookingId === booking._id;
                  const fare =
                    booking.fare?.finalFare ??
                    booking.fare?.estimatedFare;
                  const driverAssigned = Boolean(booking.driver);
                  const activeOfferCount = (booking.dispatch?.offers || []).filter(
                    (offer) =>
                      offer.status === "offered" &&
                      (!offer.expiresAt || new Date(offer.expiresAt).getTime() > Date.now())
                  ).length;

                  return (
                    <Fragment key={booking._id}>
                      <tr className="align-middle transition-colors hover:bg-orange-50/40">
                        {/* BOOKING */}

                        <td className={`${tableCell} min-w-0`}>
                          <p className="break-words font-extrabold leading-4 text-slate-900">
                            {booking.bookingCode || booking._id}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            ID: {booking._id.slice(-8)}
                          </p>

                          <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
                            {formatDate(booking.createdAt)}
                          </p>
                        </td>

                        {/* CUSTOMER */}

                        <td className={`${tableCell} min-w-0`}>
                          <p className="break-words font-bold text-slate-900">
                            {getCustomerName(booking.customer)}
                          </p>

                          <p className="mt-1 break-all text-[10px] leading-4 text-slate-500">
                            {getCustomerContact(booking.customer)}
                          </p>
                        </td>

                        {/* PICKUP / DROP */}

                        <td className={`${tableCell} min-w-0`}>
                          <p className="break-words leading-4 [overflow-wrap:anywhere]">
                            <MapPin className="mr-1 inline h-3 w-3 text-emerald-600" />
                            {booking.pickup?.address || "Pickup unavailable"}
                          </p>

                          <p className="mt-2 break-words leading-4 [overflow-wrap:anywhere]">
                            <MapPin className="mr-1 inline h-3 w-3 text-orange-600" />
                            {booking.drop?.address || "Drop unavailable"}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            {booking.route?.distanceKm ?? "—"} km ·{" "}
                            {booking.route?.durationMinutes ?? "—"} min
                          </p>
                        </td>

                        {/* VEHICLE / PACKAGE */}

                        <td className={`${tableCell} min-w-0`}>
                          <p className="break-words font-bold text-slate-900">
                            {vehicle?.name || getVehicleName(booking.vehicle)}
                          </p>

                          <p className="mt-1 break-words text-[10px] leading-4 text-slate-600">
                            {booking.package?.description || "Package unavailable"}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            {booking.package?.weightKg ?? 0} kg
                          </p>
                        </td>

                        {/* FARE / PAYMENT */}

                        <td className={`${tableCell} min-w-0`}>
                          <p className="break-words font-extrabold text-slate-900">
                            {formatPrice(fare)}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-500">
                            {booking.fare?.finalFare == null ? "Estimated" : "Final"}
                          </p>

                          <p className="mt-1 break-words text-[10px] leading-4 text-slate-500">
                            {statusLabel(booking.paymentStatus || "unknown")}

                            {booking.paymentMethod
                              ? ` · ${statusLabel(booking.paymentMethod)}`
                              : ""}
                          </p>
                        </td>

                        {/* STATUS */}

                        <td className={tableCell}>
                          <span
                            className={`inline-flex max-w-full justify-center rounded-full border px-2 py-1 text-center text-[9px] font-extrabold leading-3 ${statusClasses(booking.status)}`}
                          >
                            {statusLabel(booking.status)}
                          </span>
                          {booking.status === "pending" && (
                            <p className="mt-1.5 max-w-[110px] text-[9px] leading-3 text-slate-500">
                              Dispatch: {statusLabel(booking.dispatch?.status || "searching")}
                              {booking.dispatch?.status === "offering" ? ` · ${activeOfferCount} active offer(s)` : ""}
                            </p>
                          )}
                        </td>

                        {/* DRIVER / ASSIGNMENT */}

                        <td className={`${tableCell} min-w-0`}>
                          {driverAssigned || booking.status !== "pending" ? (
                            <>
                              <p className="break-words font-bold text-slate-800">
                                {getDriverName(booking.driver)}
                              </p>

                              {booking.driver &&
                                isActiveBooking(booking.status) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTrackingBookingId((current) =>
                                        current === booking._id
                                          ? null
                                          : booking._id
                                      )
                                    }
                                    className="mt-1 text-[10px] font-bold text-blue-700 hover:text-blue-900"
                                  >
                                    {trackingBookingId === booking._id
                                      ? "Hide live location"
                                      : "View live location"}
                                  </button>
                                )}

                              {!booking.driver && (
                                <p className="mt-1 text-[10px] leading-4 text-slate-400">
                                  Not assigned
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="min-w-0 space-y-1.5">
                              <select
                                aria-label={`Select driver for ${booking.bookingCode}`}
                                value={selectedDriverId}
                                onChange={(event) =>
                                  setSelectedDrivers((current) => ({
                                    ...current,
                                    [booking._id]: event.target.value,
                                  }))
                                }
                                className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                              >
                                <option value="">Select driver</option>

                                {eligibleDrivers.map((driver) => (
                                  <option
                                    key={driver.userId}
                                    value={driver.userId}
                                  >
                                    {driver.name}
                                  </option>
                                ))}
                              </select>

                              <p className="text-[9px] leading-3 text-slate-500">
                                {eligibleDrivers.length} of {availableDrivers.length} online driver(s) match this vehicle and {Number(booking.package?.weightKg || 0).toLocaleString("en-IN")} kg load.
                              </p>

                              <button
                                type="button"
                                disabled={
                                  isAssigning ||
                                  !selectedDriverId ||
                                  eligibleDrivers.length === 0
                                }
                                onClick={() => void handleAssignDriver(booking)}
                                className="inline-flex min-h-7 w-full items-center justify-center gap-1 rounded-lg bg-orange-500 px-2 py-1 text-[10px] font-extrabold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                {isAssigning && (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                )}

                                {isAssigning ? "Assigning" : "Assign driver"}
                              </button>

                              {eligibleDrivers.length === 0 && (
                                <p className="text-[9px] leading-3 text-amber-700">
                                  No eligible driver
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* DETAILS */}

                        <td className={`${tableCell} text-center`}>
                          <button
                            type="button"
                            onClick={() => setSelectedBooking(booking)}
                            className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-extrabold text-slate-700 transition hover:border-orange-300 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-100"
                          >
                            View <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>

                      {/* EXPANDABLE LIVE TRACKING ROW */}

                      {trackingBookingId === booking._id &&
                        booking.driver &&
                        isActiveBooking(booking.status) && (
                          <tr>
                            <td
                              colSpan={8}
                              className="border-b border-slate-100 bg-slate-50 p-3 sm:p-4"
                            >
                              <AdminBookingTracking
                                bookingId={booking._id}
                                bookingCode={booking.bookingCode}
                                status={booking.status}
                                onClose={() => setTrackingBookingId(null)}
                              />
                            </td>
                          </tr>
                        )}
                    </Fragment>
                  );
                })}

              {!loading && filteredBookings.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-14 text-center text-xs text-slate-500"
                  >
                    <Package className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                    No matching bookings. Try another search or status filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-1 border-t border-slate-200 px-4 py-3 text-[10px] text-slate-400 sm:flex-row sm:items-center">
          <span>
            {filteredBookings.length} matching row(s) ·{" "}
            {availableDrivers.length} online driver(s)
          </span>

          <span>
            Total records reported by API:{" "}
            {totalBookings.toLocaleString("en-IN")}
          </span>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Weight className="h-3.5 w-3.5" />
          Driver assignment checks vehicle type and package capacity.
        </span>

        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Backend confirms successful assignment.
        </span>
      </section>

      {/* BOOKING DETAILS POPUP */}

      {selectedBooking && (
        <AdminBookingDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </main>
  );
}
