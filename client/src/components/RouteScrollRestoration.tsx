import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * Saves scroll per route path and restores when navigating back within the session.
 */
export default function RouteScrollRestoration() {
  const [location] = useLocation();
  const prevPathRef = useRef(location);
  const skipNextRestoreRef = useRef(false);

  useEffect(() => {
    const prev = prevPathRef.current;
    if (prev !== location) {
      try {
        sessionStorage.setItem(`scroll_route_${prev}`, String(Math.round(window.scrollY)));
      } catch {
        // ignore
      }

      prevPathRef.current = location;

      if (skipNextRestoreRef.current) {
        skipNextRestoreRef.current = false;
        return;
      }

      let y = 0;
      try {
        const raw = sessionStorage.getItem(`scroll_route_${location}`);
        if (raw) y = parseInt(raw, 10);
      } catch {
        // ignore
      }

      if (!Number.isFinite(y) || y < 0) y = 0;

      const apply = () => window.scrollTo({ top: y, left: 0, behavior: "auto" });
      apply();
      requestAnimationFrame(apply);
      window.setTimeout(apply, 100);
    }
  }, [location]);

  return null;
}
