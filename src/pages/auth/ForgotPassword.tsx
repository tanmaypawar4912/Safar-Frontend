import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { isAxiosError } from "axios";

import AuthShell from "../../components/layout/AuthShell";
import api from "../../services/api";

function errorMessage(error: unknown) {
  if (isAxiosError(error)) {
    return error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Could not connect to Safar. Please try again when the service is available."
        : "Unable to submit your request. Please try again.");
  }
  return error instanceof Error ? error.message : "Unable to submit your request. Please try again.";
}

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitted(false);
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await api.post("/auth/forgot-password", { email: email.trim() });
      if (response.data?.success) {
        setSubmitted(true);
      } else {
        setError(response.data?.message || "Unable to submit your request.");
      }
    } catch (submitError: unknown) {
      setError(errorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={<>A secure way<br />back to your<br />account</>}
      tagline="Reset links expire after 15 minutes and can only be used once."
    >
      <h1>Forgot your password?</h1>
      <p className="lgl-sub">Enter the email address associated with your account and we’ll help you reset it.</p>

      {error && (
        <div role="alert" aria-live="polite" className="lgl-error">
          <span aria-hidden="true">!</span>
          <p>{error}</p>
        </div>
      )}

      {submitted ? (
        <div role="status" className="lgl-notice">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <h3>Check your inbox</h3>
            <p>{`If an active account exists for ${email.trim()}, a reset link will be sent shortly. Check spam too.`}</p>
            <button type="button" onClick={() => { setSubmitted(false); setError(""); }}>Use a different email</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="lgl-form">
          <div className="lgl-field">
            <label htmlFor="reset-email">Email address</label>
            <div className="lgl-input">
              <Mail aria-hidden="true" />
              <input id="reset-email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); if (error) setError(""); }} placeholder="your@email.com" />
            </div>
          </div>
          <button type="submit" disabled={isSubmitting} className="lgl-submit">
            {isSubmitting ? (<><span className="lgl-spinner" aria-hidden="true" /> Sending...</>) : "Send reset link"}
          </button>
          <p className="lgl-help">For security, the same confirmation is shown whether or not the email belongs to an account.</p>
        </form>
      )}

      <p className="lgl-switch"><Link to="/login" className="lgl-back"><ArrowLeft aria-hidden="true" /> Back to sign in</Link></p>
    </AuthShell>
  );
};

export default ForgotPassword;
