"use client";

import { useState, useEffect, useCallback } from "react";

interface UseNetworkStatusResult {
  /**
   * Whether the browser reports being online.
   */
  isOnline: boolean;

  /**
   * Whether we just came back online (for triggering sync).
   * Resets to false after a short delay.
   */
  wasOffline: boolean;

  /**
   * Time when we went offline (null if online).
   */
  offlineSince: Date | null;

  /**
   * How long we were offline in milliseconds (0 if online or never offline).
   */
  offlineDuration: number;
}

/**
 * Hook for detecting online/offline status.
 *
 * Uses the Navigator.onLine API with event listeners for changes.
 *
 * @example
 * ```tsx
 * const { isOnline, wasOffline } = useNetworkStatus();
 *
 * useEffect(() => {
 *   if (wasOffline) {
 *     // Just came back online - sync data
 *     syncPendingActions();
 *   }
 * }, [wasOffline]);
 * ```
 */
export function useNetworkStatus(): UseNetworkStatusResult {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === "undefined") return true;
    return navigator.onLine;
  });

  const [wasOffline, setWasOffline] = useState(false);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [offlineDuration, setOfflineDuration] = useState(0);

  const handleOnline = useCallback(() => {
    // Calculate how long we were offline
    if (offlineSince) {
      setOfflineDuration(Date.now() - offlineSince.getTime());
    }

    setIsOnline(true);
    setOfflineSince(null);
    setWasOffline(true);

    // Reset wasOffline after a short delay
    // This gives other effects time to react to the state change
    setTimeout(() => {
      setWasOffline(false);
    }, 1000);

    console.log("[NetworkStatus] Back online");
  }, [offlineSince]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setOfflineSince(new Date());
    setOfflineDuration(0);
    console.log("[NetworkStatus] Went offline");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Set initial state
    if (!navigator.onLine) {
      setIsOnline(false);
      setOfflineSince(new Date());
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    isOnline,
    wasOffline,
    offlineSince,
    offlineDuration,
  };
}

export default useNetworkStatus;
