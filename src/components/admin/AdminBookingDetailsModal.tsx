import { useEffect, useState } from "react";
import api from "../../services/api";
import {
  CalendarDays,
  CreditCard,
  MapPin,
  Package,
  Truck,
  UserRound,
  Weight,
  X,
} from "lucide-react";

export interface AdminBookingDetailsPerson {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface AdminBookingDetailsData {
  _id: string;
  bookingCode?: string;
  status: string;
  createdAt?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  customer?: AdminBookingDetailsPerson | string | null;
  driver?: AdminBookingDetailsPerson | string | null;
  vehicle?: { name?: string; slug?: string; capacityKg?: number } | string | null;
  pickup?: { address?: string } | null;
  drop?: { address?: string } | null;
  package?: {
    description?: string;
    weightKg?: number;
    specialInstructions?: string;
  } | null;
  route?: { distanceKm?: number; durationMinutes?: number } | null;
  fare?: { estimatedFare?: number; finalFare?: number | null } | null;
}

interface AdminBookingDetailsModalProps {
  booking: AdminBookingDetailsData | null;
  onClose: () => void;
}

function readableStatus(value?: string) {
  return (value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPrice(value?: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? Number(value) : 0);
}

function getPersonName(value: AdminBookingDetailsPerson | string | null | undefined) {
  if (typeof value === "string") return value || "Not available";
  return value?.name || "Not available";
}

function getPersonEmail(value: AdminBookingDetailsPerson | string | null | undefined) {
  return typeof value === "object" && value ? value.email || "Not available" : "Not available";
}

function getPersonPhone(value: AdminBookingDetailsPerson | string | null | undefined) {
  return typeof value === "object" && value ? value.phone || "Not available" : "Not available";
}

function getVehicleName(value: AdminBookingDetailsData["vehicle"]) {
  if (typeof value === "string") return value || "Not available";
  return value?.name || "Not available";
}

function statusStyle(status: string) {
  if (status === "delivered") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "cancelled") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[155px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm leading-5 text-slate-800">{value || "Not available"}</dd>
    </div>
  );
}

export default function AdminBookingDetailsModal({
  booking,
  onClose,
}: AdminBookingDetailsModalProps) {
  const [refreshedBooking, setRefreshedBooking] = useState<AdminBookingDetailsData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState("");

  useEffect(() => {
    if (!booking?._id) return;

    const controller = new AbortController();
    setDetailLoading(true);
    setDetailLoadError("");

    api.get(`/bookings/${booking._id}`, { signal: controller.signal })
      .then((response) => {
        if (response.data?.success && response.data.booking) {
          setRefreshedBooking(response.data.booking as AdminBookingDetailsData);
        } else {
          setDetailLoadError("The latest booking details could not be refreshed. Showing the information loaded in the admin queue.");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDetailLoadError("The latest booking details could not be refreshed. Showing the information loaded in the admin queue.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });

    return () => controller.abort();
  }, [booking?._id]);

  useEffect(() => {
    if (!booking) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [booking, onClose]);

  if (!booking) return null;

  const details: AdminBookingDetailsData = refreshedBooking?._id === booking._id
    ? {
        ...booking,
        ...refreshedBooking,
        customer:
          typeof booking.customer === "object" && booking.customer &&
          typeof refreshedBooking.customer === "object" && refreshedBooking.customer
            ? { ...booking.customer, ...refreshedBooking.customer }
            : refreshedBooking.customer ?? booking.customer,
        driver:
          typeof booking.driver === "object" && booking.driver &&
          typeof refreshedBooking.driver === "object" && refreshedBooking.driver
            ? { ...booking.driver, ...refreshedBooking.driver }
            : refreshedBooking.driver ?? booking.driver,
        vehicle:
          typeof booking.vehicle === "object" && booking.vehicle &&
          typeof refreshedBooking.vehicle === "object" && refreshedBooking.vehicle
            ? { ...booking.vehicle, ...refreshedBooking.vehicle }
            : refreshedBooking.vehicle ?? booking.vehicle,
      }
    : booking;

  const fare = details.fare?.finalFare ?? details.fare?.estimatedFare;
  const paymentLabel = [
    readableStatus(details.paymentStatus),
    details.paymentMethod ? readableStatus(details.paymentMethod) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="admin-booking-details-title"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl sm:rounded-3xl"
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-orange-600">
              Booking details · Admin view
            </p>
            <h2
              id="admin-booking-details-title"
              className="mt-1 break-words text-base font-black text-slate-900 sm:text-lg"
            >
              {details.bookingCode || details._id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking details"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-orange-100"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {(detailLoading || detailLoadError) && (
            <div className="border-b border-slate-100 px-5 py-2 text-[11px] text-slate-500 sm:px-6" role="status">
              {detailLoading ? "Refreshing booking details…" : detailLoadError}
            </div>
          )}
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-orange-50/60 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${statusStyle(details.status)}`}>
                {readableStatus(details.status)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(details.createdAt)}
              </span>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {details.fare?.finalFare == null ? "Estimated fare" : "Final fare"}
              </p>
              <p className="text-2xl font-black text-slate-900">{formatPrice(fare)}</p>
              <p className="text-xs text-slate-500">{paymentLabel || "Payment status unavailable"}</p>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-6">
            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <UserRound className="h-4 w-4 text-orange-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Customer information</h3>
              </div>
              <dl>
                <DetailRow label="Customer name" value={getPersonName(details.customer)} />
                <DetailRow label="Email" value={getPersonEmail(details.customer)} />
                <DetailRow label="Phone" value={getPersonPhone(details.customer)} />
              </dl>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <Truck className="h-4 w-4 text-orange-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Vehicle and package</h3>
              </div>
              <dl>
                <DetailRow label="Vehicle" value={getVehicleName(details.vehicle)} />
                <DetailRow label="Package" value={details.package?.description || "Not available"} />
                <DetailRow label="Package weight" value={`${details.package?.weightKg ?? 0} kg`} />
                <DetailRow label="Vehicle capacity" value={typeof details.vehicle === "object" && details.vehicle?.capacityKg != null ? `${details.vehicle.capacityKg} kg` : "Not available"} />
              </dl>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <MapPin className="h-4 w-4 text-orange-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Route information</h3>
              </div>
              <dl>
                <DetailRow label="Pickup location" value={details.pickup?.address || "Not available"} />
                <DetailRow label="Drop location" value={details.drop?.address || "Not available"} />
                <DetailRow label="Distance" value={`${details.route?.distanceKm ?? 0} km`} />
                <DetailRow label="Estimated duration" value={`${details.route?.durationMinutes ?? 0} minutes`} />
              </dl>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <CreditCard className="h-4 w-4 text-orange-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Payment information</h3>
              </div>
              <dl>
                <DetailRow label="Estimated fare" value={formatPrice(details.fare?.estimatedFare)} />
                <DetailRow label="Final fare" value={details.fare?.finalFare == null ? "Not finalized" : formatPrice(details.fare.finalFare)} />
                <DetailRow label="Payment status" value={readableStatus(details.paymentStatus)} />
                <DetailRow label="Payment method" value={details.paymentMethod ? readableStatus(details.paymentMethod) : "Not available"} />
              </dl>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <Package className="h-4 w-4 text-orange-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Driver and additional information</h3>
              </div>
              <dl>
                <DetailRow label="Assigned driver" value={getPersonName(details.driver)} />
                <DetailRow label="Driver email" value={getPersonEmail(details.driver)} />
                <DetailRow label="Driver phone" value={getPersonPhone(details.driver)} />
                <DetailRow label="Booking ID" value={details._id} />
              </dl>
              {details.package?.specialInstructions && (
                <div className="border-t border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-900">Special instructions</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-amber-900">{details.package.specialInstructions}</p>
                </div>
              )}
              <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
                <Weight className="h-3.5 w-3.5" />
                Verify booking and payment data against the current booking record before taking administrative action.
              </div>
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end border-t border-slate-100 bg-white px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
          >
            Close details
          </button>
        </footer>
      </section>
    </div>
  );
}
