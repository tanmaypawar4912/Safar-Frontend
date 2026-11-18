import { io, type Socket } from "socket.io-client";
import api from "./api";

export type RealtimeTrackingPoint = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  headingDegrees?: number | null;
  speedMetersPerSecond?: number | null;
  capturedAt?: string;
};

type LocationEnvelope = {
  bookingId?: string;
  location?: RealtimeTrackingPoint | null;
};

type StoppedEnvelope = {
  bookingId?: string;
  reason?: string;
};

type SubscribeAcknowledgement = {
  success?: boolean;
  subscribed?: boolean;
  trackingActive?: boolean;
  code?: string;
};

function getSocketOrigin(): string {
  const configuredBaseUrl = api.defaults.baseURL?.trim();
  if (!configuredBaseUrl) return window.location.origin;

  try {
    return new URL(configuredBaseUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

function isValidTrackingPoint(
  point: RealtimeTrackingPoint | null | undefined
): point is RealtimeTrackingPoint {
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

/**
 * Subscribe to a single booking room using the existing HTTP-only accessToken
 * cookie. No JWT is read or stored in browser JavaScript. Callers should keep
 * their existing REST polling as a fallback if this socket cannot connect.
 */
export function subscribeToBookingTracking(
  bookingId: string,
  onLocation: (location: RealtimeTrackingPoint) => void,
  onStopped: (reason?: string) => void
): () => void {
  let disposed = false;
  let subscribed = false;

  const socket: Socket = io(getSocketOrigin(), {
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10_000,
  });

  const subscribe = () => {
    if (disposed || !socket.connected) return;

    socket.emit(
      "tracking:subscribe",
      { bookingId },
      (acknowledgement: SubscribeAcknowledgement) => {
        subscribed = Boolean(acknowledgement?.success && acknowledgement?.subscribed);
      }
    );
  };

  const handleLocation = (event: LocationEnvelope) => {
    if (
      disposed ||
      event?.bookingId !== bookingId ||
      !isValidTrackingPoint(event.location)
    ) {
      return;
    }

    onLocation(event.location);
  };

  const handleStopped = (event: StoppedEnvelope) => {
    if (disposed || event?.bookingId !== bookingId) return;
    onStopped(event.reason);
  };

  socket.on("connect", subscribe);
  socket.on("tracking:location", handleLocation);
  socket.on("tracking:stopped", handleStopped);
  // Intentionally do not surface socket errors to the user. Existing REST
  // polling remains active and is the fallback for unavailable realtime.

  return () => {
    disposed = true;
    socket.off("connect", subscribe);
    socket.off("tracking:location", handleLocation);
    socket.off("tracking:stopped", handleStopped);

    if (socket.connected && subscribed) {
      socket.emit("tracking:unsubscribe", { bookingId });
    }
    socket.disconnect();
  };
}
