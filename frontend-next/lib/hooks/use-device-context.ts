"use client";

/**
 * useDeviceContext Hook
 *
 * SSoT for device and viewport detection across the app.
 * Provides comprehensive device info: breakpoints, touch, orientation, PWA mode.
 *
 * @example
 * const { isMobile, isTouch, orientation } = useDeviceContext();
 * if (isMobile) return <MobileLayout />;
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMediaQuery, BREAKPOINT_QUERIES } from "./use-media-query";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DeviceContext {
  /** Screen width < 768px (phone) */
  isMobile: boolean;
  /** Screen width 768-1023px (tablet) */
  isTablet: boolean;
  /** Screen width >= 1024px (desktop/laptop) */
  isDesktop: boolean;
  /** Device has touch capability (not just screen size) */
  isTouch: boolean;
  /** Running as installed PWA (standalone mode) */
  isPWA: boolean;
  /** Current orientation */
  orientation: "portrait" | "landscape";
  /** Current viewport width in pixels */
  viewportWidth: number;
  /** Current viewport height in pixels */
  viewportHeight: number;
  /** User prefers reduced motion */
  prefersReducedMotion: boolean;
}

// Default values for SSR (assume desktop)
const DEFAULT_CONTEXT: DeviceContext = {
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouch: false,
  isPWA: false,
  orientation: "landscape",
  viewportWidth: 1024,
  viewportHeight: 768,
  prefersReducedMotion: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// Debounce utility
// ═══════════════════════════════════════════════════════════════════════════

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T;
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook providing comprehensive device context.
 *
 * Uses a combination of:
 * - Media queries (for responsive breakpoints)
 * - Window dimensions (for exact viewport size)
 * - Feature detection (for touch, PWA)
 *
 * @returns DeviceContext object with device info
 */
export function useDeviceContext(): DeviceContext {
  // Use media queries for breakpoints (handles SSR correctly)
  const isMobile = useMediaQuery(BREAKPOINT_QUERIES.mobile, false);
  const isTablet = useMediaQuery(BREAKPOINT_QUERIES.tablet, false);
  const isDesktop = useMediaQuery(BREAKPOINT_QUERIES.lg, true);
  const isTouch = useMediaQuery(BREAKPOINT_QUERIES.touch, false);
  const isPWA = useMediaQuery(BREAKPOINT_QUERIES.standalone, false);
  const isPortrait = useMediaQuery(BREAKPOINT_QUERIES.portrait, false);
  const prefersReducedMotion = useMediaQuery(BREAKPOINT_QUERIES.reducedMotion, false);

  // Track viewport dimensions (requires client-side JS)
  const [viewport, setViewport] = useState({
    width: DEFAULT_CONTEXT.viewportWidth,
    height: DEFAULT_CONTEXT.viewportHeight,
  });

  // Update viewport dimensions on resize
  const updateViewport = useCallback(() => {
    if (typeof window !== "undefined") {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
  }, []);

  useEffect(() => {
    // Set initial viewport on mount
    updateViewport();

    // Debounced resize handler (100ms)
    const debouncedUpdate = debounce(updateViewport, 100);
    window.addEventListener("resize", debouncedUpdate);

    return () => {
      window.removeEventListener("resize", debouncedUpdate);
    };
  }, [updateViewport]);

  // Memoize the context object to prevent unnecessary re-renders
  const context = useMemo<DeviceContext>(
    () => ({
      isMobile,
      isTablet,
      isDesktop,
      isTouch,
      isPWA,
      orientation: isPortrait ? "portrait" : "landscape",
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      prefersReducedMotion,
    }),
    [isMobile, isTablet, isDesktop, isTouch, isPWA, isPortrait, viewport, prefersReducedMotion]
  );

  return context;
}

// ═══════════════════════════════════════════════════════════════════════════
// Convenience hooks
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simple hook to check if we're on mobile.
 * Lighter weight than full useDeviceContext if you only need this check.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(BREAKPOINT_QUERIES.mobile, false);
}

/**
 * Simple hook to check if device has touch capability.
 */
export function useIsTouch(): boolean {
  return useMediaQuery(BREAKPOINT_QUERIES.touch, false);
}

/**
 * Simple hook to check if running as PWA.
 */
export function useIsPWA(): boolean {
  return useMediaQuery(BREAKPOINT_QUERIES.standalone, false);
}

/**
 * Hook to get current orientation.
 */
export function useOrientation(): "portrait" | "landscape" {
  const isPortrait = useMediaQuery(BREAKPOINT_QUERIES.portrait, false);
  return isPortrait ? "portrait" : "landscape";
}
