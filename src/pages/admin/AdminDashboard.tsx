import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { isAxiosError } from "axios";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  Weight,
} from "lucide-react";

import api from "../../services/api";
import AdminBookingDetailsModal from "../../components/admin/AdminBookingDetailsModal";
import { useAuth } from "../../context/AuthContext";

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
  pickup: { address: string };
  drop: { address: string };
  package: {
    description: string;
    weightKg: number;
    specialInstructions?: string;
  };
  route: { distanceKm: number; durationMinutes: number };
  fare: { estimatedFare: number; finalFare?: number | null };
}

const statusLabel = (status: string) =>
  (status || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatPrice = (amount?: number | null) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? Number(amount) : 0);

const formatDate = (value?: string) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function statusClasses(status: string) {
  if (status === "delivered") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Cannot connect to Safar API. Check that the backend is running."
        : fallback)
    );
  }
  return error instanceof Error ? error.message : fallback;
}

function customerName(customer: Booking["customer"]) {
  return customer && typeof customer === "object"
    ? customer.name || "Customer"
    : "Customer";
}

function customerContact(customer: Booking["customer"]) {
  return customer && typeof customer === "object"
    ? customer.email || customer.phone || "Contact unavailable"
    : "Contact unavailable";
}

function driverName(driver: Booking["driver"]) {
  return driver && typeof driver === "object"
    ? driver.name || "Assigned driver"
    : driver
      ? "Assigned driver"
      : "Not assigned";
}

