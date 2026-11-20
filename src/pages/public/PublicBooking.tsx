import { useEffect, useMemo, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Route,
  ShieldCheck,
  Truck,
  Wallet,
  Weight,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { PublicHeader, PublicFooter } from "../../components/layout/PublicChrome";
import CityPicker from "../../components/booking/CityPicker";
import LocationAutocomplete from "../../components/booking/LocationAutocomplete";
import { getSelectedCity, type CityOption } from "../../data/cities";

interface VehiclePricing {
  baseFare: number;
  perKmRate: number;
  perKgRate: number;
  minimumFare: number;
  serviceFee: number;
}

interface CatalogVehicle {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  capacityKg: number;
  imageUrl?: string | null;
  features: string[];
  pricing: VehiclePricing | null;
}

interface RouteLocation {
  address: string;
  longitude: number;
  latitude: number;
}

interface FareEstimate {
  success: boolean;
  message: string;
  route: {
    pickup: RouteLocation;
    drop: RouteLocation;
    distanceKm: number;
    durationMinutes: number;
  };
  vehicle: {
    id: string;
    name: string;
    capacityKg: number;
  };
  package: { weightKg: number };
  fare: {
    currency: string;
    baseFare: number;
    perKmRate: number;
    perKgRate: number;
    distanceCharge: number;
    weightCharge: number;
    serviceFee: number;
    subtotal: number;
    minimumFare: number;
    estimatedFare: number;
  };
}

interface VehicleAvailability {
  status: "available" | "unavailable";
  eligibleDriverCount: number;
  checkedAt: string;
  routeSpecific: false;
  message: string;
}

interface BookingDraft {
  pickupAddress: string;
  dropAddress: string;
  packageDescription: string;
  weightKg: string;
  specialInstructions: string;
  vehicleId: string;
  pickupLocationToken?: string;
  dropLocationToken?: string;
}

interface BookingCreateResponse {
  success: boolean;
  message: string;
  booking?: { _id: string; bookingCode?: string; status: string };
}

const DRAFT_KEY = "logigo.booking-draft.v1";

function readDraft(): BookingDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BookingDraft>;
    return {
      pickupAddress: typeof parsed.pickupAddress === "string" ? parsed.pickupAddress : "",
      dropAddress: typeof parsed.dropAddress === "string" ? parsed.dropAddress : "",
      packageDescription: typeof parsed.packageDescription === "string" ? parsed.packageDescription : "",
      weightKg: typeof parsed.weightKg === "string" ? parsed.weightKg : "10",
      specialInstructions: typeof parsed.specialInstructions === "string" ? parsed.specialInstructions : "",
      vehicleId: typeof parsed.vehicleId === "string" ? parsed.vehicleId : "",
      pickupLocationToken: typeof parsed.pickupLocationToken === "string" ? parsed.pickupLocationToken : "",
      dropLocationToken: typeof parsed.dropLocationToken === "string" ? parsed.dropLocationToken : "",
    };
  } catch {
    return null;
  }
}

function saveDraft(draft: BookingDraft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // The current form remains usable even if browser storage is unavailable.
  }
}

function clearDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing else is required if storage is unavailable.
  }
}

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Cannot connect to LogiGo. Check that the backend is running."
        : fallback)
    );
  }
  return error instanceof Error ? error.message : fallback;
}

const fieldClass =
  "mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100";
const cardClass =
  "rounded-3xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.045)]";

