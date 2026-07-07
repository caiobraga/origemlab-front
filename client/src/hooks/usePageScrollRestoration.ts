import { useCallback, useEffect, useRef } from "react";

type Options = {
  /** When false, listeners are not attached. */
  enabled?: boolean;
  /** Restore scroll after content is ready (call from page when data loaded). */
  ready?: boolean;
};

/**
 * Persists window scroll in sessionStorage and restores on browser tab return / remount.
 * Ignores scroll events while the document is hidden (avoids saving 0 on tab switch).
 */
export function usePageScrollRestoration(storageKey: string, options: Options = {}) {
  const { enabled = true, ready = true } = options;
  const latestYRef = useRef(0);
  const isRestoringRef = useRef(false);
  const didInitialRestoreRef = useRef(false);

  useEffect(() => {
    didInitialRestoreRef.current = false;
  }, [storageKey]);

  const persist = useCallback(
    (y?: number) => {
      if (!enabled || isRestoringRef.current) return;
      const value = typeof y === "number" ? y : latestYRef.current;
      if (value < 0) return;
      try {
        sessionStorage.setItem(storageKey, String(Math.round(value)));
      } catch {
        // ignore
      }
    },
    [enabled, storageKey],
  );

  const restore = useCallback(() => {
    if (!enabled) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const y = parseInt(raw, 10);
      if (!Number.isFinite(y) || y < 0) return;

      isRestoringRef.current = true;
      const apply = () => window.scrollTo({ top: y, left: 0, behavior: "auto" });
      apply();
      requestAnimationFrame(apply);
      requestAnimationFrame(() => requestAnimationFrame(apply));
      window.setTimeout(apply, 80);
      window.setTimeout(apply, 200);
      window.setTimeout(() => {
        window.scrollTo(0, y);
        isRestoringRef.current = false;
        latestYRef.current = window.scrollY;
      }, 450);
    } catch {
      isRestoringRef.current = false;
    }
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled) return;

    const onScroll = () => {
      if (isRestoringRef.current || document.hidden) return;
      latestYRef.current = window.scrollY;
      persist();
    };

    const onHide = () => {
      persist(latestYRef.current);
    };

    const onShow = () => {
      if (latestYRef.current <= 0 && !sessionStorage.getItem(storageKey)) return;
      restore();
      window.setTimeout(restore, 150);
    };

    const onVisibility = () => {
      if (document.hidden) onHide();
      else onShow();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);
    window.addEventListener("blur", onHide);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("focus", onShow);
      window.removeEventListener("blur", onHide);
    };
  }, [enabled, persist, restore]);

  useEffect(() => {
    if (!enabled || !ready || didInitialRestoreRef.current) return;
    didInitialRestoreRef.current = true;
    restore();
    window.setTimeout(restore, 150);
  }, [enabled, ready, restore]);

  return {
    persistScroll: persist,
    restoreScroll: restore,
    latestYRef,
    isRestoringRef,
  };
}

/**
 * Remembers scroll position per tab id (e.g. admin sections).
 * Use `selectTab` instead of setState so scroll is saved before the tab unmounts.
 */
export function useTabScrollRestoration<T extends string>(
  activeTab: T,
  setActiveTab: (tab: T) => void,
) {
  const positionsRef = useRef<Partial<Record<T, number>>>({});
  const isRestoringRef = useRef(false);

  const selectTab = useCallback(
    (next: T) => {
      if (next === activeTab) return;
      if (!document.hidden && !isRestoringRef.current) {
        positionsRef.current[activeTab] = window.scrollY;
      }
      setActiveTab(next);
    },
    [activeTab, setActiveTab],
  );

  useEffect(() => {
    const saved = positionsRef.current[activeTab] ?? 0;
    isRestoringRef.current = true;
    const apply = () => window.scrollTo({ top: saved, left: 0, behavior: "auto" });
    apply();
    requestAnimationFrame(apply);
    window.setTimeout(() => {
      apply();
      isRestoringRef.current = false;
    }, 80);
  }, [activeTab]);

  useEffect(() => {
    const onScroll = () => {
      if (isRestoringRef.current || document.hidden) return;
      positionsRef.current[activeTab] = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [activeTab]);

  return { selectTab };
}