function vehicleName(vehicle: Booking["vehicle"]) {
  if (vehicle && typeof vehicle === "object") return vehicle.name || "Vehicle unavailable";
  return typeof vehicle === "string" && vehicle ? vehicle : "Vehicle unavailable";
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

const tableCell =
  "px-2.5 py-3 align-top text-xs leading-5 text-slate-700 [overflow-wrap:anywhere]";
const tableHeading =
  "px-2.5 py-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDashboard = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setPageError("");

    try {
      const response = await api.get("/bookings/admin/queue", {
        params: { status: "all", limit: 100 },
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || "Unable to load the admin dashboard.");
      }

      const rows = Array.isArray(response.data.bookings) ? response.data.bookings : [];
      setBookings(rows);
      setAvailableDrivers(
        Array.isArray(response.data.availableDrivers)
          ? response.data.availableDrivers
          : [],
      );
      setTotalBookings(Number(response.data.pagination?.total ?? rows.length));
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, "Unable to load the admin dashboard."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const pendingCount = bookings.filter((booking) => booking.status === "pending").length;
  const activeCount = bookings.filter((booking) => isActiveBooking(booking.status)).length;
  const completedCount = bookings.filter((booking) => booking.status === "delivered").length;
  const cancelledCount = bookings.filter((booking) => booking.status === "cancelled").length;
  const completedFareTotal = bookings
    .filter((booking) => booking.status === "delivered")
    .reduce(
      (sum, booking) =>
        sum + (booking.fare?.finalFare ?? booking.fare?.estimatedFare ?? 0),
      0,
    );

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      const matchesSearch =
        !term ||
        (booking.bookingCode || "").toLowerCase().includes(term) ||
        customerName(booking.customer).toLowerCase().includes(term) ||
        (booking.pickup?.address || "").toLowerCase().includes(term) ||
        (booking.drop?.address || "").toLowerCase().includes(term) ||
        (booking.package?.description || "").toLowerCase().includes(term) ||
        vehicleName(booking.vehicle).toLowerCase().includes(term);

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

    const driver = availableDrivers.find((item) => item.userId === driverUserId);
    if (!driver) {
      setPageError("The selected driver is no longer available. Refresh the list.");
      return;
    }
    if (driver.vehicleCapacityKg < (booking.package?.weightKg || 0)) {
      setPageError(`${driver.name}'s vehicle cannot carry this package weight.`);
      return;
    }

    const vehicle =
      typeof booking.vehicle === "object" && booking.vehicle ? booking.vehicle : null;
    if (vehicle?.slug && driver.vehicleType !== vehicle.slug) {
      setPageError(
        `The selected driver vehicle type does not match ${vehicle.name || "the booking vehicle"}.`,
      );
      return;
    }

    if (!window.confirm(`Assign ${booking.bookingCode} to ${driver.name}?`)) return;

    setAssigningBookingId(booking._id);
    setPageError("");
    setNotice("");

    try {
      const response = await api.patch(`/bookings/admin/${booking._id}/assign`, {
        driverUserId,
      });
      setNotice(response.data?.message || "Driver assigned successfully.");
      setSelectedDrivers((current) => {
        const next = { ...current };
        delete next[booking._id];
        return next;
      });
      await loadDashboard(true);
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, "Unable to assign this driver."));
    } finally {
      setAssigningBookingId(null);
    }
  }

  function getEligibleDrivers(booking: Booking) {
    const vehicle =
      typeof booking.vehicle === "object" && booking.vehicle ? booking.vehicle : null;

    return availableDrivers.filter(
      (driver) =>
        driver.vehicleCapacityKg >= (booking.package?.weightKg || 0) &&
        (!vehicle?.slug || driver.vehicleType === vehicle.slug),
    );
  }

  function renderDriverAssignment(booking: Booking, compact = false) {
    const eligibleDrivers = getEligibleDrivers(booking);
    const selectedDriverId = selectedDrivers[booking._id] || "";
    const canAssign = booking.status === "pending" && !booking.driver;
    const isAssigning = assigningBookingId === booking._id;

    if (!canAssign) {
      return (
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{driverName(booking.driver)}</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            {booking.status === "pending"
              ? "Already assigned or awaiting dispatch."
              : "Assignment is available only for pending, unassigned bookings."}
          </p>
        </div>
      );
    }

    return (
      <div className="min-w-0 space-y-2">
        <p className="text-[11px] leading-4 text-slate-500">
          {eligibleDrivers.length > 0
            ? `${eligibleDrivers.length} eligible online driver(s)`
            : "No matching online driver"}
        </p>
        <select
          value={selectedDriverId}
          onChange={(event) =>
            setSelectedDrivers((current) => ({
              ...current,
              [booking._id]: event.target.value,
            }))
          }
          aria-label={`Select driver for ${booking.bookingCode}`}
          className="min-h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        >
          <option value="">Choose driver</option>
          {eligibleDrivers.map((driver) => (
            <option key={driver.userId} value={driver.userId}>
              {driver.name} · {driver.vehicleCapacityKg} kg
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isAssigning || !selectedDriverId || eligibleDrivers.length === 0}
          onClick={() => void handleAssignDriver(booking)}
          className={`inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg bg-orange-500 px-2 py-2 font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 ${compact ? "text-[11px]" : "text-xs"}`}
        >
          {isAssigning && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          {isAssigning ? "Assigning…" : "Assign driver"}
        </button>
      </div>
    );
  }

  const metrics = [
    {
      label: "Total bookings",
      value: loading ? "—" : totalBookings.toLocaleString("en-IN"),
      note: "All recorded bookings",
      icon: <Package className="h-5 w-5" />,
      tone: "orange",
    },
    {
      label: "Pending assignments",
      value: loading ? "—" : pendingCount,
      note: "Waiting for a driver",
      icon: <Clock3 className="h-5 w-5" />,
      tone: "amber",
    },
    {
      label: "Active deliveries",
      value: loading ? "—" : activeCount,
      note: "Assigned or in progress",
      icon: <Truck className="h-5 w-5" />,
      tone: "blue",
    },
    {
      label: "Available drivers",
      value: loading ? "—" : availableDrivers.length,
      note: "Eligible and online",
      icon: <Users className="h-5 w-5" />,
      tone: "green",
    },
    {
      label: "Delivered / cancelled",
      value: loading ? "—" : `${completedCount} / ${cancelledCount}`,
      note: "In the loaded result set",
      icon: <CheckCircle2 className="h-5 w-5" />,
      tone: "green",
    },
    {
      label: "Delivered booking fare",
      value: loading ? "—" : formatPrice(completedFareTotal),
      note: "Fare total, not reconciled revenue",
      icon: <Weight className="h-5 w-5" />,
      tone: "orange",
    },
  ] as const;

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 text-slate-900">
      <main className="mx-auto w-full max-w-[1600px] min-w-0 space-y-6 px-3 py-5 sm:px-5 sm:py-7 lg:px-6 lg:py-8">
        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#101c30] via-[#172943] to-[#252a35] p-5 text-white shadow-xl sm:p-7 lg:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-orange-300">
                Operations overview
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Welcome, {user?.name || "Administrator"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Manage deliveries, assign available drivers and monitor the booking workflow from one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin/driver-approvals"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold transition hover:bg-white/10"
              >
                <ShieldCheck className="h-4 w-4 text-orange-300" />
                Driver approvals
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                disabled={refreshing || loading}
                onClick={() => void loadDashboard(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {pageError && (
          <div
            role="alert"
            className="flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center"
          >
            <span>{pageError}</span>
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              className="shrink-0 rounded-lg border border-red-200 px-3 py-2 font-bold"
            >
              Try again
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}

        <section aria-label="Operations metrics">
          <div className="mb-4">
            <h2 className="text-xl font-black">Operations summary</h2>
            <p className="mt-1 text-sm text-slate-500">
              Live operational metrics based on the latest booking data returned by the API.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => (
              <article
                key={metric.label}
                className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-500">{metric.label}</p>
                    <p className="mt-3 break-words text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                      {metric.value}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{metric.note}</p>
                  </div>
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      metric.tone === "orange"
                        ? "bg-orange-50 text-orange-600"
                        : metric.tone === "amber"
                          ? "bg-amber-50 text-amber-700"
                          : metric.tone === "blue"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {metric.icon}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-label="Available drivers">
          <div className="mb-4">
            <h2 className="text-xl font-black">Available drivers</h2>
            <p className="mt-1 text-sm text-slate-500">
              Approved drivers who are active and currently available.
            </p>
          </div>

          {!loading && availableDrivers.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No online drivers available. Check driver approval, activity and availability settings.
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
                <table className="w-full table-fixed text-left">
                  <colgroup>
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "15%" }} />
                  </colgroup>
                  <thead className="bg-slate-100">
                    <tr>
                      <th className={tableHeading}>Driver</th>
                      <th className={tableHeading}>Contact</th>
                      <th className={tableHeading}>Vehicle</th>
                      <th className={tableHeading}>Registration</th>
                      <th className={tableHeading}>Capacity</th>
                      <th className={tableHeading}>Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>
                          Loading drivers…
                        </td>
                      </tr>
                    ) : (
                      availableDrivers.map((driver) => (
                        <tr key={driver.userId} className="align-top transition hover:bg-orange-50/40">
                          <td className={`${tableCell} font-bold`}>
                            <UserRound className="mr-1 inline h-3.5 w-3.5 text-emerald-700" />
                            {driver.name}
                          </td>
                          <td className={tableCell}>
                            <span className="block">{driver.email}</span>
                            <span className="mt-1 block text-[11px] text-slate-500">
                              {driver.phone || "Phone unavailable"}
                            </span>
                          </td>
                          <td className={tableCell}>{driver.vehicleMakeModel || driver.vehicleType}</td>
                          <td className={tableCell}>{driver.vehicleRegistration || "—"}</td>
                          <td className={tableCell}>
                            <Weight className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                            {Number(driver.vehicleCapacityKg || 0).toLocaleString("en-IN")} kg
                          </td>
                          <td className={tableCell}>
                            <span className="inline-flex max-w-full rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                              {statusLabel(driver.availability)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {loading ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                    Loading drivers…
                  </div>
                ) : (
                  availableDrivers.map((driver) => (
                    <article
                      key={driver.userId}
                      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <UserRound className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="break-words font-bold text-slate-900">{driver.name}</p>
                            <p className="break-all text-xs text-slate-500">{driver.email}</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                          {statusLabel(driver.availability)}
                        </span>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div className="min-w-0">
                          <dt className="text-slate-400">Vehicle</dt>
                          <dd className="mt-1 break-words font-semibold text-slate-700">
                            {driver.vehicleMakeModel || driver.vehicleType}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-slate-400">Registration</dt>
                          <dd className="mt-1 break-all font-semibold text-slate-700">
                            {driver.vehicleRegistration || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Capacity</dt>
                          <dd className="mt-1 font-semibold text-slate-700">
                            {Number(driver.vehicleCapacityKg || 0).toLocaleString("en-IN")} kg
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-slate-400">Phone</dt>
                          <dd className="mt-1 break-all font-semibold text-slate-700">
                            {driver.phone || "Unavailable"}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))
                )}
              </div>
            </>
          )}
        </section>

        <section aria-label="Bookings and driver assignments" className="min-w-0">
          <div className="mb-4">
            <h2 className="text-xl font-black">Bookings and assignments</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search, filter and assign compatible drivers to pending requests.
            </p>
          </div>

          <div className="mb-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block min-w-0">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search bookings"
                placeholder="Search booking, customer, vehicle or address…"
                className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              aria-label="Filter bookings by status"
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            >
              <option value="all">All statuses</option>
              {[
                "pending",
                "assigned",
                "accepted",
                "arriving_at_pickup",
                "arrived_at_pickup",
                "picked_up",
                "in_transit",
                "arrived_at_drop",
                "delivered",
                "cancelled",
              ].map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop / laptop: fixed-layout table with no forced 1180px minimum width. */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead className="bg-slate-100">
                <tr>
                  <th className={tableHeading}>Booking / created</th>
                  <th className={tableHeading}>Customer</th>
                  <th className={tableHeading}>Pickup / drop</th>
                  <th className={tableHeading}>Vehicle / package</th>
                  <th className={tableHeading}>Fare / payment</th>
                  <th className={tableHeading}>Status</th>
                  <th className={tableHeading}>Driver assignment</th>
                  <th className={`${tableHeading} text-center`}>Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
                      Loading bookings…
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking) => {
                    const fare = booking.fare?.finalFare ?? booking.fare?.estimatedFare;

                    return (
                      <tr
                        key={booking._id}
                        className="align-top transition hover:bg-orange-50/30"
                      >
                        <td className={tableCell}>
                          <p className="break-words font-black text-slate-900">
                            {booking.bookingCode || booking._id}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            ID: {booking._id.slice(-8)}
                          </p>
                          <p className="mt-2 text-[11px] leading-4 text-slate-500">
                            {formatDate(booking.createdAt)}
                          </p>
                        </td>
                        <td className={tableCell}>
                          <p className="font-bold text-slate-900">{customerName(booking.customer)}</p>
                          <p className="mt-1 break-all text-[11px] leading-4 text-slate-500">
                            {customerContact(booking.customer)}
                          </p>
                        </td>
                        <td className={tableCell}>
                          <p className="break-words">
                            <MapPin className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
                            {booking.pickup?.address || "Pickup unavailable"}
                          </p>
                          <p className="mt-2 break-words">
                            <MapPin className="mr-1 inline h-3.5 w-3.5 text-orange-600" />
                            {booking.drop?.address || "Drop unavailable"}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {booking.route?.distanceKm ?? "—"} km · {booking.route?.durationMinutes ?? "—"} min
                          </p>
                        </td>
                        <td className={tableCell}>
                          <p className="font-bold text-slate-900">{vehicleName(booking.vehicle)}</p>
                          <p className="mt-1 break-words text-[11px]">
                            {booking.package?.description || "Package unavailable"}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {booking.package?.weightKg ?? 0} kg
                          </p>
                        </td>
                        <td className={tableCell}>
                          <p className="font-black text-slate-900">{formatPrice(fare)}</p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {booking.fare?.finalFare == null ? "Estimated" : "Final"}
                          </p>
                          <p className="mt-1 break-words text-[10px] leading-4 text-slate-500">
                            {statusLabel(booking.paymentStatus || "unknown")}
                            {booking.paymentMethod ? ` · ${statusLabel(booking.paymentMethod)}` : ""}
                          </p>
                        </td>
                        <td className={tableCell}>
                          <span
                            className={`inline-flex max-w-full justify-center rounded-full border px-2 py-1 text-center text-[10px] font-bold leading-4 ${statusClasses(booking.status)}`}
                          >
                            {statusLabel(booking.status)}
                          </span>
                        </td>
                        <td className={tableCell}>{renderDriverAssignment(booking, true)}</td>
                        <td className={`${tableCell} text-center`}>
                          <button
                            type="button"
                            onClick={() => setSelectedBooking(booking)}
                            aria-label={`View booking ${booking.bookingCode}`}
                            className="inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-1.5 text-[11px] font-bold text-slate-700 transition hover:border-orange-300 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-100"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                {!loading && filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                      <Package className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                      No matching bookings. Try another search or status filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet: same booking data and actions, stacked without page-level side scrolling. */}
          <div className="grid min-w-0 gap-3 lg:hidden">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
                Loading bookings…
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                <Package className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                No matching bookings. Try another search or status filter.
              </div>
            ) : (
              filteredBookings.map((booking) => {
                const fare = booking.fare?.finalFare ?? booking.fare?.estimatedFare;

                return (
                  <article
                    key={booking._id}
                    className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-100 p-4">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-black text-slate-900">
                          {booking.bookingCode || booking._id}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">ID: {booking._id.slice(-8)}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatDate(booking.createdAt)}</p>
                      </div>
                      <span
                        className={`inline-flex max-w-[44%] shrink-0 justify-center rounded-full border px-2 py-1 text-center text-[10px] font-bold ${statusClasses(booking.status)}`}
                      >
                        {statusLabel(booking.status)}
                      </span>
                    </div>

                    <div className="grid min-w-0 gap-4 p-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                          Customer
                        </p>
                        <p className="mt-1 break-words text-sm font-bold text-slate-900">
                          {customerName(booking.customer)}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {customerContact(booking.customer)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                          Vehicle / package
                        </p>
                        <p className="mt-1 break-words text-sm font-bold text-slate-900">
                          {vehicleName(booking.vehicle)}
                        </p>
                        <p className="mt-1 break-words text-xs text-slate-500">
                          {booking.package?.description || "Package unavailable"} · {booking.package?.weightKg ?? 0} kg
                        </p>
                      </div>
                      <div className="min-w-0 sm:col-span-2">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                          Pickup
                        </p>
                        <p className="mt-1 break-words text-xs leading-5 text-slate-700">
                          {booking.pickup?.address || "Pickup unavailable"}
                        </p>
                        <p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                          Drop
                        </p>
                        <p className="mt-1 break-words text-xs leading-5 text-slate-700">
                          {booking.drop?.address || "Drop unavailable"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {booking.route?.distanceKm ?? "—"} km · {booking.route?.durationMinutes ?? "—"} min
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                          Fare / payment
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-900">{formatPrice(fare)}</p>
                        <p className="mt-1 break-words text-xs text-slate-500">
                          {booking.fare?.finalFare == null ? "Estimated" : "Final"} · {statusLabel(booking.paymentStatus || "unknown")}
                          {booking.paymentMethod ? ` · ${statusLabel(booking.paymentMethod)}` : ""}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                          Driver assignment
                        </p>
                        <div className="mt-1">{renderDriverAssignment(booking, true)}</div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 p-4">
                      <button
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-orange-300 hover:text-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-100"
                      >
                        View booking details <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {selectedBooking && (
          <AdminBookingDetailsModal
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
          />
        )}

        <footer className="flex min-w-0 flex-col justify-between gap-2 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500 sm:flex-row">
          <p>Safar Operations · Admin workspace</p>
          <p>
            Showing up to the latest 100 bookings. Total recorded bookings: {totalBookings.toLocaleString("en-IN")}.
          </p>
        </footer>
      </main>
    </div>
  );
}
