import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { BadgeCheck, CheckCircle2, Save } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function formatJoinedDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function messageFromError(error: unknown) {
  if (isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Cannot connect to Safar. Check that the backend server is running."
        : "Could not update your profile. Please try again.")
    );
  }
  return error instanceof Error ? error.message : "Could not update your profile. Please try again.";
}

/**
 * Shared "My Profile" card for the customer and driver workspaces.
 * Only name and phone are editable (same PATCH /auth/profile contract as before).
 */
export default function ProfileCard({ accountLabel }: { accountLabel: string }) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
  }, [user?.name, user?.phone]);

  const initials =
    (user?.name || "LG")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "LG";

  const dirty = name.trim() !== (user?.name ?? "") || phone.trim() !== (user?.phone ?? "");

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedPhone = phone.trim().replace(/[\s()-]/g, "");
    if (name.trim().length < 2) {
      setError("Name must contain at least 2 characters.");
      return;
    }
    if (normalizedPhone && !/^\+?[1-9]\d{6,14}$/.test(normalizedPhone)) {
      setError("Enter a valid phone number with country code, if applicable.");
      return;
    }

    setSaving(true);
    try {
      const response = await api.patch("/auth/profile", { name: name.trim(), phone: normalizedPhone });
      if (!response.data?.success) {
        throw new Error(response.data?.message || "Unable to update your profile.");
      }
      await refreshUser();
      setSuccess(response.data.message || "Profile updated successfully.");
    } catch (requestError: unknown) {
      setError(messageFromError(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="lgp-card lgpf-card" aria-labelledby="profile-card-title">
      <div className="lgpf-top">
        <span className="lgpf-avatar">
          {user?.profileImage && !avatarFailed ? (
            <img src={user.profileImage} alt="" onError={() => setAvatarFailed(true)} />
          ) : (
            initials
          )}
        </span>
        <div>
          <h2 id="profile-card-title">{user?.name || "Safar user"}</h2>
          <span className="lgp-pill lgp-pill-green"><BadgeCheck aria-hidden="true" /> {accountLabel}</span>
          <p>Member since {formatJoinedDate(user?.createdAt)}</p>
        </div>
      </div>

      {error && <p role="alert" className="lgp-alert lgp-alert-block"><span>{error}</span></p>}
      {success && (
        <p role="status" className="lgp-success"><CheckCircle2 aria-hidden="true" /> {success}</p>
      )}

      <form onSubmit={handleSave} className="lgpf-form">
        <div className="lgpf-grid2">
          <div className="lgb-field">
            <label htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={50}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="lgb-input"
            />
          </div>
          <div className="lgb-field">
            <label htmlFor="profile-phone">Phone Number</label>
            <input
              id="profile-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={16}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98765 43210"
              className="lgb-input"
            />
          </div>
          <div className="lgb-field lgpf-wide">
            <label htmlFor="profile-email">Email Address</label>
            <input id="profile-email" value={user?.email || ""} readOnly disabled className="lgb-input" />
            <small className="lgpf-help">Email, account role and activation status cannot be changed here.</small>
          </div>
        </div>

        <button type="submit" disabled={saving || !dirty} className="lgp-btn lgp-btn-primary lgp-btn-block">
          <Save aria-hidden="true" /> {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </section>
  );
}
