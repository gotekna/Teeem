"use client";

/**
 * useMediaQuery Hook
 *
 * Low-level hook for tracking CSS media query matches.
 * SSR-safe with hydration handling.
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
 */

import { useState, useEffect, useCallback } from "react";

/**
 * Hook to track a CSS media query.
 *
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @param defaultValue - Value to use during SSR and initial render (default: false)
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string, defaultValue: boolean = false): boolean {
  // Use defaultValue for SSR and initial render to avoid hydration mismatch
  const [matches, setMatches] = useState(defaultValue);

  const handleChange = useCallback((event: MediaQueryListEvent) => {
    setMatches(event.matches);
  }, []);

  useEffect(() => {
    // Skip if we're on the server
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);

    // Set the initial value (after mount to avoid hydration issues)
    setMatches(mediaQuery.matches);

    // Modern browsers
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query, handleChange]);

  return matches;
}

/**
 * Predefined breakpoint queries matching Tailwind defaults.
 * Use these with useMediaQuery for consistent breakpoint detection.
 */
export const BREAKPOINT_QUERIES = {
  /** Matches sm: breakpoint (640px+) */
  sm: "(min-width: 640px)",
  /** Matches md: breakpoint (768px+) */
  md: "(min-width: 768px)",
  /** Matches lg: breakpoint (1024px+) */
  lg: "(min-width: 1024px)",
  /** Matches xl: breakpoint (1280px+) */
  xl: "(min-width: 1280px)",
  /** Matches 2xl: breakpoint (1536px+) */
  "2xl": "(min-width: 1536px)",
  /** Mobile only (below md) */
  mobile: "(max-width: 767px)",
  /** Tablet only (md to lg) */
  tablet: "(min-width: 768px) and (max-width: 1023px)",
  /** Touch device detection */
  touch: "(hover: none) and (pointer: coarse)",
  /** Reduced motion preference */
  reducedMotion: "(prefers-reduced-motion: reduce)",
  /** Dark mode preference */
  darkMode: "(prefers-color-scheme: dark)",
  /** Portrait orientation */
  portrait: "(orientation: portrait)",
  /** Landscape orientation */
  landscape: "(orientation: landscape)",
  /** PWA standalone mode */
  standalone: "(display-mode: standalone)",
} as const;

/**
 * Hook for common breakpoint checks.
 * Returns an object with boolean flags for each breakpoint.
 *
 * @example
 * const { isMobile, isTablet, isDesktop } = useBreakpoints();
 */
export function useBreakpoints() {
  const isMobile = useMediaQuery(BREAKPOINT_QUERIES.mobile, false);
  const isTablet = useMediaQuery(BREAKPOINT_QUERIES.tablet, false);
  const isLg = useMediaQuery(BREAKPOINT_QUERIES.lg, true);

  return {
    isMobile,
    isTablet,
    isDesktop: isLg,
    // More granular if needed
    isSm: useMediaQuery(BREAKPOINT_QUERIES.sm, true),
    isMd: useMediaQuery(BREAKPOINT_QUERIES.md, true),
    isLg,
    isXl: useMediaQuery(BREAKPOINT_QUERIES.xl, false),
    is2Xl: useMediaQuery(BREAKPOINT_QUERIES["2xl"], false),
  };
}
