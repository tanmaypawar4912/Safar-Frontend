import type { ReactNode } from "react";

import LogiGoLogo from "../brand/LogiGoLogo";

/** Split auth layout used by Register / Forgot / Reset password (same look as Login). */
export default function AuthShell({
  children,
  title,
  tagline,
  wide = false,
}: {
  children: ReactNode;
  title: ReactNode;
  tagline: string;
  wide?: boolean;
}) {
  return (
    <main className="lgl">
      <div className="lgl-grid">
        <section className="lgl-form-side">
          <div className="lgl-mobile-hero" aria-hidden="true" />
          <div className={`lgl-form-wrap${wide ? " is-wide" : ""}`}>
            <LogiGoLogo to="/" tone="dark" size="lg" />
            {children}
          </div>
        </section>
        <aside className="lgl-art" aria-hidden="true">
          <div className="lgl-art-copy">
            <h2>{title}</h2>
            <p>{tagline}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
