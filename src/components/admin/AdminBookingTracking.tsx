import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";

import "leaflet/dist/leaflet.css";
import "../booking/BookingLiveTracking.css";

import {
  AlertTriangle,
  Clock3,
  Crosshair,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

import api from "../../services/api";

type TrackingPoint = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  headingDegrees?: number | null;
  speedMetersPerSecond?: number | null;
  capturedAt?: string;
};

type TrackingPayload = {
  success?: boolean;
  trackingActive?: boolean;
  reason?: string | null;
  location?: TrackingPoint | null;
  message?: string;
};

type Props = {
  bookingId: string;
  bookingCode: string;
  status: string;
  onClose: () => void;
};

const POLL_INTERVAL_MS = 10_000;
const STALE_AFTER_MS = 90_000;

const OSM_TILE_URL =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

const statusLabel = (status: string) =>
  status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function errorMessage(error: unknown) {
  const candidate = error as {
    response?: {
      status?: number;
      data?: {
        message?: string;
      };
    };
    code?: string;
    message?: string;
  };

  const code = candidate?.response?.status;

  if (code === 401) {
    return "Admin session expired. Sign in again to view tracking.";
  }

  if (code === 403) {
    return "This admin account does not have permission to read this booking's location.";
  }

  if (code === 404) {
    return "Booking or tracking record was not found.";
  }

  if (code === 429) {
    return "Too many tracking requests. Please wait before refreshing again.";
  }

  return (
    candidate?.response?.data?.message ||
    (candidate?.code === "ERR_NETWORK"
      ? "Cannot connect to LogiGo API. Check your connection."
      : "Unable to load this booking's location.")
  );
}

function isValidLocation(
  point: TrackingPoint | null | undefined
): point is TrackingPoint {
  return Boolean(
    point &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= -90 &&
      point.latitude <= 90 &&
      point.longitude >= -180 &&
      point.longitude <= 180
  );
}

function getMapAccuracy(point: TrackingPoint) {
  const accuracy = point.accuracyMeters;

  if (
    typeof accuracy !== "number" ||
    !Number.isFinite(accuracy) ||
    accuracy < 0
  ) {
    return 20;
  }

  return Math.max(5, accuracy);
}

