import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";

import LogiGoLogo from "../../components/brand/LogiGoLogo";
import { useAuth } from "../../context/AuthContext";

type LoginError = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
};

function getLoginErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as LoginError;
    const responseMessage = candidate.response?.data?.message;

    if (responseMessage) return responseMessage;
    if (candidate.message) return candidate.message;
  }

  return "Unable to sign in right now. Please check your details and try again.";
}

const REMEMBER_KEY = "logigo:remember-email";

const Login = () => {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [roleTab, setRoleTab] = useState<
    "customer" | "driver" | "admin"
  >("customer");

  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);

      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      // Browser storage may be unavailable.
    }
  }, []);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await login({
        email: email.trim(),
        password,
      });

      if (!response.success) {
        setError(
          response.message || "Unable to sign in. Please try again."
        );
        return;
      }

      try {
        if (rememberMe) {
          window.localStorage.setItem(
            REMEMBER_KEY,
            email.trim()
          );
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        // Remember Me remains optional.
      }

      const role = response.user?.role;

      if (role && role !== roleTab) {
        try {
          await logout();
        } catch {
          // Show the role mismatch message below.
        }

        setError(
          `This is a ${role} account. Please select the "${role.charAt(0).toUpperCase()}${role.slice(1)}" tab to sign in.`
        );

        return;
      }

      if (role === "admin") {
        navigate("/admin", { replace: true });
      } else if (role === "driver") {
        navigate("/driver", { replace: true });
      } else {
        navigate("/customer", { replace: true });
      }
    } catch (submitError: unknown) {
      setError(getLoginErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: "customer", label: "Customer" },
    { id: "driver", label: "Driver" },
    { id: "admin", label: "Admin" },
  ] as const;

  return (
    <main className="lgl">
      <div className="lgl-grid">
        <section className="lgl-form-side">
          <div
            className="lgl-mobile-hero"
            aria-hidden="true"
          />

          <div className="lgl-form-wrap">
            {/* Logo stays at the top. No back button here. */}
            <LogiGoLogo to="/" tone="light" size="lg" />

            <h1>Welcome Back</h1>

            <p className="lgl-sub">
              Sign in to continue to your account
            </p>

            <div
              className="lgl-tabs"
              role="tablist"
              aria-label="Account type"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={roleTab === tab.id}
                  className={
                    roleTab === tab.id ? "is-active" : ""
                  }
                  onClick={() => setRoleTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

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
              <div className="lgl-field">
                <label htmlFor="email">
                  Email address
                </label>

                <div className="lgl-input">
                  <Mail aria-hidden="true" />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError("");
                    }}
                    placeholder="your@email.com"
                    aria-invalid={Boolean(error)}
                  />
                </div>
              </div>

              <div className="lgl-field">
                <div className="lgl-label-row">
                  <label htmlFor="password">
                    Password
                  </label>

                  <Link to="/forgot-password">
                    Forgot password?
                  </Link>
                </div>

                <div className="lgl-input">
                  <LockKeyhole aria-hidden="true" />

                  <input
                    id="password"
                    name="password"
                    type={
                      showPassword ? "text" : "password"
                    }
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (error) setError("");
                    }}
                    placeholder="Enter your password"
                    aria-invalid={Boolean(error)}
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

              <label className="lgl-check">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(event.target.checked)
                  }
                />

                <span>Remember me</span>
              </label>

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
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {roleTab !== "admin" && (
              <p className="lgl-switch">
                Don&apos;t have an account?{" "}
                <Link to="/register">Create one</Link>
              </p>
            )}

            {/* Small, centered text link below the account prompt. */}
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
          </div>
        </section>

        <aside
          className="lgl-art"
          aria-hidden="true"
        >
          <div className="lgl-art-copy">
            <h2>
              Reliable
              <br />
              Logistics
              <br />
              for a Better
              <br />
              Tomorrow
            </h2>

            <p>Smart. Safe. Sustainable.</p>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default Login;