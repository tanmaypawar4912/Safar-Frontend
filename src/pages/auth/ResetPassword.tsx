import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { isAxiosError } from "axios";

import AuthShell from "../../components/layout/AuthShell";
import api from "../../services/api";

function resetErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    return error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Could not connect to Safar. Please try again when the service is available."
        : "Unable to reset your password. Please try again.");
  }
  return error instanceof Error ? error.message : "Unable to reset your password. Please try again.";
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (isSubmitting) return;

    if (!token) {
      setError("This reset link is missing its token. Request a new password reset link.");
      return;
    }
    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }
    if (password.length > 128) {
      setError("Your password must be no more than 128 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post("/auth/reset-password", { token, password });
      if (response.data?.success) {
        setSuccess(true);
      } else {
        setError(response.data?.message || "Unable to reset your password.");
      }
    } catch (submitError: unknown) {
      setError(resetErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={<>Choose a strong<br />new password</>}
      tagline="Reset links expire after 15 minutes and can only be used once."
    >
      {success ? (
        <div role="status" className="lgl-done">
          <span><CheckCircle2 aria-hidden="true" /></span>
          <h1>You’re all set.</h1>
          <p className="lgl-sub">Your password was changed. Sign in using your new password to continue.</p>
          <button type="button" onClick={() => navigate("/login", { replace: true })} className="lgl-submit">Go to sign in</button>
        </div>
      ) : (
        <>
          <h1>Set a new password</h1>
          <p className="lgl-sub">Choose a new password for your Safar account. Use 8–128 characters.</p>

          {error && (
            <div role="alert" aria-live="polite" className="lgl-error">
              <span aria-hidden="true">!</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="lgl-form">
            <div className="lgl-field">
              <label htmlFor="new-password">New password</label>
              <div className="lgl-input">
                <LockKeyhole aria-hidden="true" />
                <input id="new-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => { setPassword(event.target.value); if (error) setError(""); }} placeholder="New password" />
                <button type="button" className="lgl-eye" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>
            <div className="lgl-field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <div className="lgl-input">
                <LockKeyhole aria-hidden="true" />
                <input id="confirm-password" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" required value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); if (error) setError(""); }} placeholder="Repeat new password" />
                <button type="button" className="lgl-eye" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} aria-pressed={showConfirmPassword}>
                  {showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isSubmitting || !token} className="lgl-submit">
              {isSubmitting ? (<><span className="lgl-spinner" aria-hidden="true" /> Updating password...</>) : "Update password"}
            </button>
            {!token && <p role="alert" className="lgl-error-text">This link does not contain a reset token. Request a new link.</p>}
          </form>
        </>
      )}

      <p className="lgl-switch"><Link to="/login" className="lgl-back"><ArrowLeft aria-hidden="true" /> Back to sign in</Link></p>
    </AuthShell>
  );
};

export default ResetPassword;
