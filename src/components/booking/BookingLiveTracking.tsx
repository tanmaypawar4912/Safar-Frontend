import { useCallback, useEffect, useRef, useState } from "react";
import * as L from "leaflet";

import "leaflet/dist/leaflet.css";
import "./BookingLiveTracking.css";

import {
  AlertCircle,
  Clock3,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Crosshair,
} from "lucide-react";

import api from "../../services/api";
import { subscribeToBookingTracking } from "../../services/trackingSocket";

type Props = {
  bookingId: string;
  status: string;
};

type LiveLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  headingDegrees?: number | null;
  speedMetersPerSecond?: number | null;
  capturedAt: string;
};

type TrackingResponse = {
  success: boolean;
  trackingActive: boolean;

  reason:
    | "delivery_finished"
    | "waiting_for_driver"
    | "waiting_for_location"
    | "sharing_stopped"
    | null;

  location: LiveLocation | null;
};

const ACTIVE_STATUSES = new Set([
  "accepted",
  "arriving_at_pickup",
  "arrived_at_pickup",
  "picked_up",
  "in_transit",
  "arrived_at_drop",
]);

const TERMINAL_STATUSES = new Set([
  "delivered",
  "cancelled",
]);

const POLL_INTERVAL_MS = 5000;
const STALE_AFTER_MS = 45000;

const OSM_TILE_URL =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

function formatTime(value?: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return "Time unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function isValidLocation(
  location: LiveLocation | null | undefined
): location is LiveLocation {
  return Boolean(
    location &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180 &&
      location.latitude !== 0
  );
}

function getMapAccuracy(location: LiveLocation) {
  const accuracy = location.accuracyMeters;

  if (
    typeof accuracy !== "number" ||
    !Number.isFinite(accuracy) ||
    accuracy < 0
  ) {
    return 20;
  }

  return Math.max(5, accuracy);
}

