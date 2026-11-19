import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { isAxiosError } from "axios";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Package,
  RefreshCw,
  Truck,
  Wallet,
  Wifi,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

type DashboardBooking = {
  _id: string;
  bookingCode?: string;
  status: string;
  createdAt?: string;
  pickup?: { address?: string };
  drop?: { address?: string };
  fare?: { estimatedFare?: number; finalFare?: number | null };
  vehicle?: { name?: string } | string | null;
};
type OnlineDriver = { id: string; name: string; availability?: string; vehicleType?: string; vehicleMakeModel?: string; vehicleCapacityKg?: number };

function statusLabel(status: string) { return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function pillClass(status: string) {
  if (status === "delivered") return "lgp-pill lgp-pill-green";
  if (status === "cancelled") return "lgp-pill lgp-pill-red";
  if (status === "pending") return "lgp-pill lgp-pill-amber";
  return "lgp-pill lgp-pill-blue";
}
function vehicleName(vehicle: DashboardBooking["vehicle"]) {
  if (vehicle && typeof vehicle === "object" && vehicle.name) return vehicle.name;
  return typeof vehicle === "string" && vehicle ? vehicle : "—";
}
function shortPlace(address?: string) {
  if (!address) return "—";
  // Keep the first two parts of the address (e.g. "Shivajinagar, Pune") so the route reads cleanly.
  return address.split(",").map((part) => part.trim()).filter(Boolean).slice(0, 2).join(", ") || "—";
}
function formatDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
function formatCurrency(value?: number | null) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) return "Your session may have expired. Please log in again.";
    return error.response?.data?.message || (error.code === "ERR_NETWORK" ? "Cannot connect to Safar. Check that the backend server is running." : fallback);
  }
  return error instanceof Error ? error.message : fallback;
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [onlineDrivers, setOnlineDrivers] = useState<OnlineDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState("");

  const loadBookings = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true); else setLoading(true);
    setPageError("");
    try {
      const readList = (response: { data?: { bookings?: DashboardBooking[]; data?: { bookings?: DashboardBooking[] } } }) => {
        const list = response.data?.bookings ?? response.data?.data?.bookings ?? [];
        return Array.isArray(list) ? list : [];
      };
      const readTotal = (response: { data?: { pagination?: { total?: number }; data?: { pagination?: { total?: number } } } }, fallback: number) =>
        Number(response.data?.pagination?.total ?? response.data?.data?.pagination?.total ?? fallback);

      const [allRes, deliveredRes, cancelledRes] = await Promise.all([
        api.get("/bookings/my", { params: { page: 1, limit: 10 } }),
        api.get("/bookings/my", { params: { page: 1, limit: 50, status: "delivered" } }).catch(() => null),
        api.get("/bookings/my", { params: { page: 1, limit: 1, status: "cancelled" } }).catch(() => null),
      ]);
      if (allRes.data?.success === false) throw new Error(allRes.data?.message || "Unable to load your bookings.");

      const recent = readList(allRes);
      setBookings(recent);
      setTotalBookings(readTotal(allRes, recent.length));

      if (deliveredRes) {
        const delivered = readList(deliveredRes);
        setDeliveredCount(readTotal(deliveredRes, delivered.length));
        setTotalSpent(delivered.reduce((sum, item) => sum + Number(item.fare?.finalFare ?? item.fare?.estimatedFare ?? 0), 0));
      } else {
        const delivered = recent.filter((item) => item.status === "delivered");
        setDeliveredCount(delivered.length);
        setTotalSpent(delivered.reduce((sum, item) => sum + Number(item.fare?.finalFare ?? item.fare?.estimatedFare ?? 0), 0));
      }
      setCancelledCount(cancelledRes ? readTotal(cancelledRes, 0) : recent.filter((item) => item.status === "cancelled").length);
    } catch (error: unknown) { setPageError(getErrorMessage(error, "Unable to load your bookings.")); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const loadOnlineDrivers = useCallback(async () => {
    try {
      const response = await api.get("/drivers/online");
      if (response.data?.success === false) throw new Error(response.data?.message || "Unable to load driver availability.");
      const data = response.data?.drivers ?? response.data?.data?.drivers ?? [];
      setOnlineDrivers(Array.isArray(data) ? data : []); setDriversError("");
    } catch (error: unknown) { setDriversError(getErrorMessage(error, "Unable to load currently available drivers.")); }
    finally { setDriversLoading(false); }
  }, []);

  useEffect(() => { void loadBookings(); }, [loadBookings]);
  useEffect(() => {
    void loadOnlineDrivers();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void loadOnlineDrivers(); }, 15000);
    return () => window.clearInterval(interval);
  }, [loadOnlineDrivers]);

  const firstName = user?.name?.trim().split(/\s+/)[0] || "Customer";
  const recentBookings = useMemo(() => [...bookings].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()).slice(0, 5), [bookings]);
  const activeCount = Math.max(0, totalBookings - deliveredCount - cancelledCount);
  const dash = (value: string | number) => (loading ? "—" : value);

  const statCards = [
    { label: "Total Orders", value: dash(totalBookings), icon: ClipboardList, tone: "orange" },
    { label: "Active Orders", value: dash(activeCount), icon: Truck, tone: "amber" },
    { label: "Completed", value: dash(deliveredCount), icon: CheckCircle2, tone: "green" },
    { label: "Total Spent", value: dash(formatCurrency(totalSpent)), icon: Wallet, tone: "orange" },
  ] as const;

  return (
    <main className="lgp">
      <header className="lgp-head">
        <div>
          <h1>Welcome Back, {firstName}! <span aria-hidden="true">👋</span></h1>
          <p>Here&apos;s an overview of your deliveries</p>
        </div>
      </header>

      {pageError && (
        <div role="alert" className="lgp-alert">
          <p>{pageError}</p>
          <button type="button" onClick={() => void loadBookings(true)} disabled={refreshing}>
            <RefreshCw className={refreshing ? "lgp-spin" : ""} /> Retry
          </button>
        </div>
      )}

      <section className="lgp-stats" aria-label="Order summary">
        {statCards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="lgp-stat">
            <span className={`lgp-stat-icon lgp-tone-${tone}`}><Icon aria-hidden="true" /></span>
            <span className="lgp-stat-copy">
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
          </article>
        ))}
      </section>

      <section className="lgp-banner" aria-label="Book a delivery">
        <div>
          <h2>Need to send something?</h2>
          <p>Book a delivery now and get instant fare estimate.</p>
          <Link to="/customer/book" className="lgp-btn lgp-btn-primary">Book Delivery</Link>
        </div>
      </section>

      <section className="lgp-card" aria-labelledby="customer-recent-bookings">
        <header className="lgp-card-head">
          <h2 id="customer-recent-bookings">Recent Orders</h2>
          <Link to="/customer/orders" className="lgp-link">View All <ChevronRight aria-hidden="true" /></Link>
        </header>

        {loading ? (
          <div className="lgp-skeletons" aria-label="Loading bookings"><span /><span /><span /></div>
        ) : recentBookings.length === 0 ? (
          <div className="lgp-empty">
            <Package aria-hidden="true" />
            <p>No bookings yet</p>
            <small>Your first booking will appear here.</small>
            <Link to="/customer/book" className="lgp-btn lgp-btn-primary">Book now <ArrowRight aria-hidden="true" /></Link>
          </div>
        ) : (
          <div className="lgp-table-wrap">
            <table className="lgp-table">
              <thead>
                <tr><th>Order ID</th><th>Pickup → Drop</th><th>Vehicle</th><th>Status</th><th>Date</th><th>Action</th></tr>
              </thead>
              <tbody>
                {recentBookings.map((booking) => {
                  const isFinal = ["delivered", "cancelled"].includes(booking.status);
                  return (
                    <tr key={booking._id}>
                      <td data-label="Order ID"><strong>#{booking.bookingCode || booking._id.slice(-6).toUpperCase()}</strong></td>
                      <td data-label="Route">{shortPlace(booking.pickup?.address)} <span className="lgp-arrow">→</span> {shortPlace(booking.drop?.address)}</td>
                      <td data-label="Vehicle">{vehicleName(booking.vehicle)}</td>
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
      </section>

      <section className="lgp-card" aria-labelledby="customer-online-drivers">
        <header className="lgp-card-head">
          <h2 id="customer-online-drivers">Driver availability</h2>
          <span className="lgp-online"><Wifi aria-hidden="true" />{driversLoading ? "—" : onlineDrivers.length} online</span>
        </header>
        {driversError && <p role="status" className="lgp-note">{driversError}</p>}
        {driversLoading ? (
          <div className="lgp-skeletons"><span /><span /></div>
        ) : onlineDrivers.length === 0 ? (
          <div className="lgp-empty lgp-empty-sm">
            <Truck aria-hidden="true" />
            <p>No drivers shown as online</p>
            <small>Availability can change as drivers finish jobs or go offline.</small>
          </div>
        ) : (
          <ul className="lgp-drivers">
            {onlineDrivers.slice(0, 3).map((driver) => (
              <li key={driver.id}>
                <span className="lgp-stat-icon lgp-tone-green"><Truck aria-hidden="true" /></span>
                <div>
                  <strong>{driver.name} <em>Online</em></strong>
                  <small>
                    {driver.vehicleMakeModel || driver.vehicleType || "Delivery vehicle"}
                    {typeof driver.vehicleCapacityKg === "number" ? ` · Up to ${driver.vehicleCapacityKg.toLocaleString("en-IN")} kg` : ""}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
        <footer className="lgp-card-foot"><Clock3 aria-hidden="true" /> Refreshes automatically while this page is open.</footer>
      </section>
    </main>
  );
}
