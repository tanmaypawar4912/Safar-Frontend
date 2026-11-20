import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  Weight,
} from "lucide-react";

import api from "../../services/api";
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

interface Vehicle {
  _id: string;
  name: string;
  slug: string;
  description: string;
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
  package: {
    weightKg: number;
  };
  fare: {
    currency: string;
    baseFare: number;
    distanceCharge: number;
    weightCharge: number;
    serviceFee: number;
    subtotal: number;
    minimumFare: number;
    estimatedFare: number;
  };
}

interface BookingCreateResponse {
  success: boolean;
  message: string;
  booking: {
    _id: string;
    bookingCode: string;
    status: string;
  };
}

interface PaymentSettings {
  codMaxDistanceKm?: number;
  onlinePaymentsEnabled?: boolean;
  razorpayKeyId?: string;
}

interface BookingCheckoutOrderResponse {
  success: boolean;
  message?: string;
  checkoutIntentId?: string;
  alreadyCompleted?: boolean;
  booking?: { _id: string; bookingCode?: string; status: string };
  keyId?: string;
  order?: { id: string; amount: number; currency: string };
  amountRupees?: number;
}

const RAZORPAY_CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let razorpayScriptPromise: Promise<boolean> | null = null;

function loadRazorpayCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`);
    const script = existing || document.createElement("script");
    const finish = (ready: boolean) => resolve(ready && typeof window.Razorpay === "function");
    script.addEventListener("load", () => finish(true), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    if (!existing) {
      script.src = RAZORPAY_CHECKOUT_SCRIPT;
      script.async = true;
      document.body.appendChild(script);
    } else if (window.Razorpay) {
      finish(true);
    }
  }).finally(() => {
    if (!window.Razorpay) razorpayScriptPromise = null;
  });
  return razorpayScriptPromise;
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
        ? "Cannot connect to Safar. Check that the backend is running."
        : fallback)
    );
  }

  return error instanceof Error ? error.message : fallback;
}

const fieldClass = "lgb-input";

function BookDelivery() {
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [city, setCity] = useState<CityOption>(() => getSelectedCity());

  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [pickupLocationToken, setPickupLocationToken] = useState("");
  const [dropLocationToken, setDropLocationToken] = useState("");

  const [packageDescription, setPackageDescription] = useState("");
  const [weightKg, setWeightKg] = useState("10");
  const [instructions, setInstructions] = useState("");

  // Payment preferences
  const [paymentMethod, setPaymentMethod] = useState<
    "cash_on_delivery" | "online"
  >("cash_on_delivery");

  // Null means settings could not be loaded. The backend remains authoritative.
  const [codMaxDistanceKm, setCodMaxDistanceKm] = useState<number | null>(null);
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(false);
  const [paymentSettingsLoading, setPaymentSettingsLoading] = useState(true);
  const [paymentSettingsError, setPaymentSettingsError] = useState("");

  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehicleError, setVehicleError] = useState("");
  const [estimateError, setEstimateError] = useState("");
  const [bookingError, setBookingError] = useState("");

  const [isEstimating, setIsEstimating] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [pendingCheckoutVerification, setPendingCheckoutVerification] = useState<{
    checkoutIntentId: string;
    payment: RazorpayCheckoutResponse;
  } | null>(null);

  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Load the live vehicle catalogue independently of payment settings.
  const loadVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    setVehicleError("");

    try {
      const response = await api.get("/vehicles");

      if (!response.data.success) {
        throw new Error(
          response.data.message || "Unable to load vehicles."
        );
      }

      setVehicles(response.data.vehicles ?? []);
    } catch (error: unknown) {
      setVehicleError(
        getErrorMessage(error, "Unable to load vehicles.")
      );
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  // Load the COD policy and online-payment availability from the backend.
  const loadPaymentSettings = useCallback(async () => {
    setPaymentSettingsLoading(true);
    setPaymentSettingsError("");

    try {
      const response = await api.get("/payments/settings");
      const settings = response.data?.settings as
        | PaymentSettings
        | undefined;

      if (!response.data?.success || !settings) {
        throw new Error("Payment settings are unavailable.");
      }

      const configuredCodDistance = Number(settings.codMaxDistanceKm);

      setCodMaxDistanceKm(
        Number.isFinite(configuredCodDistance) &&
          configuredCodDistance >= 0
          ? configuredCodDistance
          : null
      );

      // Online payment remains disabled unless the backend confirms that
      // the gateway is configured.
      setOnlinePaymentsEnabled(
        settings.onlinePaymentsEnabled === true
      );
    } catch {
      // A settings error must not prevent the vehicle catalogue from loading.
      // COD eligibility will still be checked by the backend during booking.
      setCodMaxDistanceKm(null);
      setOnlinePaymentsEnabled(false);

      setPaymentSettingsError(
        "Payment settings could not be loaded. Online payment is unavailable; COD eligibility will be checked by the server."
      );
    } finally {
      setPaymentSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVehicles();
    void loadPaymentSettings();
  }, [loadVehicles, loadPaymentSettings]);

  const chosenVehicle = vehicles.find(
    (vehicle) => vehicle._id === selectedVehicle
  );

  const weight = Number(weightKg);

  const validWeight =
    Number.isFinite(weight) &&
    weight > 0 &&
    weight <= 5000;

  const canEstimate =
    pickup.trim().length >= 3 &&
    drop.trim().length >= 3 &&
    packageDescription.trim().length >= 2 &&
    validWeight &&
    Boolean(chosenVehicle?.pricing) &&
    weight <= (chosenVehicle?.capacityKg ?? 0) &&
    !loadingVehicles &&
    !isEstimating &&
    !isCreatingBooking;

  const invalidateEstimate = () => {
    setEstimate(null);
    setEstimateError("");
    setBookingError("");
  };

  const codDistanceExceeded = Boolean(
    estimate &&
      codMaxDistanceKm !== null &&
      estimate.route.distanceKm > codMaxDistanceKm
  );

  const paymentMethodAvailable =
    paymentMethod === "cash_on_delivery"
      ? !codDistanceExceeded
      : onlinePaymentsEnabled && !paymentSettingsLoading;

  const canConfirmBooking = Boolean(
    estimate &&
      selectedVehicle &&
      !isCreatingBooking &&
      paymentMethodAvailable
  );

  const stepValid = {
    1: pickup.trim().length >= 3 && drop.trim().length >= 3,
    2: packageDescription.trim().length >= 2 && validWeight,
    3:
      Boolean(chosenVehicle?.pricing) &&
      Boolean(chosenVehicle) &&
      weight <= (chosenVehicle?.capacityKg ?? 0),
    4: Boolean(estimate),
  } as const;

  const steps = [
    { id: 1, label: "Location", sub: "Pickup & Drop" },
    { id: 2, label: "Package Details", sub: "" },
    { id: 3, label: "Vehicle Selection", sub: "" },
    { id: 4, label: "Review & Book", sub: "" },
  ] as const;

  // A step can be opened only after all preceding steps are valid.
  const canOpenStep = (target: number) => {
    for (let id = 1; id < target; id += 1) {
      if (!stepValid[id as 1 | 2 | 3]) {
        return false;
      }
    }

    return true;
  };

  async function handleEstimate() {
    if (!canEstimate || !selectedVehicle) {
      return;
    }

    setIsEstimating(true);
    setEstimate(null);
    setEstimateError("");
    setBookingError("");

    try {
      const response = await api.post("/pricing/estimate", {
        pickupAddress: pickup.trim(),
        dropAddress: drop.trim(),
        pickupLocationToken: pickupLocationToken || undefined,
        dropLocationToken: dropLocationToken || undefined,
        vehicleId: selectedVehicle,
        weightKg: weight,
      });

      if (!response.data.success) {
        throw new Error(
          response.data.message || "Fare estimation failed."
        );
      }

      setEstimate(response.data as FareEstimate);
    } catch (error: unknown) {
      setEstimateError(
        getErrorMessage(error, "Unable to estimate the fare.")
      );
    } finally {
      setIsEstimating(false);
    }
  }

  useEffect(() => {
    if (step === 4 && canEstimate && !estimate && !estimateError) {
      void handleEstimate();
    }

    // The step transition intentionally triggers the existing estimate flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function retryOnlineCheckoutVerification() {
    if (!pendingCheckoutVerification || isCreatingBooking) return;

    setIsCreatingBooking(true);
    setBookingError("");

    try {
      const verified = await api.post<{
        success: boolean;
        message?: string;
        booking?: { _id: string; bookingCode?: string };
      }>("/payments/checkout/verify", {
        checkoutIntentId: pendingCheckoutVerification.checkoutIntentId,
        razorpay_order_id: pendingCheckoutVerification.payment.razorpay_order_id,
        razorpay_payment_id: pendingCheckoutVerification.payment.razorpay_payment_id,
        razorpay_signature: pendingCheckoutVerification.payment.razorpay_signature,
      });

      if (!verified.data?.success || !verified.data.booking?._id) {
        throw new Error(
          verified.data?.message ||
            "Payment is not verified yet. Your booking has not been placed."
        );
      }

      setPendingCheckoutVerification(null);
      navigate(`/customer/orders/${verified.data.booking._id}`, {
        state: { bookingCode: verified.data.booking.bookingCode },
      });
    } catch (error: unknown) {
      setBookingError(
        getErrorMessage(
          error,
          "Payment verification is still pending. Do not pay again for this checkout. Retry verification or contact support."
        )
      );
    } finally {
      setIsCreatingBooking(false);
    }
  }

  async function handleConfirmBooking() {
    if (!estimate || !selectedVehicle || isCreatingBooking) return;

    if (pendingCheckoutVerification) {
      setBookingError(
        "A payment was submitted and still needs verification. Retry verification below; do not start another payment."
      );
      return;
    }

    // UX validation only. The backend independently recalculates the route
    // and enforces the COD distance policy before creating a booking.
    if (
      paymentMethod === "cash_on_delivery" &&
      codMaxDistanceKm !== null &&
      estimate.route.distanceKm > codMaxDistanceKm
    ) {
      setBookingError(
        `Cash on delivery is available only up to ${codMaxDistanceKm} km. Choose online payment if enabled, or use a shorter route.`
      );
      return;
    }

    if (paymentMethod === "online" && !onlinePaymentsEnabled) {
      setBookingError(
        "Online payment is not configured yet. Choose cash on delivery for an eligible route."
      );
      return;
    }

    setIsCreatingBooking(true);
    setBookingError("");
    let gatewayCheckoutOpened = false;

    const bookingPayload = {
      pickupAddress: pickup.trim(),
      dropAddress: drop.trim(),
      pickupLocationToken: pickupLocationToken || undefined,
      dropLocationToken: dropLocationToken || undefined,
      vehicleId: selectedVehicle,
      weightKg: weight,
      packageDescription: packageDescription.trim(),
      specialInstructions: instructions.trim(),
    };

    try {
      // COD creates a booking directly. The driver records collection after
      // delivery, and Admin verifies the collection from Admin Payments.
      if (paymentMethod === "cash_on_delivery") {
        const response = await api.post<BookingCreateResponse>("/bookings", {
          ...bookingPayload,
          paymentMethod: "cash_on_delivery",
        });

        if (!response.data.success || !response.data.booking?._id) {
          throw new Error(
            response.data.message || "Booking could not be created."
          );
        }

        navigate(`/customer/orders/${response.data.booking._id}`, {
          state: { bookingCode: response.data.booking.bookingCode },
        });
        return;
      }

      // Online flow: create a temporary checkout intent first. The backend
      // creates the actual booking only after Razorpay capture is verified.
      const checkoutResponse = await api.post<BookingCheckoutOrderResponse>(
        "/payments/checkout/order",
        {
          ...bookingPayload,
          paymentMethod: "online",
          idempotencyKey:
            window.crypto?.randomUUID?.() ||
            `checkout_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`,
        }
      );
      const checkout = checkoutResponse.data;

      if (checkout.alreadyCompleted && checkout.booking?._id) {
        navigate(`/customer/orders/${checkout.booking._id}`, {
          state: { bookingCode: checkout.booking.bookingCode },
        });
        return;
      }

      if (
        !checkout.success ||
        !checkout.checkoutIntentId ||
        !checkout.keyId ||
        !checkout.order?.id
      ) {
        throw new Error(
          checkout.message || "Secure online checkout could not be started."
        );
      }

      const checkoutReady = await loadRazorpayCheckout();
      if (!checkoutReady || !window.Razorpay) {
        throw new Error(
          "Razorpay Checkout could not load. No booking has been placed; check your internet connection and retry."
        );
      }

      const checkoutInstance = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.order.amount,
        currency: checkout.order.currency || "INR",
        name: "Safar Logistics",
        description: "Secure delivery booking payment",
        order_id: checkout.order.id,
        notes: { checkoutIntentId: checkout.checkoutIntentId },
        theme: { color: "#a44229" },
        modal: {
          ondismiss: () => {
            setBookingError("");
            setIsCreatingBooking(false);
          },
        },
        handler: async (payment) => {
          setPendingCheckoutVerification({
            checkoutIntentId: checkout.checkoutIntentId!,
            payment,
          });
          setBookingError("");

          try {
            const verified = await api.post<{
              success: boolean;
              message?: string;
              booking?: { _id: string; bookingCode?: string };
            }>("/payments/checkout/verify", {
              checkoutIntentId: checkout.checkoutIntentId,
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            });

            if (!verified.data?.success || !verified.data.booking?._id) {
              throw new Error(
                verified.data?.message ||
                  "Payment was not verified. The booking has not been placed yet."
              );
            }

            setPendingCheckoutVerification(null);
            navigate(`/customer/orders/${verified.data.booking._id}`, {
              state: { bookingCode: verified.data.booking.bookingCode },
            });
          } catch (verificationError: unknown) {
            setBookingError(
              getErrorMessage(
                verificationError,
                "Payment verification is pending. Do not pay again immediately; retry verification or contact support with your Razorpay payment ID."
              )
            );
          } finally {
            setIsCreatingBooking(false);
          }
        },
      });

      checkoutInstance.on("payment.failed", (failure) => {
        const candidate = failure as { error?: { description?: string } };
        setBookingError(
          candidate.error?.description ||
            "Payment failed. No booking has been placed. Retry online payment or choose COD if eligible."
        );
        setIsCreatingBooking(false);
      });

      checkoutInstance.open();
      gatewayCheckoutOpened = true;
    } catch (error: unknown) {
      setBookingError(
        getErrorMessage(error, "Unable to continue checkout. Please try again.")
      );
    } finally {
      if (!gatewayCheckoutOpened) setIsCreatingBooking(false);
    }
  }

  const fare = estimate?.fare.estimatedFare;

  return (
    <main className="lgb">
      <header className="lgp-head">
        <div>
          <h1>Book a Delivery</h1>
          <p>
            Enter your route, choose a vehicle and review your fare before
            confirming.
          </p>
        </div>
      </header>

      {/* Booking steps */}
      <ol className="lgb-steps" aria-label="Booking steps">
        {steps.map((item) => {
          const done =
            item.id < step &&
            stepValid[item.id as 1 | 2 | 3];

          const current = item.id === step;
          const reachable = canOpenStep(item.id);

          return (
            <li
              key={item.id}
              className={`${current ? "is-current" : ""}${
                done ? " is-done" : ""
              }`}
            >
              <button
                type="button"
                disabled={!reachable}
                onClick={() => {
                  if (reachable) {
                    setStep(item.id);
                  }
                }}
                aria-current={current ? "step" : undefined}
              >
                <span className="lgb-step-dot">
                  {done ? (
                    <Check aria-hidden="true" />
                  ) : (
                    item.id
                  )}
                </span>

                <span className="lgb-step-text">
                  <strong>{item.label}</strong>
                  {item.sub && <small>{item.sub}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="lgb-layout">
        <section className="lgp-card lgb-main">
          {/* STEP 1 — Pickup and drop */}
          {step === 1 && (
            <>
              <h2 className="lgb-title">
                Pickup &amp; Drop Location
              </h2>

              <div className="lgb-city">
                <div>
                  <small>Booking city</small>
                  <span>
                    Suggestions are prioritised around your selected city.
                  </span>
                </div>

                <CityPicker
                  city={city}
                  onChange={setCity}
                  compact
                />
              </div>

              <div className="lgb-fields">
                <LocationAutocomplete
                  label="Pickup Location"
                  value={pickup}
                  onChange={(value) => {
                    setPickup(value);
                    setPickupLocationToken("");
                    invalidateEstimate();
                  }}
                  onLocationSelected={(address, token) => {
                    setPickup(address);
                    setPickupLocationToken(token);
                    invalidateEstimate();
                  }}
                  placeholder="Enter pickup location"
                  city={city}
                  inputClassName={fieldClass}
                  maxLength={256}
                />

                <LocationAutocomplete
                  label="Drop Location"
                  value={drop}
                  onChange={(value) => {
                    setDrop(value);
                    setDropLocationToken("");
                    invalidateEstimate();
                  }}
                  onLocationSelected={(address, token) => {
                    setDrop(address);
                    setDropLocationToken(token);
                    invalidateEstimate();
                  }}
                  placeholder="Enter drop location"
                  city={city}
                  inputClassName={fieldClass}
                  maxLength={256}
                />
              </div>

              <div
                className="lgb-map"
                role="img"
                aria-label="Route preview between pickup and drop"
              >
                <svg
                  viewBox="0 0 600 260"
                  preserveAspectRatio="xMidYMid slice"
                  aria-hidden="true"
                >
                  <rect
                    width="600"
                    height="260"
                    fill="#e9eef3"
                  />

                  <path
                    className="lgb-map-water"
                    d="M-10 200 C 90 170, 150 230, 260 210 S 430 160, 610 220 L610 270 L-10 270 Z"
                  />

                  <path
                    className="lgb-map-road"
                    d="M-10 90 L140 70 L260 120 L420 80 L610 130"
                  />

                  <path
                    className="lgb-map-road"
                    d="M80 -10 L120 120 L100 270"
                  />

                  <path
                    className="lgb-map-road"
                    d="M330 -10 L300 110 L360 270"
                  />

                  <path
                    className="lgb-map-road"
                    d="M480 -10 L450 90 L520 270"
                  />

                  <path
                    className="lgb-map-route"
                    d="M120 78 C 190 90, 210 150, 290 130 S 410 70, 480 110"
                  />

                  <g className="lgb-map-pin lgb-map-pin-a">
                    <circle cx="120" cy="78" r="9" />
                    <circle cx="120" cy="78" r="3.5" />
                  </g>

                  <g className="lgb-map-pin lgb-map-pin-b">
                    <circle cx="480" cy="110" r="9" />
                    <circle cx="480" cy="110" r="3.5" />
                  </g>
                </svg>

                <span className="lgb-map-label lgb-map-label-a">
                  {pickup.trim()
                    ? pickup.split(",")[0]
                    : "Pickup"}
                </span>

                <span className="lgb-map-label lgb-map-label-b">
                  {drop.trim()
                    ? drop.split(",")[0]
                    : "Drop"}
                </span>

                <div className="lgb-map-stats">
                  <div>
                    <small>Distance</small>
                    <strong>
                      {estimate
                        ? `${estimate.route.distanceKm} km`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <small>Est. Time</small>
                    <strong>
                      {estimate
                        ? `${estimate.route.durationMinutes} min`
                        : "—"}
                    </strong>
                  </div>
                </div>
              </div>

              <p className="lgb-hint">
                Route distance and travel time are calculated when you
                review your fare.
              </p>
            </>
          )}

          {/* STEP 2 — Package details */}
          {step === 2 && (
            <>
              <h2 className="lgb-title">Package Details</h2>

              <p className="lgb-lead">
                Tell us what the driver will be transporting.
              </p>

              <div className="lgb-fields lgb-fields-one">
                <div className="lgb-field">
                  <label htmlFor="packageDescription">
                    Item description <span>*</span>
                  </label>

                  <input
                    id="packageDescription"
                    value={packageDescription}
                    onChange={(event) => {
                      setPackageDescription(event.target.value);
                      invalidateEstimate();
                    }}
                    placeholder="e.g. Carton boxes, furniture, office supplies"
                    className={fieldClass}
                    maxLength={300}
                    required
                  />
                </div>

                <div className="lgb-fields">
                  <div className="lgb-field">
                    <label htmlFor="weightKg">
                      <Weight aria-hidden="true" />
                      Package weight (kg) <span>*</span>
                    </label>

                    <input
                      id="weightKg"
                      type="number"
                      inputMode="decimal"
                      value={weightKg}
                      onChange={(event) => {
                        setWeightKg(event.target.value);
                        invalidateEstimate();
                      }}
                      className={fieldClass}
                      min="0.1"
                      max="5000"
                      step="0.1"
                      required
                    />

                    {!validWeight && weightKg !== "" && (
                      <p className="lgb-error">
                        Enter a weight from 0.1 to 5000 kg.
                      </p>
                    )}
                  </div>

                  <div className="lgb-field">
                    <label htmlFor="instructions">
                      Special instructions <em>(optional)</em>
                    </label>

                    <input
                      id="instructions"
                      value={instructions}
                      onChange={(event) => {
                        setInstructions(event.target.value);
                        invalidateEstimate();
                      }}
                      placeholder="e.g. Handle with care"
                      className={fieldClass}
                      maxLength={500}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STEP 3 — Vehicle selection */}
          {step === 3 && (
            <>
              <div className="lgb-title-row">
                <h2 className="lgb-title">Vehicle Selection</h2>

                <span className="lgp-pill lgp-pill-green">
                  <CheckCircle2 aria-hidden="true" />
                  Live catalog
                </span>
              </div>

              <p className="lgb-lead">
                Vehicle options and pricing come from the live catalog.
              </p>

              {loadingVehicles && (
                <div className="lgb-loading">
                  <RefreshCw
                    className="lgp-spin"
                    aria-hidden="true"
                  />
                  Loading available vehicles...
                </div>
              )}

              {vehicleError && !loadingVehicles && (
                <div
                  role="alert"
                  className="lgp-alert lgp-alert-block"
                >
                  <div>
                    <p>{vehicleError}</p>

                    <button
                      type="button"
                      onClick={() => void loadVehicles()}
                    >
                      <RefreshCw aria-hidden="true" />
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {!loadingVehicles &&
                !vehicleError &&
                vehicles.length === 0 && (
                  <p className="lgb-loading">
                    No vehicles are available right now.
                  </p>
                )}

              {!loadingVehicles &&
                !vehicleError &&
                vehicles.length > 0 && (
                  <div className="lgb-vehicles">
                    {vehicles.map((vehicle) => {
                      const isSelected =
                        selectedVehicle === vehicle._id;

                      const canCarry =
                        validWeight && weight <= vehicle.capacityKg;

                      const canSelect =
                        canCarry && Boolean(vehicle.pricing);

                      return (
                        <article
                          key={vehicle._id}
                          className={`lgb-vehicle${
                            isSelected ? " is-selected" : ""
                          }${canSelect ? "" : " is-disabled"}`}
                        >
                          {isSelected && (
                            <span className="lgb-vehicle-check">
                              <Check aria-hidden="true" />
                            </span>
                          )}

                          <div className="lgb-vehicle-img">
                            {vehicle.imageUrl ? (
                              <img
                                src={vehicle.imageUrl}
                                alt={vehicle.name}
                                loading="lazy"
                              />
                            ) : (
                              <Truck aria-hidden="true" />
                            )}
                          </div>

                          <h3>{vehicle.name}</h3>
                          <p>{vehicle.description}</p>

                          <span className="lgb-vehicle-cap">
                            <Weight aria-hidden="true" />
                            Up to{" "}
                            {vehicle.capacityKg.toLocaleString("en-IN")} kg
                          </span>

                          {(vehicle.features ?? []).length > 0 && (
                            <ul>
                              {(vehicle.features ?? []).map((feature) => (
                                <li key={feature}>
                                  <Check aria-hidden="true" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          )}

                          {vehicle.pricing && (
                            <div className="lgb-vehicle-price">
                              <small>Minimum fare</small>
                              <strong>
                                {formatPrice(vehicle.pricing.minimumFare)}
                              </strong>
                              <span>
                                {formatPrice(vehicle.pricing.perKmRate)} per km
                              </span>
                            </div>
                          )}

                          {!canCarry && (
                            <p className="lgb-warn">
                              This vehicle cannot carry the entered package
                              weight.
                            </p>
                          )}

                          {!vehicle.pricing && (
                            <p className="lgb-warn">
                              Pricing is not configured for this vehicle yet.
                            </p>
                          )}

                          <button
                            type="button"
                            disabled={!canSelect}
                            onClick={() => {
                              setSelectedVehicle(vehicle._id);
                              invalidateEstimate();
                            }}
                            className={`lgp-btn ${
                              isSelected
                                ? "lgp-btn-primary"
                                : "lgp-btn-ghost"
                            }`}
                          >
                            {isSelected
                              ? "Selected"
                              : "Select vehicle"}

                            {isSelected ? (
                              <CheckCircle2 aria-hidden="true" />
                            ) : (
                              <ArrowRight aria-hidden="true" />
                            )}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
            </>
          )}

          {/* STEP 4 — Review, fare and payment */}
          {step === 4 && (
            <>
              <h2 className="lgb-title">Review &amp; Book</h2>

              <p className="lgb-lead">
                Check your details. The server re-validates the route,
                vehicle and fare when you confirm.
              </p>

              <dl className="lgb-review">
                <div>
                  <dt>
                    <MapPin aria-hidden="true" /> Pickup
                  </dt>
                  <dd>{pickup.trim() || "—"}</dd>
                </div>

                <div>
                  <dt>
                    <MapPin aria-hidden="true" /> Drop
                  </dt>
                  <dd>{drop.trim() || "—"}</dd>
                </div>

                <div>
                  <dt>
                    <Package aria-hidden="true" /> Package
                  </dt>
                  <dd>
                    {packageDescription.trim() || "—"} · {weightKg || "—"} kg
                    {instructions.trim()
                      ? ` · ${instructions.trim()}`
                      : ""}
                  </dd>
                </div>

                <div>
                  <dt>
                    <Truck aria-hidden="true" /> Vehicle
                  </dt>
                  <dd>{chosenVehicle?.name || "—"}</dd>
                </div>
              </dl>

              {isEstimating && (
                <div className="lgb-loading">
                  <RefreshCw
                    className="lgp-spin"
                    aria-hidden="true"
                  />
                  Calculating your fare...
                </div>
              )}

              {estimate && (
                <div className="lgb-fare">
                  <div className="lgb-fare-head">
                    <CheckCircle2 aria-hidden="true" />
                    Fare estimate ready
                  </div>

                  <dl>
                    <div>
                      <dt>Driving distance</dt>
                      <dd>{estimate.route.distanceKm} km</dd>
                    </div>

                    <div>
                      <dt>
                        <Clock3 aria-hidden="true" /> Estimated time
                      </dt>
                      <dd>{estimate.route.durationMinutes} min</dd>
                    </div>

                    <div>
                      <dt>Base fare</dt>
                      <dd>{formatPrice(estimate.fare.baseFare)}</dd>
                    </div>

                    <div>
                      <dt>Distance charge</dt>
                      <dd>{formatPrice(estimate.fare.distanceCharge)}</dd>
                    </div>

                    <div>
                      <dt>Weight charge</dt>
                      <dd>{formatPrice(estimate.fare.weightCharge)}</dd>
                    </div>

                    <div>
                      <dt>Service fee</dt>
                      <dd>{formatPrice(estimate.fare.serviceFee)}</dd>
                    </div>

                    <div className="lgb-fare-total">
                      <dt>Estimated total</dt>
                      <dd>{formatPrice(estimate.fare.estimatedFare)}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* Payment options */}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Payment preference
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Choose COD to pay the driver after delivery, or complete
                      online payment now before your booking is placed.
                    </p>
                  </div>

                  {paymentSettingsLoading && (
                    <RefreshCw
                      className="h-4 w-4 shrink-0 animate-spin text-orange-500"
                      aria-label="Loading payment settings"
                    />
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {/* Cash on delivery */}
                  <button
                    type="button"
                    aria-pressed={paymentMethod === "cash_on_delivery"}
                    disabled={codDistanceExceeded}
                    onClick={() => {
                      setPaymentMethod("cash_on_delivery");
                      setBookingError("");
                    }}
                    className={`min-w-0 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      paymentMethod === "cash_on_delivery"
                        ? "border-orange-400 bg-orange-50 ring-2 ring-orange-100"
                        : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                      <Banknote
                        className="h-4 w-4 shrink-0 text-orange-500"
                        aria-hidden="true"
                      />
                      Cash on delivery
                    </span>

                    <span className="mt-2 block text-xs leading-5 text-slate-500">
                      {codMaxDistanceKm === null
                        ? "Available only when the route passes the server's COD eligibility check."
                        : `Available for routes up to ${codMaxDistanceKm} km.`}
                    </span>
                  </button>

                  {/* Online payment */}
                  <button
                    type="button"
                    aria-pressed={paymentMethod === "online"}
                    disabled={
                      !onlinePaymentsEnabled || paymentSettingsLoading
                    }
                    onClick={() => {
                      setPaymentMethod("online");
                      setBookingError("");
                    }}
                    className={`min-w-0 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      paymentMethod === "online"
                        ? "border-orange-400 bg-orange-50 ring-2 ring-orange-100"
                        : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                      <CreditCard
                        className="h-4 w-4 shrink-0 text-orange-500"
                        aria-hidden="true"
                      />
                      Online payment
                    </span>

                    <span className="mt-2 block text-xs leading-5 text-slate-500">
                      {onlinePaymentsEnabled
                        ? "Pay now using UPI or another enabled Razorpay method. Your booking is placed only after payment is verified."
                        : "Unavailable until the online payment gateway is configured."}
                    </span>
                  </button>
                </div>

                {codDistanceExceeded && estimate && (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                    This route is {estimate.route.distanceKm} km, above the{" "}
                    {codMaxDistanceKm} km COD limit.{" "}
                    {onlinePaymentsEnabled
                      ? "Select online payment to continue."
                      : "Online payment is not enabled yet, so this route cannot be booked with the current payment options."}
                  </p>
                )}

                {paymentSettingsError && (
                  <p className="mt-3 text-xs leading-5 text-amber-700">
                    {paymentSettingsError}
                  </p>
                )}
              </section>

              {estimateError && (
                <div
                  role="alert"
                  className="lgp-alert lgp-alert-block"
                >
                  <div>
                    <p>{estimateError}</p>

                    <button
                      type="button"
                      disabled={!canEstimate}
                      onClick={() => void handleEstimate()}
                    >
                      <RefreshCw aria-hidden="true" />
                      Retry estimate
                    </button>
                  </div>
                </div>
              )}

              {bookingError && (
                <div
                  role="alert"
                  className="lgp-alert lgp-alert-block"
                >
                  <div>
                    <p>{bookingError}</p>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="lgb-nav">
            {step > 1 ? (
              <button
                type="button"
                className="lgp-btn lgp-btn-ghost"
                onClick={() =>
                  setStep(
                    (current) => (current - 1) as 1 | 2 | 3 | 4
                  )
                }
              >
                <ArrowLeft aria-hidden="true" />
                Back
              </button>
            ) : (
              <span />
            )}

            <span className="lgb-nav-note">
              <ShieldCheck aria-hidden="true" />
              Your booking is not submitted until you confirm.
            </span>
          </div>
        </section>

        {/* Booking summary */}
        <aside
          className="lgb-summary lgp-card"
          aria-label="Booking summary"
        >
          <h2>Booking Summary</h2>

          <ul>
            <li>
              <MapPin className="is-green" aria-hidden="true" />
              <span>
                <small>Pickup</small>
                <strong>{pickup.trim() || "Not selected"}</strong>
              </span>
            </li>

            <li>
              <MapPin aria-hidden="true" />
              <span>
                <small>Drop</small>
                <strong>{drop.trim() || "Not selected"}</strong>
              </span>
            </li>

            <li>
              <Package aria-hidden="true" />
              <span>
                <small>Package</small>
                <strong>
                  {packageDescription.trim()
                    ? `${packageDescription.trim()} · ${weightKg || "—"} kg`
                    : weightKg
                      ? `${weightKg} kg`
                      : "Not entered"}
                </strong>
              </span>
            </li>

            <li>
              <Truck aria-hidden="true" />
              <span>
                <small>Vehicle</small>
                <strong>{chosenVehicle?.name || "Choose a vehicle"}</strong>
              </span>
            </li>
          </ul>

          <div className="lgb-summary-fare">
            <small>Estimated Fare</small>
            <strong>
              {typeof fare === "number" ? formatPrice(fare) : "—"}
            </strong>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <small className="block text-xs font-semibold text-slate-500">
              Payment method
            </small>

            <strong className="mt-1 block break-words text-sm text-slate-800">
              {paymentMethod === "cash_on_delivery"
                ? "Cash on delivery"
                : "Online payment"}
            </strong>

            {paymentMethod === "online" && !onlinePaymentsEnabled && (
              <span className="mt-1 block text-xs leading-5 text-amber-700">
                Gateway not configured
              </span>
            )}
            {paymentMethod === "online" && onlinePaymentsEnabled && (
              <span className="mt-1 block text-xs leading-5 text-emerald-700">
                Payment is required before the booking is placed.
              </span>
            )}
          </div>

          {pendingCheckoutVerification && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold leading-5 text-amber-900">
                Payment was submitted, but verification is still pending. Do not pay again. Retry verification to complete your booking.
              </p>
              <button
                type="button"
                onClick={() => void retryOnlineCheckoutVerification()}
                disabled={isCreatingBooking}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60"
              >
                {isCreatingBooking ? "Verifying payment…" : "Retry payment verification"}
              </button>
            </div>
          )}

          {step < 4 && (
            <button
              type="button"
              className="lgp-btn lgp-btn-primary lgp-btn-block"
              disabled={!stepValid[step]}
              onClick={() =>
                setStep(
                  (current) => (current + 1) as 1 | 2 | 3 | 4
                )
              }
            >
              Continue <ArrowRight aria-hidden="true" />
            </button>
          )}

          {step === 4 && !estimate && (
            <button
              type="button"
              className="lgp-btn lgp-btn-primary lgp-btn-block"
              disabled={!canEstimate}
              onClick={() => void handleEstimate()}
            >
              {isEstimating ? (
                <>
                  <RefreshCw
                    className="lgp-spin"
                    aria-hidden="true"
                  />
                  Calculating fare...
                </>
              ) : (
                <>
                  Calculate estimated fare{" "}
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </button>
          )}

          {step === 4 && estimate && (
            <button
              type="button"
              className="lgp-btn lgp-btn-primary lgp-btn-block"
              disabled={!canConfirmBooking || Boolean(pendingCheckoutVerification)}
              onClick={() => void handleConfirmBooking()}
            >
              {isCreatingBooking ? (
                <>
                  <RefreshCw
                    className="lgp-spin"
                    aria-hidden="true"
                  />
                  {paymentMethod === "online" ? "Starting secure checkout…" : "Creating COD booking…"}
                </>
              ) : (
                <>
                  {paymentMethod === "online" ? "Pay & Confirm Booking" : "Confirm COD Booking"} <ArrowRight aria-hidden="true" />
                </>
              )}
            </button>
          )}

          {step < 4 && !stepValid[step] && (
            <p className="lgb-summary-note">
              {step === 1
                ? "Enter pickup and drop locations to continue."
                : step === 2
                  ? "Describe your package and weight to continue."
                  : "Select a vehicle to continue."}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

export default BookDelivery;