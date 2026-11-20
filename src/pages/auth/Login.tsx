
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
const ADMIN_LOGIN_EMAIL = (import.meta.env.VITE_ADMIN_LOGIN_EMAIL || "").trim().toLowerCase();

const Login = () => {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [roleTab, setRoleTab] = useState<"customer" | "driver">("customer");
  const [isAdminLogin, setIsAdminLogin] = useState(false);

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

      if (!isAdminLogin) {
        try {
          if (rememberMe) {
            window.localStorage.setItem(REMEMBER_KEY, email.trim());
          } else {
            window.localStorage.removeItem(REMEMBER_KEY);
          }
        } catch {
          // Remember Me remains optional.
        }
      }

      const role = response.user?.role;
      const expectedRole = isAdminLogin ? "admin" : roleTab;

      if (role && role !== expectedRole) {
        try {
          await logout();
        } catch {
          // Show the role mismatch message below.
        }

        setError(
          isAdminLogin
            ? "This account does not have administrator access. Sign in with the configured admin account."
            : `This is a ${role} account. Please select the "${role.charAt(0).toUpperCase()}${role.slice(1)}" option to sign in.`
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
  ] as const;

  function switchToAdminLogin() {
    setIsAdminLogin(true);
    setEmail(ADMIN_LOGIN_EMAIL);
    setPassword("");
    setRememberMe(false);
    setError("");
  }

  function switchToUserLogin() {
    setIsAdminLogin(false);
    setPassword("");
    setError("");
  }

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
            <LogiGoLogo to="/" tone="dark" size="lg" />

            <h1>Welcome Back</h1>

            <p className="lgl-sub">
              Sign in to continue to your account
            </p>

            {!isAdminLogin ? (
              <div
                className="lgl-tabs"
                style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
                role="tablist"
                aria-label="Account type"
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={roleTab === tab.id}
                    className={roleTab === tab.id ? "is-active" : ""}
                    onClick={() => {
                      setRoleTab(tab.id);
                      setError("");
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                <div>
                  <p className="text-sm font-extrabold text-slate-900">Administrator sign in</p>
                  <p className="mt-0.5 text-xs text-slate-600">Admin access is verified by the backend account role.</p>
                </div>
                <button type="button" onClick={switchToUserLogin} className="shrink-0 text-xs font-bold text-orange-700 underline underline-offset-2">Back</button>
              </div>
            )}

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
                  {isAdminLogin ? "Administrator email address" : "Email address"}
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
                    readOnly={isAdminLogin && Boolean(ADMIN_LOGIN_EMAIL)}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError("");
                    }}
                    placeholder={isAdminLogin ? "admin@yourdomain.com" : "your@email.com"}
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

              {!isAdminLogin && <label className="lgl-check">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(event.target.checked)
                  }
                />

                <span>Remember me</span>
              </label>}

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

            {!isAdminLogin && (
              <>
                <p className="lgl-switch">
                  Don&apos;t have an account?{" "}
                  <Link to="/register">Create one</Link>
                </p>

                {/* Admin login link - reduced font size */}
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={switchToAdminLogin}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                  >
                    Administrator?{" "}
                    <span className="text-xs font-extrabold text-orange-700">
                      Admin Login
                    </span>
                  </button>
                </div>
              </>
            )}

            {isAdminLogin && !ADMIN_LOGIN_EMAIL && (
              <p className="mt-3 text-center text-xs leading-5 text-amber-700">Set VITE_ADMIN_LOGIN_EMAIL in the frontend environment to prefill and lock the administrator email.</p>
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
