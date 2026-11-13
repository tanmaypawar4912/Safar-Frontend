import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Building2,
  Clock3,
  Headphones,
  Heart,
  MapPin,
  Menu,
  Package,
  ShieldCheck,
  Tag,
  Truck,
  Users,
  X,
  Container,
  Radar,
  CheckCircle2,
} from "lucide-react";

import LogiGoLogo from "../../components/brand/LogiGoLogo";
import "./Home.css";

const navLinks = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "Services", href: "#services" },
  { label: "For Business", to: "/business" },
  { label: "About", href: "#about" },
];

const stats = [
  { value: "10K+", label: "Deliveries Completed", icon: Package },
  { value: "2K+", label: "Verified Drivers", icon: Users },
  { value: "50+", label: "Cities Covered", icon: MapPin },
  { value: "99%", label: "Customer Satisfaction", icon: Heart },
];

const services = [
  {
    title: "Local Delivery",
    text: "Quick delivery within city",
    icon: Package,
  },
  {
    title: "Intercity Transport",
    text: "Safe & reliable transport",
    icon: Truck,
  },
  {
    title: "Business Logistics",
    text: "For growing businesses",
    icon: Building2,
  },
  {
    title: "Heavy & Bulk Cargo",
    text: "Trucks for large goods",
    icon: Container,
  },
];

const features = [
  {
    title: "Real-Time Tracking",
    text: "Track your shipment live",
    icon: Radar,
  },
  {
    title: "Verified Drivers",
    text: "Trusted & professional",
    icon: ShieldCheck,
  },
  {
    title: "Transparent Pricing",
    text: "No hidden charges",
    icon: Tag,
  },
  {
    title: "24/7 Support",
    text: "We are always here",
    icon: Headphones,
  },
];

