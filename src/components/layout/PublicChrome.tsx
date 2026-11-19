import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Menu, X } from "lucide-react";
import LogiGoLogo from "../brand/LogiGoLogo";

export const policyLinks = [
  { to: "/disclaimer", label: "Disclaimer" },
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/terms-and-conditions", label: "Terms & Conditions" },
];

export function PublicHeader({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="lgx-header safar-header">
      <div className="lgx-header-inner">
        <LogiGoLogo to="/" tone="dark" size="md" onClick={() => setOpen(false)} />
        <button
          ref={button}
          type="button"
          className="safar-menu-toggle"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
        <div className="safar-menu" id={menuId} data-open={open}>
          <nav aria-label="Main navigation" onClick={() => setOpen(false)}>
            <Link to="/" aria-current={pathname === "/" ? "page" : undefined}>Home</Link>
            <a href="/#services">Services</a>
            <a href="/#features">Features</a>
            <a href="/#how-it-works">How it works</a>
            <Link to="/business" aria-current={pathname === "/business" ? "page" : undefined}>For Business</Link>
            <Link to="/book" aria-current={pathname === "/book" ? "page" : undefined}>Get estimate</Link>
          </nav>
          <div className="lgx-actions" onClick={() => setOpen(false)}>
            {children ?? (
              <>
                <Link to="/login" className="lgx-btn lgx-btn-outline">Sign in</Link>
                <Link to="/register" className="lgx-btn lgx-btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ note }: { note?: string }) {
  return (
    <footer className="lgx-footer safar-footer" id="about">
      <div className="lgx-footer-inner">
        <LogiGoLogo to="/" tone="dark" size="sm" />
        <nav aria-label="Footer navigation">
          <a href="/#services">Services</a>
          <Link to="/business">For Business</Link>
          <Link to="/customer/complaints">Booking support</Link>
        </nav>
        <nav aria-label="Legal">
          {policyLinks.map(({ to, label }) => <Link key={to} to={to}>{label}</Link>)}
        </nav>
        <span>© {new Date().getFullYear()} Safar{note && ` · ${note}`}</span>
      </div>
    </footer>
  );
}
