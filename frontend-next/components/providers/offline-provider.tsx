"use client";

import { useOfflineDetection } from "@/lib/offline";
import { OfflineBanner } from "@/components/ui/offline-banner";

interface OfflineProviderProps {
  children: React.ReactNode;
}

/**
 * Offline Provider
 *
 * Handles offline detection and provides the offline banner.
 * Must be rendered inside JotaiProvider.
 */
export function OfflineProvider({ children }: OfflineProviderProps) {
  // Set up offline detection listeners
  useOfflineDetection();

  return (
    <>
      {children}
      <OfflineBanner />
    </>
  );
}
