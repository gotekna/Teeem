"use client";

/**
 * Breadcrumb Navigation Context
 *
 * Tracks navigation path through the app, building a breadcrumb trail.
 * Listens to pathname changes and sidebar navigation events.
 *
 * Features:
 * - Auto-tracks navigation via usePathname()
 * - Resets trail on sidebar navigation (custom event)
 * - Handles browser back (truncates trail)
 * - Pages can provide custom display names
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAtom, useSetAtom } from "jotai";
import {
  breadcrumbTrailAtom,
  breadcrumbVisibleAtom,
  generateBreadcrumbId,
  MAX_TRAIL_LENGTH,
  type BreadcrumbItem,
} from "@/lib/breadcrumb-atoms";
import { resolveDisplayName, resolveIcon, isSameRoute } from "@/lib/breadcrumb-utils";

interface BreadcrumbContextType {
  /** Set a custom display name for the current page */
  setDisplayName: (displayName: string) => void;
  /** Reset the trail (start fresh) */
  resetTrail: () => void;
  /** Current trail items */
  trail: BreadcrumbItem[];
}

const BreadcrumbContext = createContext<BreadcrumbContextType | null>(null);

/**
 * Custom event name for sidebar navigation
 * Sidebar dispatches this to signal a new navigation flow
 */
export const SIDEBAR_NAVIGATION_EVENT = "sidebar-navigation";

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [trail, setTrail] = useAtom(breadcrumbTrailAtom);
  const setVisible = useSetAtom(breadcrumbVisibleAtom);

  // Track previous pathname to detect changes
  const previousPathRef = useRef<string | null>(null);
  // Track if current update is from sidebar (should reset)
  const isResettingRef = useRef<boolean>(false);

  /**
   * Reset the trail - called on sidebar navigation
   */
  const resetTrail = useCallback(() => {
    isResettingRef.current = true;
    setTrail([]);
  }, [setTrail]);

  /**
   * Set custom display name for current page
   * Updates the last item in the trail
   */
  const setDisplayName = useCallback(
    (displayName: string) => {
      setTrail((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          displayName,
        };
        return updated;
      });
    },
    [setTrail]
  );

  /**
   * Listen for sidebar navigation events
   * Resets the trail when user clicks sidebar
   */
  useEffect(() => {
    const handleSidebarNav = () => {
      resetTrail();
    };

    window.addEventListener(SIDEBAR_NAVIGATION_EVENT, handleSidebarNav);
    return () => window.removeEventListener(SIDEBAR_NAVIGATION_EVENT, handleSidebarNav);
  }, [resetTrail]);

  /**
   * Track navigation changes
   * Adds new items to trail or truncates on back navigation
   */
  useEffect(() => {
    const fullPath = pathname + (searchParams?.toString() ? `?${searchParams}` : "");

    // Skip if same as previous (prevents double-adds on mount)
    if (fullPath === previousPathRef.current) return;
    previousPathRef.current = fullPath;

    // If resetting, add this as the first item of new trail
    if (isResettingRef.current) {
      isResettingRef.current = false;
      const newItem: BreadcrumbItem = {
        id: generateBreadcrumbId(pathname),
        pathname,
        searchParams: searchParams?.toString(),
        displayName: resolveDisplayName(pathname, searchParams),
        icon: resolveIcon(pathname),
        timestamp: Date.now(),
      };
      setTrail([newItem]);
      return;
    }

    setTrail((prev) => {
      // Check if pathname already exists in trail (user navigated back)
      const existingIndex = prev.findIndex((item) => isSameRoute(item.pathname, pathname));

      if (existingIndex >= 0) {
        // User went back - truncate trail to this point
        // Update the item's search params if they changed
        const truncated = prev.slice(0, existingIndex + 1);
        truncated[existingIndex] = {
          ...truncated[existingIndex],
          searchParams: searchParams?.toString(),
        };
        return truncated;
      }

      // New navigation - add to trail
      const newItem: BreadcrumbItem = {
        id: generateBreadcrumbId(pathname),
        pathname,
        searchParams: searchParams?.toString(),
        displayName: resolveDisplayName(pathname, searchParams),
        icon: resolveIcon(pathname),
        timestamp: Date.now(),
      };

      // Enforce max length
      const updated = [...prev, newItem];
      return updated.slice(-MAX_TRAIL_LENGTH);
    });
  }, [pathname, searchParams, setTrail]);

  const contextValue: BreadcrumbContextType = {
    setDisplayName,
    resetTrail,
    trail,
  };

  return (
    <BreadcrumbContext.Provider value={contextValue}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/**
 * Hook to access breadcrumb context
 * Use this in pages to set custom display names
 */
export function useBreadcrumbContext(): BreadcrumbContextType {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error("useBreadcrumbContext must be used within BreadcrumbProvider");
  }
  return context;
}
