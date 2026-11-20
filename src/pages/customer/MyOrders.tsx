import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { isAxiosError } from "axios";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Package,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import api from "../../services/api";

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

type FilterStatus = "all" | BookingStatus;

interface Booking {
  _id: string;
  bookingCode: string;
  status: BookingStatus;
  paymentStatus?: string;
  createdAt: string;
  vehicle?: { _id?: string; name?: string; capacityKg?: number } | string | null;
  pickup?: { address?: string };
  drop?: { address?: string };
  package?: { description?: string; weightKg?: number };
  route?: { distanceKm?: number; durationMinutes?: number };
  fare?: { currency?: string; estimatedFare?: number; finalFare?: number | null };
}

interface BookingPageResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

const formatPrice = (amount?: number | null) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(typeof amount === "number" && Number.isFinite(amount) ? amount : 0);

const formatDate = (value?: string) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const statusLabel = (status?: string) => (status || "unknown")
  .replaceAll("_", " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

function pillClass(status: string) {
  switch (status) {
    case "delivered": return "lgp-pill lgp-pill-green";
    case "cancelled": return "lgp-pill lgp-pill-red";
    case "pending": return "lgp-pill lgp-pill-amber";
    case "assigned":
    case "accepted":
    case "arriving_at_pickup":
    case "arrived_at_pickup":
    case "picked_up":
    case "in_transit":
    case "arrived_at_drop": return "lgp-pill lgp-pill-blue";
    default: return "lgp-pill lgp-pill-grey";
  }
}

type OrderTab = "all" | "active" | "completed" | "cancelled";

const FINAL_STATUSES: BookingStatus[] = ["delivered", "cancelled"];

function getErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) return "Your session may have expired. Please log in again.";
    return error.response?.data?.message || (error.code === "ERR_NETWORK"
      ? "Could not connect to Safar. Check that the backend server is running."
      : "Could not load your bookings.");
  }
  return error instanceof Error ? error.message : "Could not load your bookings.";
}

