/**
 * Offline Detection Hook
 *
 * Automatically detects online/offline status and updates Jotai atoms.
 * Also detects if app is running as an installed PWA.
 */

"use client";

import { useEffect, useCallback } from "react";
import { useSetAtom } from "jotai";
import { isOnlineAtom, isPWAInstalledAtom } from "./offline-atoms";

/**
 * Hook to detect and manage offline state.
 * Should be used in the root layout to ensure it runs on all pages.
 */
export function useOfflineDetection() {
  const setIsOnline = useSetAtom(isOnlineAtom);
  const setIsPWAInstalled = useSetAtom(isPWAInstalledAtom);

  const updateOnlineStatus = useCallback(() => {
    setIsOnline(navigator.onLine);
  }, [setIsOnline]);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    // Detect if running as installed PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error - iOS Safari specific
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://");

    setIsPWAInstalled(isStandalone);

    // Listen for online/offline events
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    // Also listen for display mode changes (e.g., if app is installed mid-session)
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsPWAInstalled(e.matches);
    };
    displayModeQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      displayModeQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, [setIsOnline, setIsPWAInstalled, updateOnlineStatus]);
}

/**
 * Hook to get current online status without setting up listeners.
 * Useful for one-off checks in components that don't need reactivity.
 */
export function useIsOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
