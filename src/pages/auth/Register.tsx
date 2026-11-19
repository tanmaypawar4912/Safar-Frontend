import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  Truck,
  UserRound,
  UsersRound,
} from "lucide-react";

import AuthShell from "../../components/layout/AuthShell";
import { useAuth } from "../../context/AuthContext";

type RegistrationError = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
};

function getRegistrationErrorMessage(
  error: unknown
): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as RegistrationError;

    if (candidate.response?.data?.message) {
      return candidate.response.data.message;
    }

    if (candidate.message) {
      return candidate.message;
    }
  }

  return "Unable to create your account right now. Please try again.";
}

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [role, setRole] = useState<"customer" | "driver">(
    "customer"
  );

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (isSubmitting) return;

    if (name.trim().length < 2) {
      setError(
        "Please enter your full name (at least 2 characters)."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Your password must be at least 8 characters long."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match. Please check and try again."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        role,
      });

      if (!response.success) {
        setError(
          response.message || "Unable to create your account."
        );
        return;
      }

      if (role === "driver") {
        navigate("/driver/profile", { replace: true });
      } else {
        navigate("/customer", { replace: true });
      }
    } catch (submitError: unknown) {
      setError(
        getRegistrationErrorMessage(submitError)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      wide
      title={
        <>
          Every move starts
          <br />
          with a smarter
          <br />
          connection
        </>
      }
      tagline="Smart. Safe. Sustainable."
    >
      {/* Logo is handled by AuthShell. No top back button. */}

      <h1>Create your account</h1>

      <p className="lgl-sub">
        Choose how you want to use Safar. Drivers complete
        licence and vehicle verification after sign-up.
      </p>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="lgl-error"
        >
          <span aria-hidden="true">!</span>
          <p>{error}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="lgl-form"
      >
        <fieldset className="lgl-fieldset">
          <legend>I want to</legend>

          <div className="lgl-role-grid">
            <button
              type="button"
              aria-pressed={role === "customer"}
              onClick={() => setRole("customer")}
              className={`lgl-role${role === "customer" ? " is-active" : ""}`}
            >
              <span>
                <UsersRound aria-hidden="true" />
              </span>

              <div>
                <strong>Book deliveries</strong>
                <small>
                  Send goods with verified drivers
                </small>
              </div>

              {role === "customer" && (
                <CheckCircle2
                  className="lgl-role-check"
                  aria-hidden="true"
                />
              )}
            </button>

            <button
              type="button"
              aria-pressed={role === "driver"}
              onClick={() => setRole("driver")}
              className={`lgl-role${role === "driver" ? " is-active" : ""}`}
            >
              <span>
                <Truck aria-hidden="true" />
              </span>

              <div>
                <strong>Deliver with us</strong>
                <small>
                  Earn by delivering with Safar
                </small>
              </div>

              {role === "driver" && (
                <CheckCircle2
                  className="lgl-role-check"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </fieldset>

        <div className="lgl-field">
          <label htmlFor="register-name">
            Full name
          </label>

          <div className="lgl-input">
            <UserRound aria-hidden="true" />

            <input
              id="register-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={50}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError("");
              }}
              placeholder="Your full name"
            />
          </div>
        </div>

        <div className="lgl-grid2">
          <div className="lgl-field">
            <label htmlFor="register-email">
              Email address
            </label>

            <div className="lgl-input">
              <Mail aria-hidden="true" />

              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError("");
                }}
                placeholder="your@email.com"
              />
            </div>
          </div>

          <div className="lgl-field">
            <label htmlFor="register-phone">
              Phone number
            </label>

            <div className="lgl-input">
              <Phone aria-hidden="true" />

              <input
                id="register-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (error) setError("");
                }}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
        </div>

        <div className="lgl-grid2">
          <div className="lgl-field">
            <label htmlFor="register-password">
              Password
            </label>

            <div className="lgl-input">
              <LockKeyhole aria-hidden="true" />

              <input
                id="register-password"
                name="password"
                type={
                  showPassword ? "text" : "password"
                }
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                }}
                placeholder="At least 8 characters"
              />

              <button
                type="button"
                className="lgl-eye"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="lgl-field">
            <label htmlFor="register-confirm-password">
              Confirm password
            </label>

            <div className="lgl-input">
              <LockKeyhole aria-hidden="true" />

              <input
                id="register-confirm-password"
                name="confirmPassword"
                type={
                  showConfirmPassword ? "text" : "password"
                }
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  if (error) setError("");
                }}
                placeholder="Repeat password"
              />

              <button
                type="button"
                className="lgl-eye"
                onClick={() =>
                  setShowConfirmPassword((current) => !current)
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="lgl-submit"
        >
          {isSubmitting ? (
            <>
              <span
                className="lgl-spinner"
                aria-hidden="true"
              />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <p className="lgl-switch">
        Already have an account?{" "}
        <Link to="/login">Sign in</Link>
      </p>

      {/* Small centered Back to Home link, below the account prompt. */}
      <div className="mt-4 flex justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition-colors hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          <ArrowLeft
            size={14}
            aria-hidden="true"
          />
          Back to Home
        </Link>
      </div>
    </AuthShell>
  );
};

export default Register;