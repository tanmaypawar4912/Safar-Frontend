import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileText,
  KeyRound,
  LoaderCircle,
  Truck,
  Upload,
  UserRound,
} from "lucide-react";

import AccountSecurityPanel from "../../components/account/AccountSecurityPanel";
import ProfileCard from "../../components/account/ProfileCard";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: string;
      response?: {
        data?: {
          message?: string;
        };
      };
    };

    return (
      candidate.response?.data?.message ||
      candidate.message ||
      fallback
    );
  }

  return fallback;
}

function getInitials(name?: string | null): string {
  const parts = (name || "Driver")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function DriverProfilePhoto() {
  const { user, refreshUser } = useAuth();

  const inputRef = useRef<HTMLInputElement>(null);

  const [photoUrl, setPhotoUrl] = useState(
    user?.profileImage || ""
  );

  const [imageFailed, setImageFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setPhotoUrl(user?.profileImage || "");
    setImageFailed(false);
  }, [user?.profileImage]);

  async function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    setError("");
    setNotice("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Choose a JPG, PNG or WEBP image.");
      input.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Your image must be 8 MB or smaller.");
      input.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);

    try {
      const response = await api.post(
        "/drivers/profile/photo",
        formData
      );

      const savedPhoto = response.data?.profileImage;

      if (!response.data?.success || !savedPhoto) {
        throw new Error(
          response.data?.message ||
            "The profile photo could not be saved."
        );
      }

      setPhotoUrl(savedPhoto);
      setImageFailed(false);

      setNotice("Your profile photo has been updated.");

      // Refresh AuthContext so the saved image is reflected
      // in the authenticated account data.
      try {
        await refreshUser();
      } catch {
        // The successful upload response already provides the saved URL.
      }
    } catch (uploadError: unknown) {
      setError(
        errorMessage(
          uploadError,
          "Unable to upload your profile photo. Please try again."
        )
      );
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  const showImage = Boolean(photoUrl) && !imageFailed;

  return (
    <section
      className="flex min-w-0 max-w-full flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-label="Driver profile photo"
    >
      <div className="relative shrink-0">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-orange-100 bg-orange-50 text-xl font-black text-orange-700 shadow-sm sm:h-24 sm:w-24">
          {showImage ? (
            <img
              src={photoUrl}
              alt={`${user?.name || "Driver"} profile`}
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span aria-label="Profile photo placeholder">
              {getInitials(user?.name)}
            </span>
          )}
        </div>

        <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-white shadow-sm">
          <Camera size={15} aria-hidden="true" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-700">
          Driver account
        </p>

        <h2 className="mt-1 break-words text-lg font-black text-slate-900 sm:text-xl">
          Profile photo
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          {user?.name || "Your Safar profile"}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          JPG, PNG or WEBP. Maximum file size: 8 MB.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handlePhotoChange}
          disabled={uploading}
          aria-label="Choose a driver profile photo"
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? (
            <>
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Uploading…
            </>
          ) : (
            <>
              <Upload size={16} aria-hidden="true" />
              {photoUrl ? "Change photo" : "Upload photo"}
            </>
          )}
        </button>

        {error && (
          <p
            className="mt-3 text-sm font-medium leading-5 text-rose-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            className="mt-3 flex items-center gap-2 text-sm font-semibold leading-5 text-emerald-700"
            role="status"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}

export default function DriverProfile() {
  return (
    <main className="lgp">
      <header className="lgp-head">
        <div>
          <h1>My Profile</h1>
          <p>Manage your personal information</p>
        </div>
      </header>

      <div className="mb-6">
        <DriverProfilePhoto />
      </div>

      <div className="lgpf-layout">
        <ProfileCard accountLabel="Driver account" />
        <AccountSecurityPanel />
      </div>

      <section
        className="lgpf-quick"
        aria-label="Driver shortcuts"
      >
        <Link to="/driver/vehicles">
          <Truck aria-hidden="true" />
          <span>
            <strong>Vehicle details</strong>
            <small>Manage your vehicle information</small>
          </span>
          <ArrowRight
            className="ml-auto"
            size={16}
            aria-hidden="true"
          />
        </Link>

        <Link to="/driver/documents">
          <FileText aria-hidden="true" />
          <span>
            <strong>Documents</strong>
            <small>Review uploaded documents</small>
          </span>
          <ArrowRight
            className="ml-auto"
            size={16}
            aria-hidden="true"
          />
        </Link>

        <Link to="/driver/verification">
          <BadgeCheck aria-hidden="true" />
          <span>
            <strong>Verification</strong>
            <small>Licence and approval status</small>
          </span>
          <ArrowRight
            className="ml-auto"
            size={16}
            aria-hidden="true"
          />
        </Link>

        <Link to="/driver/jobs">
          <KeyRound aria-hidden="true" />
          <span>
            <strong>My jobs</strong>
            <small>Assigned deliveries</small>
          </span>
          <ArrowRight
            className="ml-auto"
            size={16}
            aria-hidden="true"
          />
        </Link>
      </section>

      <div className="sr-only">
        <UserRound aria-hidden="true" />
      </div>
    </main>
  );
}