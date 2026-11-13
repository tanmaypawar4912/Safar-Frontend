import type { ReactNode } from "react";
import { Link } from "react-router";

import LogiGoLogo from "../brand/LogiGoLogo";

/** Dark header shared by the public pages (Business, public booking). `children` replaces the default buttons. */
export function PublicHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="lgx-header">
      <div className="lgx-header-inner">
        <LogiGoLogo to="/" size="md" />
        <nav className="lgx-nav" aria-label="Main navigation">
          <Link to="/">Home</Link>
          <a href="/#features">Features</a>
          <a href="/#services">Services</a>
          <Link to="/business">For Business</Link>
        </nav>
        <div className="lgx-actions">
          {children ?? (
            <>
              <Link to="/login" className="lgx-btn lgx-btn-outline">Sign In</Link>
              <Link to="/register" className="lgx-btn lgx-btn-primary">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ note }: { note?: string }) {
  return (
    <footer className="lgx-footer">
      <div className="lgx-footer-inner">
        <LogiGoLogo to="/" size="sm" />
        <span>© {new Date().getFullYear()} LogiGo. {note ?? "Moving your world, one delivery at a time."}</span>
        <Link to="/">Back to LogiGo</Link>
      </div>
    </footer>
  );
}
