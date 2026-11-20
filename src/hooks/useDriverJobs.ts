
import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { subscribeToDriverDispatch } from "../services/trackingSocket";

export type BookingStatus =
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

export type JobFilter = "all" | "action" | "active" | "completed";

export interface DriverJob {
  _id: string;
  bookingCode?: string;
  status: BookingStatus;
  createdAt?: string;
  updatedAt?: string;

  pickup?: {
    address?: string;
  };

  drop?: {
    address?: string;
  };

  package?: {
    description?: string;
    weightKg?: number;
    specialInstructions?: string;
  };

  route?: {
    distanceKm?: number;
    durationMinutes?: number;
  };

  vehicle?:
    | {
        _id?: string;
        name?: string;
        capacityKg?: number;
        slug?: string;
      }
    | string
    | null;

  customer?:
    | {
        name?: string;
        phone?: string;
        email?: string;
      }
    | string
    | null;

  fare?: {
    estimatedFare?: number;
    finalFare?: number | null;
    currency?: string;
  };

  dispatch?: {
    status?: "searching" | "offering" | "accepted" | "exhausted";
    offers?: {
      driver?: string;
      status?: "offered" | "accepted" | "rejected" | "expired" | "lost";
      offeredAt?: string;
      expiresAt?: string;
    }[];
  };
}

export const activeStatuses: BookingStatus[] = [
  "accepted",
  "arriving_at_pickup",
  "arrived_at_pickup",
  "picked_up",
  "in_transit",
  "arrived_at_drop",
];

interface DriverJobsResponse {
  success: boolean;
  message?: string;
  driverUserId?: string;
  count?: number;
  jobs?: DriverJob[];
  bookings?: DriverJob[];
  offers?: DriverJob[];
}

interface ActiveRequest {
  driverId: string;
  sequence: number;
  controller: AbortController;
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(
    /\b\w/g,
    (letter) => letter.toUpperCase()
  );
}

export function formatDriverPrice(amount?: number | null) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getDriverError(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401) {
      return "Your login session has expired. Please sign in again.";
    }

    if (status === 403) {
      return (
        error.response?.data?.message ||
        "This account does not have permission to access driver jobs."
      );
    }

    if (status === 404) {
      return (
        error.response?.data?.message ||
        "The requested driver resource was not found."
      );
    }

    if (status === 409) {
      return (
        error.response?.data?.message ||
        "This job has changed. Refresh the list."
      );
    }

    if (status === 429) {
      return "Too many requests. Wait a moment before trying again.";
    }

    return (
      error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Cannot connect to Safar. Check that the backend is running."
        : fallback)
    );
  }

  return error instanceof Error ? error.message : fallback;
}

export function useDriverJobs() {
  const { user, isLoading: authLoading } = useAuth();

  // Never use a driver ID supplied by the page or URL.
  const driverUserId =
    user?.role === "driver" && user.id
      ? String(user.id)
      : null;

  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [offers, setOffers] = useState<DriverJob[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Set only after the backend confirms the authenticated driver identity.
  const [verifiedDriverId, setVerifiedDriverId] =
    useState<string | null>(null);

  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const refreshPendingRef = useRef(false);

  const loadJobs = useCallback(
    async (silent = false) => {
      const requestedDriverId = driverUserId;

      if (authLoading) return;

      if (!requestedDriverId) {
        setJobs([]);
        setOffers([]);
        setVerifiedDriverId(null);
        setError("");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Avoid duplicate requests for the same authenticated driver.
      if (
        activeRequestRef.current?.driverId === requestedDriverId
      ) {
        // Coalesce socket/poll refresh signals and run one fresh request as soon
        // as the current request settles; do not lose an offer event to an
        // already-running request.
        refreshPendingRef.current = true;
        return;
      }

      activeRequestRef.current?.controller.abort();

      const controller = new AbortController();
      const sequence = ++requestSequenceRef.current;

      activeRequestRef.current = {
        driverId: requestedDriverId,
        sequence,
        controller,
      };

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError("");
      }

      try {
        const response = await api.get<DriverJobsResponse>(
          "/bookings/driver/jobs",
          {
            signal: controller.signal,
          }
        );

        if (
          controller.signal.aborted ||
          sequence !== requestSequenceRef.current
        ) {
          return;
        }

        if (response.data?.success !== true) {
          throw new Error(
            response.data?.message ||
              "Could not load driver jobs."
          );
        }

        // Strict identity verification.
        // The backend must derive this value from req.user.userId.
        const responseDriverId = String(
          response.data.driverUserId ?? ""
        );

        if (
          !responseDriverId ||
          responseDriverId !== requestedDriverId
        ) {
          throw new Error(
            "Driver identity verification failed. Please sign in again and refresh."
          );
        }

        const jobItems =
          response.data.jobs ?? response.data.bookings ?? [];

        const offerItems = response.data.offers ?? [];

        if (
          !Array.isArray(jobItems) ||
          !Array.isArray(offerItems)
        ) {
          throw new Error(
            "The driver jobs response has an invalid format."
          );
        }

        // The server already filters jobs by the authenticated driver.
        setJobs(jobItems);
        setOffers(offerItems);

        setVerifiedDriverId(requestedDriverId);
        setError("");
      } catch (requestError: unknown) {
        if (
          controller.signal.aborted ||
          sequence !== requestSequenceRef.current
        ) {
          return;
        }

        // Fail closed: no stale or unverified jobs remain visible.
        setJobs([]);
        setOffers([]);
        setVerifiedDriverId(null);

        setError(
          getDriverError(
            requestError,
            "Could not load driver jobs."
          )
        );
      } finally {
        if (sequence === requestSequenceRef.current) {
          const refreshAgain = refreshPendingRef.current;
          refreshPendingRef.current = false;
          activeRequestRef.current = null;
          setLoading(false);
          setRefreshing(false);

          if (refreshAgain) {
            window.setTimeout(() => void loadJobs(true), 0);
          }
        }
      }
    },
    [driverUserId, authLoading]
  );

  useEffect(() => {
    // Cancel requests belonging to a previous account.
    requestSequenceRef.current += 1;
    refreshPendingRef.current = false;

    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;

    // Clear previous account data immediately.
    setJobs([]);
    setOffers([]);
    setVerifiedDriverId(null);
    setError("");
    setRefreshing(false);

    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!driverUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    void loadJobs(false);

    // Real-time events prompt an immediate REST refresh. The REST endpoint is
    // still the source of truth and the interval covers disconnected sockets.
    const unsubscribeDispatch = subscribeToDriverDispatch({
      onOffer: () => void loadJobs(true),
      onOfferClosed: () => void loadJobs(true),
      onJobUpdated: () => void loadJobs(true),
      onConnected: () => void loadJobs(true),
    });

    // Keep polling as a recovery path for sleeping tabs, missed events and
    // temporary Socket.IO/network failures.
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadJobs(true);
      }
    }, 8000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadJobs(true);
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(refreshTimer);
      unsubscribeDispatch();
      refreshPendingRef.current = false;

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      activeRequestRef.current?.controller.abort();
      activeRequestRef.current = null;

      requestSequenceRef.current += 1;
    };
  }, [driverUserId, authLoading, loadJobs]);

  const identityVerified =
    Boolean(driverUserId) &&
    verifiedDriverId === driverUserId;

  return {
    jobs: identityVerified ? jobs : [],
    offers: identityVerified ? offers : [],

    loading: authLoading || loading,
    refreshing,
    error,

    identityVerified,

    loadJobs,

    // Kept for compatibility with existing consumers.
    setJobs,
    setOffers,
  };
}
