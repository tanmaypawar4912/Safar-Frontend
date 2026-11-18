import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { isAxiosError } from "axios";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MessageSquareText,
  PackageCheck,
  Power,
  Star,
  Truck,
  Wallet,
  Wifi,
  WifiOff,
} from "lucide-react";
import api from "../../services/api";
import {
  useDriverJobs,
  getDriverError,
  statusLabel,
  formatDriverPrice,
  type DriverJob,
} from "../../hooks/useDriverJobs";

type Availability = "offline" | "online" | "busy";
type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

interface DriverProfileSummary {
  _id: string;
  approvalStatus: ApprovalStatus;
  availability: Availability;
  isActive: boolean;
  licenseExpiry: string;
  rejectionReason?: string;
  profileChangeRequest?: { status?: string; reason?: string } | null;
}

interface DriverOverviewSummary {
  totalReviews: number;
  averageRating: number;
  completedDeliveries: number;
  totalDriverEarnings: number | null;
}

const ACTIVE_STATUSES = [
  "accepted",
  "arriving_at_pickup",
  "arrived_at_pickup",
  "picked_up",
  "in_transit",
  "arrived_at_drop",
];

function vehicleOf(job: DriverJob) {
  if (job.vehicle && typeof job.vehicle === "object" && job.vehicle.name) return job.vehicle.name;
  return typeof job.vehicle === "string" && job.vehicle ? job.vehicle : "—";
}

