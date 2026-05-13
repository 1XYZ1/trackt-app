"use client";

import { useCallback, useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  const subscribe = useCallback((callback: () => void) => {
    if (typeof window === "undefined") return () => {};

    const mql = window.matchMedia(MOBILE_QUERY);
    mql.addEventListener("change", callback);

    return () => mql.removeEventListener("change", callback);
  }, []);

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
