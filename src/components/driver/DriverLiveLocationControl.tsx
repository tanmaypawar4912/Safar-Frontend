import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Crosshair,
  MapPin,
  Radio,
  ShieldCheck,
  Square,
  Wifi,
} from "lucide-react";

import api from "../../services/api";

type Props = {
  bookingId: string;
  status: string;
  bookingCode?: string;
};

type GPSCoordinates = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
};

const ACTIVE_STATUSES = new Set([
  "accepted",
  "arriving_at_pickup",
  "arrived_at_pickup",
  "picked_up",
  "in_transit",
  "arrived_at_drop",
]);

const MOVEMENT_THRESHOLD_METERS = 3;
const MIN_UPLOAD_INTERVAL_MS = 2500;
const HEARTBEAT_INTERVAL_MS = 15000;

function geolocationMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. Allow location access in your browser settings.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your device could not determine its location. Check GPS and network reception.";
  }

  if (error.code === error.TIMEOUT) {
    return "GPS took too long to respond. Keep location enabled and try again.";
  }

  return "Unable to read this device's location.";
}

function calculateDistance(
  first: GPSCoordinates,
  second: GPSCoordinates
): number {
  const earthRadius = 6371000;

  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const lat1 = toRadians(first.latitude);
  const lat2 = toRadians(second.latitude);

  const deltaLat = toRadians(
    second.latitude - first.latitude
  );

  const deltaLon = toRadians(
    second.longitude - first.longitude
  );

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function formatGPSStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default function DriverLiveLocationControl({
  bookingId,
  status,
  bookingCode,
}: Props) {
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [lastSentAt, setLastSentAt] = useState("");
  const [accuracyMeters, setAccuracyMeters] =
    useState<number | null>(null);

  const [permissionReady, setPermissionReady] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const lastAttemptAtRef = useRef(0);
  const lastUploadedAtRef = useRef(0);

  const lastUploadedCoordinatesRef =
    useRef<GPSCoordinates | null>(null);

  const uploadPromiseRef = useRef<Promise<void> | null>(null);

  const canShare = ACTIVE_STATUSES.has(status);

  function clearWatch() {
    activeRef.current = false;

    if (
      watchIdRef.current !== null &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );

      watchIdRef.current = null;
    }
  }

  // Stop the previous watch if the component changes booking or unmounts.
  useEffect(() => {
    return () => {
      clearWatch();
    };
  }, [bookingId]);

  // Do not continue GPS sharing after a terminal/non-trackable status.
  useEffect(() => {
    if (!canShare && activeRef.current) {
      clearWatch();
      setSharing(false);
      setMessage("GPS sharing stopped because this delivery is no longer active.");
    }
  }, [status, canShare]);

  async function uploadPosition(
    position: GeolocationPosition
  ) {
    if (!activeRef.current) return;

    const coords = position.coords;

    if (
      !Number.isFinite(coords.latitude) ||
      !Number.isFinite(coords.longitude) ||
      coords.latitude < -90 ||
      coords.latitude > 90 ||
      coords.longitude < -180 ||
      coords.longitude > 180
    ) {
      setError("The device returned invalid GPS coordinates.");
      return;
    }

    const currentCoordinates: GPSCoordinates = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters: Number.isFinite(coords.accuracy)
        ? coords.accuracy
        : null,
    };

    // Display the latest device reading, even when it is not uploaded.
    setAccuracyMeters(currentCoordinates.accuracyMeters);

    const now = Date.now();

    const previousCoordinates =
      lastUploadedCoordinatesRef.current;

    const movedEnough =
      !previousCoordinates ||
      calculateDistance(
        previousCoordinates,
        currentCoordinates
      ) >= MOVEMENT_THRESHOLD_METERS;

    const heartbeatDue =
      !lastUploadedAtRef.current ||
      now - lastUploadedAtRef.current >=
        HEARTBEAT_INTERVAL_MS;

    // Do not upload every GPS callback.
    if (!movedEnough && !heartbeatDue) return;

    if (
      lastAttemptAtRef.current &&
      now - lastAttemptAtRef.current <
        MIN_UPLOAD_INTERVAL_MS
    ) {
      return;
    }

    if (uploadPromiseRef.current) return;

    lastAttemptAtRef.current = now;

    const payload = {
      latitude: currentCoordinates.latitude,
      longitude: currentCoordinates.longitude,
      accuracyMeters: currentCoordinates.accuracyMeters,
      headingDegrees:
        coords.heading == null ? null : coords.heading,
      speedMetersPerSecond:
        coords.speed == null ? null : coords.speed,
    };

    const uploadRequest = api
      .post(`/bookings/${bookingId}/location`, payload)
      .then(() => {
        if (!activeRef.current) return;

        lastUploadedAtRef.current = Date.now();

        lastUploadedCoordinatesRef.current =
          currentCoordinates;

        setLastSentAt(new Date().toISOString());

        setMessage(
          "Your latest GPS location is being shared with this booking's customer."
        );

        setError("");
      })
      .catch((requestError: unknown) => {
        if (!activeRef.current) return;

        const response = (
          requestError as {
            response?: {
              status?: number;
              data?: { message?: string };
            };
          }
        )?.response;

        const statusCode = response?.status;

        setError(
          response?.data?.message ||
            "Location could not be uploaded. Check your internet connection."
        );

        if (
          statusCode === 401 ||
          statusCode === 403 ||
          statusCode === 404 ||
          statusCode === 409
        ) {
          clearWatch();
          setSharing(false);

          setMessage(
            "GPS sharing stopped. Please verify your session and booking assignment."
          );
        }
      });

    uploadPromiseRef.current = uploadRequest;

    try {
      await uploadRequest;
    } finally {
      if (uploadPromiseRef.current === uploadRequest) {
        uploadPromiseRef.current = null;
      }
    }
  }

  function startSharing() {
    setError("");
    setMessage("");
    setLastSentAt("");
    setAccuracyMeters(null);

    if (!canShare) {
      setError(
        "GPS sharing is available only while handling an accepted active delivery."
      );
      return;
    }

    if (!navigator.geolocation) {
      setError(
        "This browser does not support GPS location. Try an updated browser on your phone."
      );
      return;
    }

    if (!window.isSecureContext) {
      setError(
        "GPS requires HTTPS in production. You can test locally on localhost."
      );
      return;
    }

    if (activeRef.current) return;

    if (busy) return;

    lastAttemptAtRef.current = 0;
    lastUploadedAtRef.current = 0;
    lastUploadedCoordinatesRef.current = null;
    uploadPromiseRef.current = null;

    activeRef.current = true;

    setSharing(true);
    setPermissionReady(false);

    setMessage(
      "Waiting for device GPS permission and first accurate location..."
    );

    try {
      watchIdRef.current =
        navigator.geolocation.watchPosition(
          (position) => {
            if (!activeRef.current) return;

            setPermissionReady(true);

            void uploadPosition(position);
          },

          (geoError) => {
            if (!activeRef.current) return;

            clearWatch();

            setSharing(false);
            setPermissionReady(false);

            setError(geolocationMessage(geoError));
            setMessage("");
          },

          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 20000,
          }
        );
    } catch {
      clearWatch();
      setSharing(false);

      setError(
        "Unable to start GPS tracking. Please refresh and try again."
      );
    }
  }

  async function stopSharing() {
    if (busy) return;

    setBusy(true);
    setError("");

    // Stop receiving new GPS positions immediately.
    clearWatch();
    setSharing(false);

    try {
      // Wait for any in-progress upload before deleting the latest point.
      if (uploadPromiseRef.current) {
        await uploadPromiseRef.current;
      }

      await api.delete(`/bookings/${bookingId}/location`);

      setMessage(
        "GPS sharing stopped. The customer can no longer see the latest point."
      );

      setLastSentAt("");
      setAccuracyMeters(null);
      setPermissionReady(false);
    } catch {
      setError(
        "Sharing stopped on this device, but the server could not be notified. The saved point will expire automatically."
      );

      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5"
      aria-label="Live GPS sharing"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 ring-1 ring-blue-100">
          <MapPin className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900">
              Live GPS sharing
              {bookingCode ? ` · ${bookingCode}` : ""}
            </h3>

            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                sharing
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {sharing
                ? permissionReady
                  ? "SHARING"
                  : "STARTING"
                : "OFF"}
            </span>
          </div>

          <p className="mt-1 text-xs leading-5 text-slate-600">
            Current status: {formatGPSStatus(status)}.
            Your device location is shared only while handling
            this active delivery.
          </p>

          {accuracyMeters !== null && sharing && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-blue-800">
              <Crosshair className="h-3.5 w-3.5" />
              Current device GPS accuracy: ±
              {Math.round(accuracyMeters)} metres
            </p>
          )}

          {lastSentAt && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Wifi className="h-3.5 w-3.5" />
              Last successful upload:{" "}
              {new Intl.DateTimeFormat("en-IN", {
                timeStyle: "medium",
              }).format(new Date(lastSentAt))}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="mt-2 text-xs leading-5 text-emerald-800"
            >
              {message}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {!sharing ? (
              <button
                type="button"
                onClick={startSharing}
                disabled={busy || !canShare}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#101c30] px-3.5 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Radio className="h-4 w-4" />
                {busy ? "Stopping GPS..." : "Start sharing GPS"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopSharing()}
                disabled={busy}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-xs font-extrabold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                <Square className="h-3.5 w-3.5" />
                {busy ? "Stopping..." : "Stop sharing"}
              </button>
            )}

            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/80 px-3 text-[11px] font-semibold text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Booking-only access
            </span>
          </div>

          {!canShare && (
            <p className="mt-2 text-xs text-amber-700">
              GPS sharing becomes available when you accept an active delivery.
            </p>
          )}

          <p className="mt-3 text-[10px] leading-5 text-slate-500">
            Location uploads are movement-based (approximately 3 metres)
            with a 15-second heartbeat when new GPS readings are available.
            Keep this page open while sharing.
          </p>
        </div>
      </div>
    </section>
  );
}