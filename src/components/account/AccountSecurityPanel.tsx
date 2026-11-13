import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { KeyRound, LogIn } from "lucide-react";
import { useNavigate } from "react-router";

import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function messageFromError(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) return "Your session expired. Please sign in again.";
    return error.response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

/** Email stays read-only here; users can change only their password. */
export default function AccountSecurityPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reauthRequired, setReauthRequired] = useState(false);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (newPassword.length < 8 || newPassword.length > 72) {
      setError("New password must contain 8 to 72 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (!currentPassword) {
      setError("Enter your current password to continue.");
      return;
    }

    setSaving(true);
    try {
      const response = await api.patch("/auth/change-password", { currentPassword, newPassword });
      if (!response.data?.success) throw new Error(response.data?.message || "Unable to change your password.");
      setNotice(response.data.message || "Password changed. Please sign in again.");
      setReauthRequired(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (requestError: unknown) {
      setError(messageFromError(requestError, "Unable to change your password."));
    } finally {
      setSaving(false);
    }
  }

  async function continueToLogin() {
    try { await logout(); } finally { navigate("/login", { replace: true }); }
  }

  return (
    <section className="lgp-card lgpf-card" aria-labelledby="account-security-title">
      <h2 id="account-security-title" className="lgpf-title">Change Password</h2>

      {notice && (
        <div role="status" className="lgp-success lgpf-notice">
          <span>{notice}</span>
          {reauthRequired && (
            <button type="button" onClick={() => void continueToLogin()} className="lgp-btn lgp-btn-primary">
              <LogIn aria-hidden="true" /> Sign in again
            </button>
          )}
        </div>
      )}

      {!reauthRequired && (
        <form onSubmit={handleChangePassword} className="lgpf-form">
          <div className="lgb-field">
            <label htmlFor="current-password">Current Password</label>
            <input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="lgb-input" />
          </div>
          <div className="lgb-field">
            <label htmlFor="new-password">New Password</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="lgb-input" />
          </div>
          <div className="lgb-field">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="lgb-input" />
          </div>

          {error && <p role="alert" className="lgp-alert lgp-alert-block"><span>{error}</span></p>}

          <button type="submit" disabled={saving} className="lgp-btn lgp-btn-primary lgp-btn-block">
            <KeyRound aria-hidden="true" /> {saving ? "Updating..." : "Update Password"}
          </button>
          <p className="lgpf-help">Signed in as {user?.email || "your account"}. For security, you may need to sign in again after changing the password.</p>
        </form>
      )}
    </section>
  );
}