function StoreBadge({
  store,
}: {
  store: "google" | "apple";
}) {
  const isGoogle = store === "google";

  return (
    <a
      href="#app"
      className="lgh-store"
      aria-label={
        isGoogle
          ? "Get LogiGo on Google Play"
          : "Download LogiGo on the App Store"
      }
      onClick={(event) => event.preventDefault()}
      title="Mobile app coming soon"
    >
      {isGoogle ? (
        <svg
          width="22"
          height="24"
          viewBox="0 0 22 24"
          aria-hidden="true"
        >
          <path
            d="M1 1.3c-.3.3-.5.8-.5 1.4v18.6c0 .6.2 1.1.5 1.4l.1.1L11.5 12.4v-.2L1.1 1.2 1 1.3z"
            fill="#00d7fe"
          />
          <path
            d="M15 15.9l-3.5-3.5v-.2L15 8.7l.1.1 4.1 2.3c1.2.7 1.2 1.7 0 2.4l-4.1 2.3-.1.1z"
            fill="#ffce00"
          />
          <path
            d="M15.1 15.8L11.5 12.3 1 22.7c.4.4 1 .4 1.7.1l12.4-7z"
            fill="#ff3a44"
          />
          <path
            d="M15.1 8.8L2.7 1.8C2 1.5 1.4 1.5 1 1.9l10.5 10.4 3.6-3.5z"
            fill="#00f076"
          />
        </svg>
      ) : (
        <svg
          width="22"
          height="24"
          viewBox="0 0 384 512"
          aria-hidden="true"
          fill="#fff"
        >
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
      )}

      <span>
        <small>
          {isGoogle ? "Get it on" : "Download on the"}
        </small>
        <strong>
          {isGoogle ? "Google Play" : "App Store"}
        </strong>
      </span>
    </a>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    onScroll();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="lgh" id="top">
      <a className="lgh-skip" href="#main-content">
        Skip to main content
      </a>

      {/* Header */}
      <header
        className={`lgh-header${scrolled ? " is-scrolled" : ""}`}
      >
        <div className="lgh-header-inner">
          <LogiGoLogo
            to="/"
            size="md"
            onClick={closeMenu}
          />

          <nav
            id="lgh-nav"
            className={`lgh-nav${menuOpen ? " is-open" : ""}`}
            aria-label="Main navigation"
          >
            {navLinks.map((link, index) =>
              "to" in link && link.to ? (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={"href" in link ? link.href : "#top"}
                  onClick={closeMenu}
                  className={
                    index === 0 ? "is-active" : undefined
                  }
                >
                  {link.label}
                </a>
              )
            )}

            <div className="lgh-nav-actions-mobile">
              <Link
                to="/login"
                className="lgh-btn lgh-btn-outline"
                onClick={closeMenu}
              >
                Sign In
              </Link>

              <Link
                to="/register"
                className="lgh-btn lgh-btn-primary"
                onClick={closeMenu}
              >
                Get Started
              </Link>
            </div>
          </nav>

          <div className="lgh-header-actions">
            <Link
              to="/login"
              className="lgh-btn lgh-btn-outline lgh-btn-sm"
            >
              Sign In
            </Link>

            <Link
              to="/register"
              className="lgh-btn lgh-btn-primary lgh-btn-sm"
            >
              Get Started
            </Link>
          </div>

          <button
            type="button"
            className="lgh-burger"
            aria-label={
              menuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="lgh-nav"
            onClick={() =>
              setMenuOpen((open) => !open)
            }
          >
            {menuOpen ? (
              <X size={22} />
            ) : (
              <Menu size={22} />
            )}
          </button>
        </div>
      </header>

      <main id="main-content">
        {/* Hero with the new generated background image */}
        <section className="lgh-hero">
          <img
            className="lgh-hero-bg"
            src="/images/logigo-home-hero.png"
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
          />

          <div
            className="lgh-hero-shade"
            aria-hidden="true"
          />

          <div className="lgh-wrap lgh-hero-grid">
            <div className="lgh-hero-copy">
              <span className="lgh-badge">
                Trusted Logistics Partner
              </span>

              <h1>
                Move
                <br />
                Anything
                <br />
                <span>Anywhere</span>
              </h1>

              <p>
                Fast. Reliable. Affordable Logistics
                <br className="lgh-hide-sm" /> for Individuals,
                Businesses and Enterprises.
              </p>

              <div className="lgh-hero-actions">
                <Link
                  to="/customer/book"
                  className="lgh-btn lgh-btn-primary lgh-btn-lg"
                >
                  Book a Delivery
                </Link>

                <a
                  href="#features"
                  className="lgh-btn lgh-btn-outline lgh-btn-lg"
                >
                  Learn More
                </a>
              </div>
            </div>

            {/* Existing pickup and drop route illustration */}
            <div
              className="lgh-route"
              aria-label="Example delivery route from Pune to Mumbai"
            >
              <svg
                className="lgh-route-line"
                viewBox="0 0 320 250"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M70 34 C 150 40, 120 96, 190 112 S 260 150, 236 196" />
              </svg>

              <div className="lgh-pin lgh-pin-a">
                <MapPin size={16} />
                <span>
                  <small>Pickup</small>
                  <strong>Pune, MH</strong>
                </span>
              </div>

              <div className="lgh-pin lgh-pin-b">
                <MapPin size={16} />
                <span>
                  <small>Drop</small>
                  <strong>Mumbai, MH</strong>
                </span>
              </div>
            </div>

            <div className="lgh-eta">
              <Clock3 size={15} aria-hidden="true" />
              <span>
                <small>Est. Delivery</small>
                <strong>2-3 Hours</strong>
              </span>
            </div>
          </div>

          <div className="lgh-wrap">
            <ul className="lgh-stats">
              {stats.map(({ value, label, icon: Icon }) => (
                <li key={label}>
                  <span className="lgh-stat-icon">
                    <Icon size={18} />
                  </span>

                  <span>
                    <strong>{value}</strong>
                    <small>{label}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Services, features and mobile-app showcase */}
        <section className="lgh-showcase">
          <div className="lgh-wrap lgh-showcase-grid">
            <div className="lgh-showcase-main">
              <section
                className="lgh-services"
                id="services"
                aria-labelledby="lgh-services-title"
              >
                <h2 id="lgh-services-title">
                  Our Services
                </h2>

                <p>Logistics solutions for every need</p>

                <div className="lgh-service-grid">
                  {services.map(
                    ({ title, text, icon: Icon }) => (
                      <Link
                        to="/customer/book"
                        className="lgh-service"
                        key={title}
                      >
                        <span className="lgh-service-icon">
                          <Icon
                            size={26}
                            strokeWidth={1.8}
                          />
                        </span>

                        <span>
                          <strong>{title}</strong>
                          <small>{text}</small>
                        </span>
                      </Link>
                    )
                  )}
                </div>
              </section>

              <section
                className="lgh-why"
                id="features"
                aria-labelledby="lgh-why-title"
              >
                <h2 id="lgh-why-title">
                  Why Choose LogiGo?
                </h2>

                <ul className="lgh-why-grid">
                  {features.map(
                    ({ title, text, icon: Icon }) => (
                      <li key={title}>
                        <span className="lgh-why-icon">
                          <Icon
                            size={22}
                            strokeWidth={1.8}
                          />
                        </span>

                        <strong>{title}</strong>
                        <small>{text}</small>
                      </li>
                    )
                  )}
                </ul>
              </section>
            </div>

            <aside
              className="lgh-app"
              id="app"
              aria-labelledby="lgh-app-title"
            >
              <div className="lgh-app-copy">
                <LogiGoLogo to={null} size="md" />

                <h2 id="lgh-app-title">
                  Logistics
                  <br />
                  in Your Hands
                </h2>

                <p>
                  Book, track and manage your deliveries
                  anytime, anywhere.
                </p>

                <div className="lgh-stores">
                  <StoreBadge store="google" />
                  <StoreBadge store="apple" />
                </div>
              </div>

              {/* Existing phone mockup */}
              <div
                className="lgh-phone"
                aria-hidden="true"
              >
                <div className="lgh-phone-screen">
                  <div className="lgh-phone-map">
                    <svg
                      viewBox="0 0 200 180"
                      preserveAspectRatio="none"
                    >
                      <path
                        className="lgh-pm-road"
                        d="M-10 150 L70 105 L110 120 L210 50"
                      />
                      <path
                        className="lgh-pm-road"
                        d="M30 -10 L60 70 L45 190"
                      />
                      <path
                        className="lgh-pm-road"
                        d="M130 -10 L120 80 L170 190"
                      />
                      <path
                        className="lgh-pm-route"
                        d="M62 40 C 90 60, 80 90, 110 105 S 150 120, 150 140"
                      />
                    </svg>

                    <span className="lgh-pm-pin lgh-pm-pin-a">
                      <b>Pickup</b>
                      Pune, MH
                    </span>

                    <span className="lgh-pm-pin lgh-pm-pin-b">
                      <b>Drop</b>
                      Mumbai, MH
                    </span>
                  </div>

                  <div className="lgh-phone-status">
                    <span className="lgh-phone-shield">
                      <ShieldCheck size={14} />
                    </span>

                    <span>
                      <strong>On The Way</strong>
                      <small>Arriving in 45 mins</small>
                    </span>
                  </div>

                  <div className="lgh-phone-cta">
                    Track Live
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="lgh-footer" id="about">
        <div className="lgh-wrap">
          <div className="lgh-footer-top">
            <div className="lgh-footer-brand">
              <LogiGoLogo to="/" size="md" />

              <p>
                LogiGo connects people and businesses with
                verified drivers for fast, transparent and
                reliable deliveries across the city and beyond.
              </p>
            </div>

            <nav
              className="lgh-footer-links"
              aria-label="Footer navigation"
            >
              <a href="#services">Services</a>
              <a href="#features">Features</a>
              <Link to="/business">For Business</Link>
              <Link to="/login">Sign In</Link>
              <Link to="/register">Create Account</Link>
            </nav>

            <Link
              to="/customer/book"
              className="lgh-btn lgh-btn-primary"
            >
              Book a Delivery <ArrowRight size={16} />
            </Link>
          </div>

          <div className="lgh-footer-bottom">
            <span>
              © {new Date().getFullYear()} LogiGo. All rights
              reserved.
            </span>

            <span className="lgh-footer-note">
              <CheckCircle2 size={14} />
              Moving your world, one delivery at a time.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}