export default function MyOrders() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<OrderTab>("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<BookingPageResponse>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const requestId = useRef(0);

  const loadBookings = useCallback(async (targetPage: number, targetStatus: FilterStatus, targetSearch: string) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    const params: Record<string, string | number> = { page: targetPage, limit: PAGE_SIZE };
    if (targetStatus !== "all") params.status = targetStatus;
    if (targetSearch.trim()) params.search = targetSearch.trim();

    try {
      const response = await api.get("/bookings/my", { params });
      if (response.data?.success === false) throw new Error(response.data?.message || "Could not load your bookings.");
      const records = Array.isArray(response.data?.bookings) ? response.data.bookings : [];
      const serverPage = response.data?.pagination as BookingPageResponse | undefined;
      if (currentRequest !== requestId.current) return;
      setBookings(records);
      setPagination({
        page: Number(serverPage?.page ?? targetPage),
        limit: Number(serverPage?.limit ?? PAGE_SIZE),
        total: Number(serverPage?.total ?? records.length),
        totalPages: Number(serverPage?.totalPages ?? (records.length ? 1 : 0)),
      });
    } catch (requestError: unknown) {
      if (currentRequest === requestId.current) setError(getErrorMessage(requestError));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Completed and Cancelled are filtered by the server. "Active" is every booking that is not
  // delivered/cancelled, so it is filtered on the current page of results.
  const serverStatus: FilterStatus = tab === "completed" ? "delivered" : tab === "cancelled" ? "cancelled" : "all";

  useEffect(() => {
    void loadBookings(page, serverStatus, debouncedSearch);
  }, [page, serverStatus, debouncedSearch, loadBookings]);

  const startIndex = pagination.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, pagination.total);

  function changeTab(value: OrderTab) {
    setTab(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setTab("all");
    setPage(1);
  }

  const visibleBookings = tab === "active"
    ? bookings.filter((booking) => !FINAL_STATUSES.includes(booking.status))
    : bookings;
  const hasFilters = Boolean(debouncedSearch) || tab !== "all";

  const tabs: { id: OrderTab; label: string }[] = [
    { id: "all", label: "All Orders" },
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const vehicleLabel = (booking: Booking) =>
    typeof booking.vehicle === "object" && booking.vehicle
      ? booking.vehicle.name || "—"
      : typeof booking.vehicle === "string" && booking.vehicle
        ? booking.vehicle
        : "—";

  return (
    <main className="lgp">
      <header className="lgp-head lgp-head-split">
        <div>
          <h1>My Orders</h1>
          <p>View and manage all your deliveries</p>
        </div>
        <div className="lgp-head-actions">
          <label className="lgp-search">
            <Search aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search orders..."
              aria-label="Search all bookings"
            />
          </label>
          <Link to="/customer/book" className="lgp-btn lgp-btn-primary"><Package aria-hidden="true" /> Book Delivery</Link>
        </div>
      </header>

      <section className="lgp-card" aria-label="Your bookings">
        <div className="lgp-tabs" role="tablist" aria-label="Order status">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? "is-active" : ""}
              onClick={() => changeTab(item.id)}
            >
              {item.label}
            </button>
          ))}
          <span className="lgp-tabs-meta" aria-live="polite">
            {pagination.total === 0 ? "No matching bookings" : `Showing ${startIndex}–${endIndex} of ${pagination.total}`}
          </span>
          <button type="button" className="lgp-icon-btn" onClick={() => void loadBookings(page, serverStatus, debouncedSearch)} disabled={loading} aria-label="Refresh orders">
            <RefreshCw className={loading ? "lgp-spin" : ""} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div role="alert" className="lgp-alert lgp-alert-block">
            <XCircle aria-hidden="true" />
            <div>
              <strong>We couldn’t load your orders</strong>
              <p>{error}</p>
              <button type="button" onClick={() => void loadBookings(page, serverStatus, debouncedSearch)} disabled={loading}>
                <RefreshCw className={loading ? "lgp-spin" : ""} aria-hidden="true" /> Try again
              </button>
            </div>
          </div>
        )}

        {loading && !error && (
          <div className="lgp-skeletons" aria-label="Loading bookings" aria-live="polite"><span /><span /><span /><span /></div>
        )}

        {!loading && !error && visibleBookings.length === 0 && (
          <div className="lgp-empty">
            <Package aria-hidden="true" />
            <p>{!hasFilters && pagination.total === 0 ? "Your next move starts here" : "No matching bookings"}</p>
            <small>
              {!hasFilters && pagination.total === 0
                ? "Your delivery bookings will appear here after you create your first booking."
                : "Try a different booking code, address or tab."}
            </small>
            {!hasFilters && pagination.total === 0 ? (
              <Link to="/customer/book" className="lgp-btn lgp-btn-primary">Create your first booking <ArrowRight aria-hidden="true" /></Link>
            ) : (
              <button type="button" onClick={clearFilters} className="lgp-btn lgp-btn-ghost">Clear search and filters</button>
            )}
          </div>
        )}

        {!loading && !error && visibleBookings.length > 0 && (
          <div className="lgp-table-wrap">
            <table className="lgp-table lgp-table-orders">
              <thead>
                <tr><th>Order ID</th><th>Pickup → Drop</th><th>Vehicle</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr>
              </thead>
              <tbody>
                {visibleBookings.map((booking) => {
                  const fare = booking.fare?.finalFare ?? booking.fare?.estimatedFare;
                  const isFinal = FINAL_STATUSES.includes(booking.status);
                  return (
                    <tr key={booking._id}>
                      <td data-label="Order ID"><strong>#{booking.bookingCode || booking._id.slice(-6).toUpperCase()}</strong></td>
                      <td data-label="Route" className="lgp-route-cell">
                        <span><b>From</b>{booking.pickup?.address || "Pickup unavailable"}</span>
                        <span><b>To</b>{booking.drop?.address || "Drop unavailable"}</span>
                      </td>
                      <td data-label="Vehicle">
                        {vehicleLabel(booking)}
                        {booking.package?.description && <small className="lgp-muted-line">{booking.package.description}{typeof booking.package?.weightKg === "number" ? ` · ${booking.package.weightKg} kg` : ""}</small>}
                      </td>
                      <td data-label="Amount"><strong>{formatPrice(fare)}</strong></td>
                      <td data-label="Status"><span className={pillClass(booking.status)}>{statusLabel(booking.status)}</span></td>
                      <td data-label="Date">{formatDate(booking.createdAt)}</td>
                      <td data-label="Action"><Link to={`/customer/orders/${booking._id}`} className={`lgp-chip ${isFinal ? "" : "lgp-chip-accent"}`}>{isFinal ? "View" : "Track"}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && pagination.totalPages > 1 && (
          <nav aria-label="Booking history pages" className="lgp-pager">
            <p>Page <strong>{page}</strong> of <strong>{pagination.totalPages}</strong></p>
            <div>
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="lgp-btn lgp-btn-ghost"><ChevronLeft aria-hidden="true" /> Newer</button>
              <button type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages || loading} className="lgp-btn lgp-btn-primary">Older <ChevronRight aria-hidden="true" /></button>
            </div>
          </nav>
        )}
      </section>
    </main>
  );
}