function dateOf(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default function DriverDashboard() {
  const {
    jobs,
    offers,
    loading: jobsLoading,
    error: jobsError,
    loadJobs,
  } = useDriverJobs();

  const [profile, setProfile] = useState<DriverProfileSummary | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [earningsError, setEarningsError] = useState("");
  const [extrasLoading, setExtrasLoading] = useState(true);

  const [overview, setOverview] = useState<DriverOverviewSummary>({
    totalReviews: 0,
    averageRating: 0,
    completedDeliveries: 0,
    totalDriverEarnings: null,
  });

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);

    try {
      const response = await api.get("/drivers/profile");

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || "Could not load driver profile."
        );
      }

      setProfile(response.data.profile as DriverProfileSummary);
      setProfileMissing(false);
      setError("");
    } catch (requestError: unknown) {
      if (
        isAxiosError(requestError) &&
        requestError.response?.status === 404
      ) {
        setProfile(null);
        setProfileMissing(true);
        setError("");
      } else {
        setError(
          getDriverError(requestError, "Could not load driver profile.")
        );
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadOverviewExtras = useCallback(async () => {
    setExtrasLoading(true);

    const [reviewResult, completedResult, earningsResult] = await Promise.allSettled([
      api.get("/reviews/driver/mine", {
        params: { page: 1, limit: 1 },
      }),
      api.get("/bookings/driver/completed", {
        params: { page: 1, limit: 50 },
      }),
      api.get("/financial-ledger/driver/summary"),
    ]);

    let nextEarnings: number | null = null;
    let nextEarningsError = "";

    if (
      earningsResult.status === "fulfilled" &&
      earningsResult.value.data?.success &&
      earningsResult.value.data?.summary
    ) {
      const summary = earningsResult.value.data.summary;
      const onlineEarningsAccrued = Number(
        summary.driverEarningsAccruedRupees ??
          summary.driverEarningsPayableRupees ??
          0
      );
      const codEarningsRetained = Number(
        summary.driverEarningsRetainedCodRupees ?? 0
      );

      if (
        Number.isFinite(onlineEarningsAccrued) &&
        onlineEarningsAccrued >= 0 &&
        Number.isFinite(codEarningsRetained) &&
        codEarningsRetained >= 0
      ) {
        // Earnings means the driver's share, not the customer's gross fare.
        // COD earnings are already retained as cash by the driver; online
        // earnings are accrued here but may await customer payment capture.
        nextEarnings = Number(
          (onlineEarningsAccrued + codEarningsRetained).toFixed(2)
        );
      } else {
        nextEarningsError = "The financial ledger returned an invalid earnings total.";
      }
    } else if (earningsResult.status === "rejected") {
      nextEarningsError = getDriverError(
        earningsResult.reason,
        "Unable to load your earnings from the financial ledger."
      );
    } else {
      nextEarningsError =
        earningsResult.status === "fulfilled"
          ? earningsResult.value.data?.message ||
            "Unable to load your earnings from the financial ledger."
          : "Unable to load your earnings from the financial ledger.";
    }

    setOverview((current) => {
      const next = { ...current, totalDriverEarnings: nextEarnings };

      if (
        reviewResult.status === "fulfilled" &&
        reviewResult.value.data?.success
      ) {
        next.totalReviews = Number(
          reviewResult.value.data?.summary?.totalReviews || 0
        );
        next.averageRating = Number(
          reviewResult.value.data?.summary?.averageRating || 0
        );
      }

      if (
        completedResult.status === "fulfilled" &&
        completedResult.value.data?.success
      ) {
        next.completedDeliveries = Number(
          completedResult.value.data?.pagination?.total || 0
        );
      }

      return next;
    });

    setEarningsError(nextEarningsError);
    setExtrasLoading(false);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void loadOverviewExtras();
  }, [loadOverviewExtras]);

  const activeJobs = useMemo(() => jobs.filter((job) => ACTIVE_STATUSES.includes(job.status)), [jobs]);
  // "Upcoming" = pending offers plus jobs assigned to the driver that still need a response.
  const upcomingJobs = useMemo(() => {
    const seen = new Set<string>();
    return [...offers, ...jobs.filter((job) => job.status === "assigned")].filter((job) => {
      if (seen.has(job._id)) return false;
      seen.add(job._id);
      return true;
    });
  }, [jobs, offers]);
  const currentJob = activeJobs[0];

  const stats = useMemo(
    () => [
      { label: "Active Jobs", value: activeJobs.length, icon: Activity, tone: "blue", loading: jobsLoading },
      { label: "Upcoming", value: upcomingJobs.length, icon: Clock3, tone: "orange", loading: jobsLoading },
      { label: "Completed", value: overview.completedDeliveries, icon: CheckCircle2, tone: "green", loading: extrasLoading },
      {
        label: "Earnings",
        value:
          overview.totalDriverEarnings === null
            ? "—"
            : formatDriverPrice(overview.totalDriverEarnings),
        icon: Wallet,
        tone: "orange",
        loading: extrasLoading,
      },
    ],
    [activeJobs.length, upcomingJobs.length, overview, jobsLoading, extrasLoading]
  );

  const canToggle = Boolean(
    profile &&
      profile.approvalStatus === "approved" &&
      profile.isActive &&
      new Date(profile.licenseExpiry) > new Date() &&
      profile.availability !== "busy"
  );

  const currentAvailability = profile?.availability || "offline";

  async function toggleAvailability() {
    if (!profile || !canToggle || presenceBusy) return;

    setPresenceBusy(true);
    setMessage("");
    setError("");

    const next =
      currentAvailability === "online" ? "offline" : "online";

    try {
      const response = await api.patch("/drivers/availability", {
        availability: next,
      });

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || "Could not update your availability."
        );
      }

      setMessage(response.data.message || `You are now ${next}.`);

      await loadProfile();
      await loadJobs(true);
    } catch (requestError: unknown) {
      setError(
        getDriverError(requestError, "Could not update your availability.")
      );
    } finally {
      setPresenceBusy(false);
    }
  }

  const availabilityTone =
    currentAvailability === "online" ? "lgp-pill-green" : currentAvailability === "busy" ? "lgp-pill-amber" : "lgp-pill-grey";

  return (
    <main className="lgp">
      <header className="lgp-head lgp-head-split">
        <div>
          <h1>Welcome, Driver! <span aria-hidden="true">🚚</span></h1>
          <p>Your driving summary</p>
        </div>
        <div className="lgp-head-actions">
          <span className={`lgp-pill ${availabilityTone}`}>
            {currentAvailability === "online" ? <Wifi aria-hidden="true" /> : currentAvailability === "busy" ? <Activity aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
            <span className="lgp-cap">{profileLoading ? "Loading…" : currentAvailability}</span>
          </span>
          <button
            type="button"
            onClick={() => void toggleAvailability()}
            disabled={!canToggle || presenceBusy || profileLoading}
            className={`lgp-btn ${currentAvailability === "online" ? "lgp-btn-ghost" : "lgp-btn-primary"}`}
          >
            <Power aria-hidden="true" />
            {presenceBusy ? "Updating…" : currentAvailability === "online" ? "Go offline" : currentAvailability === "busy" ? "On a job" : "Go online"}
          </button>
        </div>
      </header>

      {(error || jobsError || earningsError) && (
        <div role="alert" className="lgp-alert lgp-alert-block">
          <div>
            <p>
              {error || jobsError || earningsError}
              <button
                type="button"
                onClick={() => {
                  void loadProfile();
                  void loadJobs();
                  void loadOverviewExtras();
                }}
              >
                Retry
              </button>
            </p>
            {error.includes("Cannot go online yet") && (
              <div className="lgp-inline-links">
                <Link to="/driver/documents">Review documents</Link>
                <Link to="/driver/profile">Upload documents and request changes</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {message && <div role="status" className="lgp-success">{message}</div>}

      {profileMissing && (
        <section className="lgp-card lgp-callout">
          <div>
            <h2>Complete your driver profile</h2>
            <p>Submit your licence, vehicle information and required photos/documents to request administrator approval.</p>
          </div>
          <Link to="/driver/profile" className="lgp-btn lgp-btn-primary">Complete profile <ArrowRight aria-hidden="true" /></Link>
        </section>
      )}

      <section className="lgp-stats" aria-label="Driving summary">
        {stats.map(({ label, value, icon: Icon, tone, loading }) => (
          <article key={label} className="lgp-stat">
            <span className={`lgp-stat-icon lgp-tone-${tone}`}><Icon aria-hidden="true" /></span>
            <span className="lgp-stat-copy">
              <small>{label}</small>
              <strong>{loading ? "—" : value}</strong>
            </span>
          </article>
        ))}
      </section>

      <div className="lgd-split">
        <section className="lgp-card" aria-labelledby="driver-current-job">
          <header className="lgp-card-head">
            <h2 id="driver-current-job">Current Job</h2>
            {currentJob && <span className="lgp-pill lgp-pill-blue">In Progress</span>}
          </header>

          {jobsLoading ? (
            <div className="lgp-skeletons"><span /><span /></div>
          ) : !currentJob ? (
            <div className="lgp-empty lgp-empty-sm">
              <Truck aria-hidden="true" />
              <p>No job in progress</p>
              <small>Accepted deliveries will appear here.</small>
              <Link to="/driver/jobs" className="lgp-btn lgp-btn-ghost">Open My Jobs</Link>
            </div>
          ) : (
            <div className="lgd-current">
              <ol className="lgd-timeline">
                <li>
                  <span className="lgd-dot lgd-dot-a" />
                  <div>
                    <strong>{currentJob.pickup?.address || "Pickup unavailable"}</strong>
                    <small>Pickup</small>
                  </div>
                </li>
                <li>
                  <span className="lgd-dot lgd-dot-b" />
                  <div>
                    <strong>{currentJob.drop?.address || "Drop unavailable"}</strong>
                    <small>Drop{typeof currentJob.route?.durationMinutes === "number" ? ` · Est. ${currentJob.route.durationMinutes} min` : ""}</small>
                  </div>
                </li>
              </ol>
              <div className="lgd-mini-map" aria-hidden="true">
                <svg viewBox="0 0 220 160" preserveAspectRatio="xMidYMid slice">
                  <rect width="220" height="160" fill="#e9eef3" />
                  <path className="lgb-map-road" d="M-10 110 L60 80 L110 100 L230 40" />
                  <path className="lgb-map-road" d="M40 -10 L70 70 L50 170" />
                  <path className="lgb-map-road" d="M150 -10 L130 70 L180 170" />
                  <path className="lgb-map-route" d="M52 40 C 80 56, 76 82, 108 92 S 150 100, 170 124" />
                  <g className="lgb-map-pin lgb-map-pin-a"><circle cx="52" cy="40" r="7" /><circle cx="52" cy="40" r="2.8" /></g>
                  <g className="lgb-map-pin lgb-map-pin-b"><circle cx="170" cy="124" r="7" /><circle cx="170" cy="124" r="2.8" /></g>
                </svg>
              </div>
              <div className="lgd-current-foot">
                <span><small>Status</small><strong>{statusLabel(currentJob.status)}</strong></span>
                <span><small>Fare</small><strong>{formatDriverPrice(currentJob.fare?.finalFare ?? currentJob.fare?.estimatedFare)}</strong></span>
                <Link to="/driver/jobs" className="lgp-btn lgp-btn-primary">View Details</Link>
              </div>
            </div>
          )}
        </section>

        <section className="lgp-card" aria-labelledby="driver-upcoming">
          <header className="lgp-card-head">
            <h2 id="driver-upcoming">Upcoming Jobs</h2>
            <Link to="/driver/jobs" className="lgp-link">All jobs <ArrowRight aria-hidden="true" /></Link>
          </header>

          {jobsLoading ? (
            <div className="lgp-skeletons"><span /><span /><span /></div>
          ) : upcomingJobs.length === 0 ? (
            <div className="lgp-empty lgp-empty-sm">
              <ClipboardList aria-hidden="true" />
              <p>No upcoming jobs</p>
              <small>New assignments waiting for your response will show here.</small>
            </div>
          ) : (
            <div className="lgp-table-wrap">
              <table className="lgp-table">
                <thead>
                  <tr><th>Job ID</th><th>Route</th><th>Vehicle</th><th>Date</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {upcomingJobs.slice(0, 5).map((job) => (
                    <tr key={job._id}>
                      <td data-label="Job ID"><strong>#{job.bookingCode || job._id.slice(-6).toUpperCase()}</strong></td>
                      <td data-label="Route" className="lgp-route-cell">
                        <span><b>From</b>{job.pickup?.address || "—"}</span>
                        <span><b>To</b>{job.drop?.address || "—"}</span>
                      </td>
                      <td data-label="Vehicle">{vehicleOf(job)}</td>
                      <td data-label="Date">{dateOf(job.createdAt)}</td>
                      <td data-label="Action"><Link to="/driver/jobs" className="lgp-chip lgp-chip-accent">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="lgp-duo">
        <Link to="/driver/reviews" className="lgp-card lgp-link-card">
          <span className="lgp-stat-icon lgp-tone-amber"><MessageSquareText aria-hidden="true" /></span>
          <div>
            <h2>Customer reviews</h2>
            <p>
              <strong>{extrasLoading ? "—" : overview.totalReviews}</strong> reviews received ·{" "}
              <Star aria-hidden="true" className="lgp-star" /> {extrasLoading ? "—" : overview.averageRating.toFixed(1)}
            </p>
          </div>
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link to="/driver/completed" className="lgp-card lgp-link-card">
          <span className="lgp-stat-icon lgp-tone-green"><PackageCheck aria-hidden="true" /></span>
          <div>
            <h2>Completed deliveries</h2>
            <p><strong>{extrasLoading ? "—" : overview.completedDeliveries}</strong> successfully delivered</p>
          </div>
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>
      <p className="lgp-footnote">
        Earnings shows your driver share recorded in the financial ledger (online earnings accrued plus COD earnings retained), not the customer's gross fare. Online earnings become payout-eligible only after customer payment is captured; COD commission may be due to LogiGo. This is not a payout or settlement statement.
      </p>
    </main>
  );
}
