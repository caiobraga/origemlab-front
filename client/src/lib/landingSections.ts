import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

export type LandingSection = "como-funciona" | "planos" | "faq";

/**
 * Href for a landing section that works from any page: a plain hash where the
 * sections are rendered, otherwise /inicio (always the landing, even when logged in).
 */
export function useLandingSectionHref(): (section: LandingSection) => string {
  const [location] = useLocation();
  const { user } = useAuth();
  // "/" and "/planos" only show the landing to visitors; logged-in users get the dashboard / billing.
  const onLanding = location === "/inicio" || (!user && (location === "/" || location === "/planos"));
  return (section) => (onLanding ? `#${section}` : `/inicio#${section}`);
}

/**
 * Scrolls to the section in the URL hash once the landing has rendered. Sections load
 * data and grow after the first paint, so it lands again once they settle, unless the
 * visitor has started scrolling.
 */
export function useScrollToHashOnLoad(enabled: boolean, fallbackId?: string) {
  useEffect(() => {
    if (!enabled) return;
    const id = window.location.hash.replace(/^#/, "") || fallbackId;
    if (!id) return;
    const scrollToSection = (behavior: ScrollBehavior) =>
      document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });

    let settle = 0;
    const cancel = () => window.clearTimeout(settle);
    const frame = requestAnimationFrame(() => scrollToSection("smooth"));
    settle = window.setTimeout(() => {
      scrollToSection("auto");
      removeListeners();
    }, 900);
    const userEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    const removeListeners = () => userEvents.forEach((e) => window.removeEventListener(e, cancel));
    userEvents.forEach((e) => window.addEventListener(e, cancel, { once: true, passive: true }));

    return () => {
      cancelAnimationFrame(frame);
      cancel();
      removeListeners();
    };
  }, [enabled, fallbackId]);
}