function getMapDriverIcon() {
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

export default function BookingLiveTracking({
  bookingId,
  status,
}: Props) {
  const [tracking, setTracking] =
    useState<TrackingResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);

  const requestRef = useRef<AbortController | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  const shouldPoll = ACTIVE_STATUSES.has(status);
  const terminal = TERMINAL_STATUSES.has(status);

  const location = tracking?.location || null;
  const hasLocation = isValidLocation(location);

  const capturedAtMs = hasLocation
    ? new Date(location.capturedAt).getTime()
    : Number.NaN;

  const ageMs = Number.isFinite(capturedAtMs)
    ? Math.max(0, Date.now() - capturedAtMs)
    : Number.POSITIVE_INFINITY;

  const isFresh = Boolean(
    hasLocation && ageMs <= STALE_AFTER_MS
  );

  // Reset old booking data immediately when a different booking opens.
  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;

    setTracking(null);
    setError("");
    setPaused(false);
    setLoading(false);

    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [bookingId]);

  const loadLocation = useCallback(async () => {
    if (
      !bookingId ||
      requestRef.current ||
      paused ||
      terminal ||
      !shouldPoll
    ) {
      return;
    }

    const controller = new AbortController();

    requestRef.current = controller;
    setLoading(true);

    try {
      const response = await api.get(
        `/bookings/${bookingId}/location`,
        {
          signal: controller.signal,
        }
      );

      if (controller.signal.aborted) return;

      if (!response.data?.success) {
        throw new Error(
          response.data?.message ||
            "Unable to load live location."
        );
      }

      const data = response.data as TrackingResponse;

      if (
        data.location &&
        !isValidLocation(data.location)
      ) {
        throw new Error(
          "The server returned invalid GPS coordinates."
        );
      }

      setTracking(data);
      setError("");
    } catch (requestError: unknown) {
      if (
        controller.signal.aborted
      ) {
        return;
      }

      const request = requestError as {
        response?: {
          status?: number;
          data?: { message?: string };
        };
        code?: string;
      };

      const statusCode = request.response?.status;

      setError(
        request.response?.data?.message ||
          (request.code === "ERR_NETWORK"
            ? "Cannot connect to LogiGo API. Check your connection."
            : "Live location is temporarily unavailable.")
      );

      if (
        [401, 403, 404, 429].includes(statusCode || 0)
      ) {
        setPaused(true);
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [
    bookingId,
    paused,
    terminal,
    shouldPoll,
  ]);

  // Receive immediate GPS events when Socket.IO is available. The existing
  // REST polling effect below remains active as a resilience fallback.
  useEffect(() => {
    if (!bookingId || !shouldPoll || terminal) return;

    return subscribeToBookingTracking(bookingId, {
      onLocation: (nextLocation) => {
        setTracking((current) => {
          const currentTime = current?.location?.capturedAt
            ? new Date(current.location.capturedAt).getTime()
            : Number.NEGATIVE_INFINITY;
          const nextTime = new Date(nextLocation.capturedAt).getTime();
          if (Number.isFinite(nextTime) && nextTime < currentTime) return current;
          return {
            success: true,
            trackingActive: true,
            reason: null,
            location: nextLocation,
          };
        });
        setError("");
      },
      onStopped: (reason) => {
        setTracking({
          success: true,
          trackingActive: false,
          reason: reason === "delivery_finished" ? "delivery_finished" : "sharing_stopped",
          location: null,
        });
      },
    });
  }, [bookingId, shouldPoll, terminal]);

  // Poll while this delivery is active.
  useEffect(() => {
    if (!shouldPoll || terminal || paused) {
      return;
    }

    void loadLocation();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadLocation();
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadLocation();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(intervalId);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [
    shouldPoll,
    terminal,
    paused,
    loadLocation,
  ]);

  // Create the interactive Leaflet map only after receiving a real GPS point.
  useEffect(() => {
    if (
      !hasLocation ||
      !mapContainerRef.current
    ) {
      return;
    }

    const initialPosition: L.LatLngExpression = [
      location.latitude,
      location.longitude,
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

    const driverMarker = L.marker(initialPosition, {
      icon: getMapDriverIcon(),
      title: "Live driver location",
      keyboard: true,
      zIndexOffset: 1000,
    }).addTo(map);

    const accuracyCircle = L.circle(initialPosition, {
      radius: getMapAccuracy(location),
      color: "#f97316",
      fillColor: "#fb923c",
      fillOpacity: 0.12,
      weight: 2,
      interactive: false,
    }).addTo(map);

    mapRef.current = map;
    markerRef.current = driverMarker;
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
  }, [
    bookingId,
    hasLocation,
  ]);

  // Update the existing driver marker without recreating the map.
  useEffect(() => {
    if (
      !hasLocation ||
      !mapRef.current ||
      !markerRef.current ||
      !accuracyCircleRef.current
    ) {
      return;
    }

    const position: L.LatLngExpression = [
      location.latitude,
      location.longitude,
    ];

    markerRef.current.setLatLng(position);

    accuracyCircleRef.current.setLatLng(position);

    accuracyCircleRef.current.setRadius(
      getMapAccuracy(location)
    );

    // Smoothly pan when new GPS coordinates arrive.
    mapRef.current.panTo(position, {
      animate: true,
      duration: 0.7,
    });
  }, [
    hasLocation,
    location?.latitude,
    location?.longitude,
    location?.accuracyMeters,
  ]);

  const refreshLocation = () => {
    if (paused) {
      setPaused(false);
      setError("");
      return;
    }

    void loadLocation();
  };

  return (
    <section
      className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      aria-label="Live driver tracking"
    >
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Navigation className="h-5 w-5" />
          </span>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              Live driver location
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Driver location updates automatically while the
              assigned driver is sharing GPS.
            </p>
          </div>
        </div>

        {shouldPoll && !terminal && (
          <button
            type="button"
            onClick={refreshLocation}
            disabled={loading}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Refresh location
          </button>
        )}
      </div>

      <div className="p-4 sm:p-6">
        {terminal ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            <p className="font-bold text-slate-900">
              Tracking has stopped
            </p>

            <p className="mt-1 leading-6">
              Live GPS sharing is no longer shown for a{" "}
              {status === "delivered"
                ? "completed"
                : "cancelled"}{" "}
              booking.
            </p>
          </div>
        ) : !shouldPoll ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-extrabold text-amber-900">
              Live tracking will start after driver acceptance
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-800">
              Once the assigned driver accepts and starts
              sharing GPS, the latest location will appear here.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                <span>{error}</span>

                {paused && (
                  <button
                    type="button"
                    onClick={refreshLocation}
                    className="ml-auto shrink-0 font-extrabold underline"
                  >
                    Resume
                  </button>
                )}
              </div>
            )}

            {hasLocation ? (
              <>
                {/* Status and timestamp */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${
                      isFresh
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isFresh
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }`}
                    />

                    {isFresh
                      ? "Recently updated"
                      : "Location may be stale"}
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    Updated {formatTime(location.capturedAt)}
                  </span>
                </div>

                {/* Interactive OpenStreetMap */}
                <div className="lgb-live-map-shell">
                  <div
                    ref={mapContainerRef}
                    className="lgb-live-map"
                    aria-label="Interactive map displaying the latest driver GPS location"
                  />
                </div>

                {/* Coordinates and accuracy */}
                <div className="mt-3 flex flex-col justify-between gap-2 text-xs text-slate-500 sm:flex-row sm:items-center">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-blue-700" />

                    {location.latitude.toFixed(6)},{" "}
                    {location.longitude.toFixed(6)}

                    <span className="font-bold text-slate-700">
                      ±
                      {location.accuracyMeters != null
                        ? `${Math.round(location.accuracyMeters)} m`
                        : "Unknown accuracy"}
                    </span>
                  </span>

                  <a
                    href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=17/${location.latitude}/${location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-blue-700 hover:underline"
                  >
                    Open full map
                  </a>
                </div>

                {/* Explanation of GPS accuracy */}
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                  <Crosshair className="mt-0.5 h-4 w-4 shrink-0" />

                  <p>
                    The orange circle represents the reported GPS
                    accuracy radius. Smaller radius generally
                    means a more precise device reading.
                  </p>
                </div>

                {!isFresh && (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    This is the last location received, not a
                    guaranteed current position. The driver may
                    have lost network access, disabled GPS or
                    closed the tracking page.
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-extrabold text-slate-900">
                  {tracking?.reason === "waiting_for_driver"
                    ? "Waiting for driver acceptance"
                    : "Waiting for first GPS update"}
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {tracking?.reason === "waiting_for_driver"
                    ? "Location sharing becomes available after the assigned driver accepts the delivery."
                    : "The assigned driver must open My Jobs, allow browser location access and start GPS sharing."}
                </p>

                {loading && (
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Checking for location...
                  </p>
                )}

                <p className="mt-3 text-xs text-slate-500">
                  Location is checked approximately every 5 seconds
                  while this page is visible.
                </p>
              </div>
            )}
          </>
        )}

        {/* Privacy notice */}
        <div className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-slate-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />

          Only the customer who owns this booking, the assigned
          driver and authorized administrators can access tracking.
          Only the latest point is retained by the tracking system.
        </div>
      </div>
    </section>
  );
}