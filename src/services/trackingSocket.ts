import api from "./api";

export type LiveTrackingPoint = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  headingDegrees?: number | null;
  speedMetersPerSecond?: number | null;
  capturedAt: string;
};

type TrackingSocketEvent = { bookingId?: string; location?: LiveTrackingPoint; reason?: string };

type TrackingSocketAck = {
  success: boolean;
  subscribed?: boolean;
  trackingActive?: boolean;
  code?: string;
  message?: string;
};

type SocketLike = {
  connected: boolean;
  on(event: string, listener: (payload?: TrackingSocketEvent) => void): SocketLike;
  off(event: string, listener: (payload?: TrackingSocketEvent) => void): SocketLike;
  emit(event: string, payload: unknown, acknowledge?: (response: TrackingSocketAck) => void): SocketLike;
  connect(): SocketLike;
  disconnect(): SocketLike;
};

type SocketFactory = (
  uri: string,
  options: {
    withCredentials: boolean;
    reconnection: boolean;
    reconnectionAttempts: number;
    reconnectionDelay: number;
    reconnectionDelayMax: number;
    timeout: number;
  }
) => SocketLike;

declare global {
  interface Window {
    io?: SocketFactory;
  }
}

const SOCKET_SCRIPT_ID = "logigo-socket-io-client";
let socketClientScript: Promise<boolean> | null = null;

function socketOrigin(): string {
  const configuredBase = api.defaults.baseURL || window.location.origin;
  return new URL(configuredBase, window.location.origin).origin;
}

function ensureSocketClient(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.io) return Promise.resolve(true);
  if (socketClientScript) return socketClientScript;

  socketClientScript = new Promise<boolean>((resolve) => {
    const existing = document.getElementById(SOCKET_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing || document.createElement("script");
    let settled = false;

    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      resolve(ready && Boolean(window.io));
    };
    const onLoad = () => finish(true);
    const onError = () => finish(false);

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!existing) {
      script.id = SOCKET_SCRIPT_ID;
      script.async = true;
      script.src = `${socketOrigin()}/socket.io/socket.io.js`;
      document.head.appendChild(script);
    } else if ((existing as HTMLScriptElement).dataset.loaded === "true") {
      finish(true);
    }

    // Handles a script which has already loaded before this subscriber mounted.
    if (window.io) finish(true);
  }).finally(() => {
    if (!window.io) socketClientScript = null;
  });

  return socketClientScript;
}

export type TrackingSocketHandlers = {
  onLocation: (location: LiveTrackingPoint) => void;
  onStopped?: (reason: string) => void;
};

/**
 * Subscribe to one booking's authenticated Socket.IO room. The REST polling
 * already present in the Customer and Admin components remains active as the
 * fallback whenever the socket script or connection is unavailable.
 */
export function subscribeToBookingTracking(
  bookingId: string,
  handlers: TrackingSocketHandlers
): () => void {
  let cancelled = false;
  let socket: SocketLike | null = null;

  const cleanup = () => {
    cancelled = true;
    if (!socket) return;
    if (socket.connected) {
      socket.emit("tracking:unsubscribe", { bookingId });
    }
    socket.off("connect", onConnect);
    socket.off("tracking:location", onLocation);
    socket.off("tracking:stopped", onStopped);
    socket.disconnect();
    socket = null;
  };

  const onConnect = () => {
    socket?.emit("tracking:subscribe", { bookingId }, () => {
      // Subscription failures are deliberately non-fatal; REST polling remains
      // the source-of-truth fallback and reports permission/API errors itself.
    });
  };

  const onLocation = (payload?: TrackingSocketEvent) => {
    if (payload?.bookingId !== bookingId || !payload.location) return;
    handlers.onLocation(payload.location);
  };

  const onStopped = (payload?: TrackingSocketEvent) => {
    if (payload?.bookingId !== bookingId) return;
    handlers.onStopped?.(payload.reason || "sharing_stopped");
  };

  void ensureSocketClient().then((ready) => {
    if (cancelled || !ready || !window.io) return;
    socket = window.io(socketOrigin(), {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Number.POSITIVE_INFINITY,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socket.on("connect", onConnect);
    socket.on("tracking:location", onLocation);
    socket.on("tracking:stopped", onStopped);
    socket.connect();
  }).catch(() => {
    // The REST polling path remains operational when Socket.IO is unavailable.
  });

  return cleanup;
}