function getDriverIcon() {
  return L.divIcon({
    className: "lgb-live-driver-icon",
    html: `
      <div class="lgb-live-driver-icon__pulse">
        <div class="lgb-live-driver-icon__truck">🚚</div>
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

function formatTime(value?: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminBookingTracking({
  bookingId,
  bookingCode,
  status,
  onClose,
}: Props) {
  const [payload, setPayload] = useState<TrackingPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paused, setPaused] = useState(false);

  const requestRef = useRef<AbortController | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  const point = payload?.location ?? null;
  const hasValidCoordinates = isValidLocation(point);

  const capturedAtMs =
    hasValidCoordinates && point.capturedAt
      ? new Date(point.capturedAt).getTime()
      : Number.NaN;

  const isStale =
    !Number.isFinite(capturedAtMs) ||
    Date.now() - capturedAtMs > STALE_AFTER_MS;

  const lastUpdated = formatTime(point?.capturedAt);

  // Reset the previous booking's data and cancel its pending request.
  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;

    setPayload(null);
    setError("");
    setLoading(true);
    setRefreshing(false);
    setPaused(false);

    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [bookingId]);

  // Fetch the latest location and prevent overlapping requests.
  useEffect(() => {
    let disposed = false;
    let requestInFlight = false;
    let firstRequest = true;

    const loadLocation = async (manual = false) => {
      if (
        disposed ||
        requestInFlight ||
        !bookingId ||
        paused
      ) {
        return;
      }

      requestInFlight = true;

      const controller = new AbortController();
      requestRef.current = controller;

      if (firstRequest) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const response = await api.get<TrackingPayload>(
          `/bookings/${bookingId}/location`,
          {
            signal: controller.signal,
          }
        );

        if (disposed || controller.signal.aborted) {
          return;
        }

        const data = response.data;

        if (data?.success === false) {
          throw new Error(
            data.message || "Unable to load this booking's location."
          );
        }

        if (data?.location && !isValidLocation(data.location)) {
          throw new Error("The server returned invalid GPS coordinates.");
        }

        setPayload(data);
        setError("");
      } catch (requestError: unknown) {
        if (
          disposed ||
          controller.signal.aborted
        ) {
          return;
        }

        const request = requestError as {
          response?: {
            status?: number;
          };
        };

        setError(errorMessage(requestError));

        if (
          [401, 403, 404, 429].includes(
            request.response?.status ?? 0
          )
        ) {
          setPaused(true);
        }
      } finally {
        requestInFlight = false;

        if (requestRef.current === controller) {
          requestRef.current = null;
        }

        if (!disposed) {
          setLoading(false);
          setRefreshing(false);
          firstRequest = false;
        }
      }

      // `manual` is reserved for callers that explicitly request refresh.
      void manual;
    };

    void loadLocation();

    const intervalId = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !paused
      ) {
        void loadLocation();
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        !paused
      ) {
        void loadLocation();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      disposed = true;
      window.clearInterval(intervalId);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [bookingId, paused]);

  // Initialize the interactive map only when a valid GPS point exists.
  useEffect(() => {
    if (
      !hasValidCoordinates ||
      !mapContainerRef.current
    ) {
      return;
    }

    const initialPosition: L.LatLngExpression = [
      point.latitude,
      point.longitude,
    ];

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      preferCanvas: true,
    }).setView(initialPosition, 16);

    L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
      minZoom: 3,
    }).addTo(map);

    const marker = L.marker(initialPosition, {
      icon: getDriverIcon(),
      title: "Latest driver GPS location",
      keyboard: true,
      zIndexOffset: 1000,
    }).addTo(map);

    const accuracyCircle = L.circle(initialPosition, {
      radius: getMapAccuracy(point),
      color: "#f97316",
      fillColor: "#fb923c",
      fillOpacity: 0.12,
      weight: 2,
      interactive: false,
    }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    accuracyCircleRef.current = accuracyCircle;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      window.clearTimeout(resizeTimer);

      map.remove();

      mapRef.current = null;
      markerRef.current = null;
      accuracyCircleRef.current = null;
    };
  }, [bookingId, hasValidCoordinates]);

  // Move the existing marker when a new GPS point arrives.
  useEffect(() => {
    if (
      !hasValidCoordinates ||
      !mapRef.current ||
      !markerRef.current ||
      !accuracyCircleRef.current
    ) {
      return;
    }

    const position: L.LatLngExpression = [
      point.latitude,
      point.longitude,
    ];

    markerRef.current.setLatLng(position);
    accuracyCircleRef.current.setLatLng(position);
    accuracyCircleRef.current.setRadius(getMapAccuracy(point));

    mapRef.current.panTo(position, {
      animate: true,
      duration: 0.7,
    });
  }, [
    hasValidCoordinates,
    point?.latitude,
    point?.longitude,
    point?.accuracyMeters,
  ]);

  const refreshLocation = () => {
    if (paused) {
      setError("");
      setPaused(false);
      return;
    }

    requestRef.current?.abort();

    // A state change is not required for manual refresh.
    // The next polling cycle will run if an earlier request was active.
    setRefreshing(true);

    const controller = new AbortController();
    requestRef.current = controller;

    void api
      .get<TrackingPayload>(`/bookings/${bookingId}/location`, {
        signal: controller.signal,
      })
      .then((response) => {
        if (requestRef.current !== controller) {
          return;
        }

        const data = response.data;

        if (data?.success === false) {
          throw new Error(
            data.message || "Unable to load this booking's location."
          );
        }

        if (data?.location && !isValidLocation(data.location)) {
          throw new Error("The server returned invalid GPS coordinates.");
        }

        setPayload(data);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        const request = requestError as {
          response?: {
            status?: number;
          };
        };

        setError(errorMessage(requestError));

        if (
          [401, 403, 404, 429].includes(
            request.response?.status ?? 0
          )
        ) {
          setPaused(true);
        }
      })
      .finally(() => {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setRefreshing(false);
        }
      });
  };

  return (
    <section
      className="mt-4 overflow-hidden rounded-2xl border border-blue-200 bg-white"
      aria-label={`Live location for ${bookingCode}`}
    >
      <header className="flex flex-col justify-between gap-3 border-b border-blue-100 bg-blue-50/70 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Navigation className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h3 className="font-extrabold text-slate-900">
              Admin live tracking · {bookingCode}
            </h3>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Status: {statusLabel(status)} · Refreshes every 10 seconds
              while this panel is open.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600">
            <Clock3
              className={`h-3.5 w-3.5 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            {refreshing ? "Refreshing…" : "Auto refresh"}
          </span>

          <button
            type="button"
            onClick={refreshLocation}
            disabled={refreshing || loading}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                refreshing || loading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            aria-label="Close live tracking"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        </div>
      </header>

      <div className="p-4">
        {error && (
          <div
            role="alert"
            className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-800"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>

            {paused && (
              <button
                type="button"
                onClick={refreshLocation}
                className="ml-auto shrink-0 font-bold underline"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading the latest location…
          </div>
        )}

        {!loading && !error && !hasValidCoordinates && (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
          >
            <p className="font-extrabold">
              {payload?.reason === "delivery_finished"
                ? "Tracking has stopped"
                : payload?.reason === "waiting_for_driver"
                  ? "Waiting for driver assignment"
                  : "Waiting for the driver's first GPS point"}
            </p>

            <p className="mt-1">
              The map will appear when the assigned driver shares a valid
              location. This panel does not generate or estimate a GPS
              position.
            </p>
          </div>
        )}

        {!loading && hasValidCoordinates && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                  isStale
                    ? "bg-amber-100 text-amber-900"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {isStale
                  ? "Last location may be stale"
                  : "Recently updated"}
              </span>

              <span className="text-xs text-slate-500">
                Updated {lastUpdated}
              </span>
            </div>

            <div className="lgb-live-map-shell">
              <div
                ref={mapContainerRef}
                className="lgb-live-map"
                aria-label="Interactive map displaying the latest driver GPS location"
              />
            </div>

            <div className="mt-3 flex flex-col justify-between gap-2 text-xs text-slate-600 sm:flex-row sm:items-center">
              <span className="inline-flex flex-wrap items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-blue-700" />

                {point.latitude.toFixed(6)},{" "}
                {point.longitude.toFixed(6)}

                <span className="font-bold text-slate-700">
                  ±
                  {point.accuracyMeters != null &&
                  Number.isFinite(point.accuracyMeters) &&
                  point.accuracyMeters >= 0
                    ? `${Math.round(point.accuracyMeters)} m`
                    : "Unknown accuracy"}
                </span>
              </span>

              <a
                href={`https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=17/${point.latitude}/${point.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-blue-700 hover:underline"
              >
                Open full map
              </a>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
              <Crosshair className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                The orange circle represents the reported GPS accuracy
                radius. Smaller radius generally means a more precise
                device reading.
              </p>
            </div>

            {isStale && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                This is the latest location received, not a guaranteed
                current position. The driver may have lost network access,
                disabled GPS or closed the tracking page.
              </p>
            )}
          </>
        )}

        <div className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-slate-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <p>
            Location is displayed using the existing LogiGo tracking API.
            Access remains subject to backend authorization. Only the
            latest point returned by the server is displayed here.
          </p>
        </div>
      </div>
    </section>
  );
}