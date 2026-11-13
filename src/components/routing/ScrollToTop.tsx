import { useEffect } from "react";
import { useLocation } from "react-router";

/** Reset the document scroll position whenever the active route changes. */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}