function PublicBooking() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const initialDraft = useMemo(() => readDraft(), []);

  const [vehicles, setVehicles] = useState<CatalogVehicle[]>([]);
  const [city, setCity] = useState<CityOption>(() => getSelectedCity());
  const [pickupAddress, setPickupAddress] = useState(initialDraft?.pickupAddress ?? "");
  const [dropAddress, setDropAddress] = useState(initialDraft?.dropAddress ?? "");
  const [pickupLocationToken, setPickupLocationToken] = useState(initialDraft?.pickupLocationToken ?? "");
  const [dropLocationToken, setDropLocationToken] = useState(initialDraft?.dropLocationToken ?? "");
  const [packageDescription, setPackageDescription] = useState(initialDraft?.packageDescription ?? "");
  const [weightKg, setWeightKg] = useState(initialDraft?.weightKg ?? "10");
  const [specialInstructions, setSpecialInstructions] = useState(initialDraft?.specialInstructions ?? "");
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialDraft?.vehicleId ?? "");

  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [vehicleError, setVehicleError] = useState("");
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [availability, setAvailability] = useState<VehicleAvailability | null>(null);
  const [estimateError, setEstimateError] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [notice, setNotice] = useState(
    initialDraft ? "Your saved booking details were restored. Recheck the fare and driver availability before confirming." : ""
  );
  const [isChecking, setIsChecking] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoadingVehicles(true);
    api
      .get<{ success: boolean; vehicles?: CatalogVehicle[]; message?: string }>("/vehicles")
      .then((response) => {
        if (!active) return;
        if (!response.data.success) {
          throw new Error(response.data.message || "Unable to load the vehicle catalog.");
        }
        const catalog = Array.isArray(response.data.vehicles) ? response.data.vehicles : [];
        setVehicles(catalog);
        if (selectedVehicleId && !catalog.some((vehicle) => vehicle._id === selectedVehicleId)) {
          setSelectedVehicleId("");
        }
      })
      .catch((error: unknown) => {
        if (active) setVehicleError(getErrorMessage(error, "Unable to load the vehicle catalog."));
      })
      .finally(() => {
        if (active) setIsLoadingVehicles(false);
      });

    return () => {
      active = false;
    };
    // Catalog is intentionally fetched once on page entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedVehicle = vehicles.find((vehicle) => vehicle._id === selectedVehicleId);
  const parsedWeight = Number(weightKg);
  const validWeight = Number.isFinite(parsedWeight) && parsedWeight > 0 && parsedWeight <= 5000;
  const exceedsCapacity = Boolean(selectedVehicle && validWeight && parsedWeight > selectedVehicle.capacityKg);
  const canCheckEstimate =
    pickupAddress.trim().length >= 3 &&
    dropAddress.trim().length >= 3 &&
    packageDescription.trim().length >= 2 &&
    validWeight &&
    Boolean(selectedVehicle?.pricing) &&
    !exceedsCapacity &&
    !isLoadingVehicles &&
    !isChecking &&
    !isCreatingBooking;

  const invalidateQuote = () => {
    setEstimate(null);
    setAvailability(null);
    setEstimateError("");
    setAvailabilityError("");
    setBookingError("");
    setNotice("");
  };

  const draft: BookingDraft = {
    pickupAddress,
    dropAddress,
    packageDescription,
    weightKg,
    specialInstructions,
    vehicleId: selectedVehicleId,
    pickupLocationToken,
    dropLocationToken,
  };

  async function handleCheckEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCheckEstimate || !selectedVehicle) return;

    setIsChecking(true);
    setEstimate(null);
    setAvailability(null);
    setEstimateError("");
    setAvailabilityError("");
    setBookingError("");
    setNotice("");

    const [quoteResult, availabilityResult] = await Promise.allSettled([
      api.post<FareEstimate & { success: boolean; message?: string }>("/pricing/estimate", {
        pickupAddress: pickupAddress.trim(),
        dropAddress: dropAddress.trim(),
        pickupLocationToken: pickupLocationToken || undefined,
        dropLocationToken: dropLocationToken || undefined,
        vehicleId: selectedVehicle._id,
        weightKg: parsedWeight,
      }),
      api.get<{ success: boolean; availability?: VehicleAvailability; message?: string }>(
        "/vehicles/availability",
        { params: { vehicleId: selectedVehicle._id, weightKg: parsedWeight } }
      ),
    ]);

    if (quoteResult.status === "fulfilled" && quoteResult.value.data.success) {
      setEstimate(quoteResult.value.data);
    } else {
      const error = quoteResult.status === "rejected"
        ? quoteResult.reason
        : new Error(quoteResult.value.data.message || "Fare estimation failed.");
      setEstimateError(getErrorMessage(error, "Unable to estimate the fare."));
    }

    if (
      availabilityResult.status === "fulfilled" &&
      availabilityResult.value.data.success &&
      availabilityResult.value.data.availability
    ) {
      setAvailability(availabilityResult.value.data.availability);
    } else {
      const error = availabilityResult.status === "rejected"
        ? availabilityResult.reason
        : new Error(availabilityResult.value.data.message || "Availability could not be checked.");
      setAvailabilityError(getErrorMessage(error, "Availability could not be checked right now."));
    }

    setIsChecking(false);
  }

  async function handleConfirmBooking() {
    if (!estimate || isCreatingBooking || authLoading) return;

    if (!user) {
      saveDraft(draft);
      navigate("/login", { state: { from: "/book" } });
      return;
    }

    if (user.role !== "customer") {
      setBookingError("Bookings can only be created from a customer account. Sign in with a customer account to continue.");
      return;
    }

    setIsCreatingBooking(true);
    setBookingError("");
    setNotice("");

    try {
      // The backend recalculates the fare and validates the selected vehicle before saving.
      const response = await api.post<BookingCreateResponse>("/bookings", {
        pickupAddress: pickupAddress.trim(),
        dropAddress: dropAddress.trim(),
        pickupLocationToken: pickupLocationToken || undefined,
        dropLocationToken: dropLocationToken || undefined,
        vehicleId: selectedVehicleId,
        weightKg: parsedWeight,
        packageDescription: packageDescription.trim(),
        specialInstructions: specialInstructions.trim(),
      });

      if (!response.data.success || !response.data.booking?._id) {
        throw new Error(response.data.message || "Booking could not be created.");
      }

      clearDraft();
      navigate(`/customer/orders/${response.data.booking._id}`, {
        state: { bookingCode: response.data.booking.bookingCode },
      });
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 401) {
        saveDraft(draft);
        navigate("/login", { state: { from: "/book" } });
        return;
      }
      setBookingError(getErrorMessage(error, "Unable to create the booking. Please try again."));
    } finally {
      setIsCreatingBooking(false);
    }
  }

  return (
    <div className="lgx min-h-screen bg-[#f5f7fb] text-slate-900">
      <PublicHeader>
        <CityPicker city={city} onChange={setCity} compact className="max-[420px]:max-w-[94px]" />
        {user?.role === "customer" ? (
              <Link to="/customer" className="lgx-btn lgx-btn-outline">My dashboard</Link>
            ) : (
              <Link to="/login" state={{ from: "/book" }} onClick={() => saveDraft(draft)} className="lgx-btn lgx-btn-outline">Log in</Link>
            )}
      </PublicHeader>

      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <section className="lgx-hero relative overflow-hidden rounded-[28px] bg-[#10213a] px-5 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8 sm:py-9 lg:px-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-8 h-52 w-52 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-200 sm:text-xs"><span className="h-2 w-2 rounded-full bg-orange-400" /> Public booking</span>
            <h1 className="mt-4 text-[clamp(2rem,5.5vw,3.7rem)] font-black leading-[1.04] tracking-[-0.045em]">Your cargo.<br /><span className="text-orange-400">The right vehicle.</span></h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Enter the route and load, compare real LogiGo vehicle categories, and get a server-calculated estimate before confirming. Driver availability can change before dispatch.</p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-300 sm:text-sm">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Server-verified fare</span>
              <span className="inline-flex items-center gap-2"><Route className="h-4 w-4 text-orange-300" /> Mapbox route estimate</span>
              <span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-sky-300" /> No payment taken here</span>
            </div>
          </div>
        </section>

        {notice && <div role="status" className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">{notice}</div>}

        <div className="mt-7 grid min-w-0 gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="order-2 min-w-0 space-y-6 lg:order-2">
            <section className={`${cardClass} p-5 sm:p-7`}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><MapPin className="h-5 w-5" /></span>
                <div><h2 className="text-lg font-black tracking-tight sm:text-xl">Delivery details</h2><p className="mt-1 text-sm leading-6 text-slate-500">Use complete addresses so the route estimate can locate each stop.</p></div>
              </div>

              <form onSubmit={handleCheckEstimate} className="mt-6 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <LocationAutocomplete
                    label="Pickup address"
                    value={pickupAddress}
                    onChange={(value) => { setPickupAddress(value); setPickupLocationToken(""); invalidateQuote(); }}
                    onLocationSelected={(address, token) => { setPickupAddress(address); setPickupLocationToken(token); invalidateQuote(); }}
                    placeholder="Search area, street, landmark…"
                    city={city}
                    inputClassName={fieldClass}
                    maxLength={256}
                  />
                  <LocationAutocomplete
                    label="Drop-off address"
                    value={dropAddress}
                    onChange={(value) => { setDropAddress(value); setDropLocationToken(""); invalidateQuote(); }}
                    onLocationSelected={(address, token) => { setDropAddress(address); setDropLocationToken(token); invalidateQuote(); }}
                    placeholder="Search destination, street, landmark…"
                    city={city}
                    inputClassName={fieldClass}
                    maxLength={256}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <label className="block min-w-0 text-sm font-bold text-slate-700">What are you moving?
                    <input className={fieldClass} value={packageDescription} onChange={(event) => { setPackageDescription(event.target.value); invalidateQuote(); }} placeholder="e.g. cartons, furniture, business supplies" maxLength={300} required minLength={2} />
                  </label>
                  <label className="block min-w-0 text-sm font-bold text-slate-700">Approx. weight (kg)
                    <input className={fieldClass} type="number" inputMode="decimal" value={weightKg} onChange={(event) => { setWeightKg(event.target.value); invalidateQuote(); }} min="0.1" max="5000" step="0.1" required />
                  </label>
                </div>
                <label className="block text-sm font-bold text-slate-700">Special instructions <span className="font-medium text-slate-400">(optional)</span>
                  <textarea className={`${fieldClass} min-h-24 resize-y`} value={specialInstructions} onChange={(event) => { setSpecialInstructions(event.target.value); invalidateQuote(); }} placeholder="Landmark, handling notes, or access instructions" maxLength={500} rows={3} />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500"><span className="inline-flex items-center gap-2"><Weight className="h-4 w-4 text-orange-500" /> Vehicle options are filtered by load capacity.</span><span>Prices are recalculated by the server.</span></div>

                <div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div><h3 className="text-base font-black text-slate-900">Choose a vehicle category</h3><p className="mt-1 text-sm leading-6 text-slate-500">The catalog below comes from your LogiGo backend.</p></div>
                    {isLoadingVehicles && <span className="text-xs font-semibold text-slate-500">Loading catalog…</span>}
                  </div>
                  {vehicleError && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{vehicleError}</div>}
                  {!isLoadingVehicles && !vehicleError && vehicles.length === 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">No active vehicle categories are configured yet. Add or activate vehicles in the Admin vehicle catalog before taking bookings.</div>}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {vehicles.map((vehicle) => {
                      const active = selectedVehicleId === vehicle._id;
                      const capacityFits = validWeight && parsedWeight <= vehicle.capacityKg;
                      const capacityLabel = new Intl.NumberFormat("en-IN").format(vehicle.capacityKg);
                      return (
                        <button
                          key={vehicle._id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => { setSelectedVehicleId(vehicle._id); invalidateQuote(); }}
                          className={`min-w-0 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 ${active ? "border-orange-400 bg-orange-50/70 shadow-md shadow-orange-500/5" : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/30"}`}
                        >
                          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700"}`}><Truck className="h-5 w-5" /></span>
                          <span className="mt-3 block text-sm font-extrabold leading-5 text-slate-900">{vehicle.name}</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">Capacity up to {capacityLabel} kg</span>
                          {vehicle.description && <span className="mt-2 block text-xs leading-5 text-slate-500">{vehicle.description}</span>}
                          {vehicle.pricing ? <span className="mt-3 block text-xs font-bold text-slate-700">Base fare {formatPrice(vehicle.pricing.baseFare)}</span> : <span className="mt-3 block text-xs font-bold text-amber-700">Pricing not configured</span>}
                          <span className={`mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold ${active ? "text-orange-700" : "text-slate-600"}`}>{active ? <><CheckCircle2 className="h-4 w-4" /> Selected</> : <>Select vehicle <ArrowRight className="h-3.5 w-3.5" /></>}</span>
                          {!capacityFits && validWeight && <span className="mt-2 block text-[11px] font-semibold text-amber-700">Does not fit the entered weight</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedVehicle && !selectedVehicle.pricing && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This vehicle has no active pricing rule. Ask an administrator to configure pricing before requesting an estimate.</p>}
                {exceedsCapacity && selectedVehicle && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{selectedVehicle.name} supports up to {selectedVehicle.capacityKg.toLocaleString("en-IN")} kg. Choose a larger vehicle or update the load weight.</p>}
                {estimateError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{estimateError}</p>}

                <button type="submit" disabled={!canCheckEstimate} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:w-auto">
                  {isChecking ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Checking fare and availability…</> : <>Calculate fare & check availability <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            </section>
          </div>

          <aside className="order-1 min-w-0 space-y-5 lg:sticky lg:top-6 lg:order-1">
            <section className={`${cardClass} overflow-hidden`}>
              <div className="border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white p-5 sm:p-6">
                <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/20"><Package className="h-5 w-5" /></span><div><h2 className="text-lg font-black tracking-tight">Booking summary</h2><p className="mt-0.5 text-xs text-slate-500">Review before confirmation</p></div></div>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Pickup</p><p className="mt-1 break-words font-semibold text-slate-700">{pickupAddress.trim() || "Add your pickup address"}</p></div></div>
                  <div className="ml-2 h-5 border-l border-dashed border-slate-300" />
                  <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Destination</p><p className="mt-1 break-words font-semibold text-slate-700">{dropAddress.trim() || "Add your drop-off address"}</p></div></div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="text-slate-500">Selected vehicle</span><span className="text-right font-bold text-slate-800">{selectedVehicle?.name ?? "Not selected"}</span></div><div className="mt-2 flex items-center justify-between gap-3"><span className="text-slate-500">Load weight</span><span className="font-bold text-slate-800">{validWeight ? `${parsedWeight.toLocaleString("en-IN")} kg` : "Check weight"}</span></div>{packageDescription.trim() && <div className="mt-2 border-t border-slate-200 pt-2"><p className="text-xs text-slate-500">Cargo</p><p className="mt-1 break-words font-semibold text-slate-700">{packageDescription.trim()}</p></div>}</div>

                {estimate && <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-800">Estimated fare</p>
                  <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{formatPrice(estimate.fare.estimatedFare)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Estimate only. The backend recalculates fare when the booking is created.</p>
                  <div className="mt-4 space-y-2 border-t border-emerald-200 pt-3 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Route distance</span><strong>{estimate.route.distanceKm.toLocaleString("en-IN")} km</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Approx. driving time</span><strong>{estimate.route.durationMinutes} min</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Base fare</span><strong>{formatPrice(estimate.fare.baseFare)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Distance charge</span><strong>{formatPrice(estimate.fare.distanceCharge)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Weight charge</span><strong>{formatPrice(estimate.fare.weightCharge)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Service fee</span><strong>{formatPrice(estimate.fare.serviceFee)}</strong></div>
                    {estimate.fare.minimumFare > estimate.fare.subtotal && <div className="flex justify-between gap-3 border-t border-emerald-200 pt-2"><span className="text-slate-600">Minimum fare adjustment</span><strong>{formatPrice(estimate.fare.minimumFare - estimate.fare.subtotal)}</strong></div>}
                  </div>
                </div>}

                {availability && <div className={`rounded-2xl border p-4 ${availability.eligibleDriverCount > 0 ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/80"}`}>
                  <div className="flex items-start gap-2.5"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${availability.eligibleDriverCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{availability.eligibleDriverCount > 0 ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span><div className="min-w-0"><p className="text-sm font-extrabold text-slate-900">{availability.eligibleDriverCount > 0 ? `${availability.eligibleDriverCount} eligible online driver${availability.eligibleDriverCount === 1 ? "" : "s"}` : "No eligible online driver right now"}</p><p className="mt-1 text-xs leading-5 text-slate-600">{availability.message}</p></div></div>
                  {availability.eligibleDriverCount === 0 && <p className="mt-3 text-xs font-semibold leading-5 text-amber-900">You can retry this check, choose another vehicle, or create the booking and let the existing dispatch worker keep retrying. Assignment only happens after a driver accepts.</p>}
                </div>}
                {availabilityError && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Driver availability could not be verified: {availabilityError} Fare estimate and driver availability are separate checks.</p>}
                {bookingError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{bookingError}</p>}

                {estimate && <button type="button" onClick={() => void handleConfirmBooking()} disabled={isCreatingBooking || authLoading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10213a] px-4 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#172d4d] disabled:cursor-not-allowed disabled:bg-slate-400">
                  {isCreatingBooking ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Creating booking…</> : user?.role === "customer" ? <>Confirm booking <ArrowRight className="h-4 w-4" /></> : user ? <>Customer account required</> : <>Continue to sign in <ArrowRight className="h-4 w-4" /></>}
                </button>}
                {!estimate && <p className="text-xs leading-5 text-slate-500">Your estimate and live eligibility check will appear here after you calculate the fare.</p>}
                {user && user.role !== "customer" && <p className="text-xs leading-5 text-amber-800">You are signed in as {user.role}. A customer account is required to create a delivery booking.</p>}
                <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />No payment is taken on this page. A driver is not assigned until an eligible driver explicitly accepts the offer.</p>
              </div>
            </section>
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Clock3 className="h-4 w-4" /></span><div><p className="text-sm font-extrabold text-slate-800">Availability can change</p><p className="mt-1 text-xs leading-5 text-slate-500">The check counts approved, document-eligible drivers who are online and have enough capacity. It is not a route-distance guarantee; dispatch verifies eligibility again.</p></div></div>
          </aside>
        </div>
      </main>

      <PublicFooter note="Clear estimates. Explicit driver acceptance." />
    </div>
  );
}

export default PublicBooking;
