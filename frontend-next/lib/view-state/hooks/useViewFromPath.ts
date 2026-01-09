/**
 * useViewFromPath Hook
 * Syncs view selection with URL query params (client-side navigation)
 *
 * URL Pattern:
 *   /jobs              → viewSlug = null (default view)
 *   /jobs?view=live    → viewSlug = "live"
 *   /contacts?view=company_role → viewSlug = "company_role"
 *
 * ULTRA FIX: Changed from path-based (/jobs/view/live) to query-param-based (/jobs?view=live)
 * This keeps the page component mounted during view switches, enabling:
 * - Instant view switching (no page reload)
 * - Data stays cached in React state
 * - Background loading continues uninterrupted
 */

"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface UseViewFromPathOptions {
  /** Foundation slug for path construction (e.g., "jobs", "contacts") */
  foundationSlug: string;
}

interface UseViewFromPathReturn {
  /** Current view slug from query param, null if on default view */
  viewSlug: string | null;
  /** Navigate to a different view (client-side, no page reload) */
  setViewSlug: (slug: string | null) => void;
  /** Check if currently on default view (no slug) */
  isDefaultView: boolean;
}

/**
 * Hook for syncing view selection with URL query params
 *
 * @example
 * ```tsx
 * const { viewSlug, setViewSlug } = useViewFromPath({ foundationSlug: "jobs" });
 *
 * // On /jobs?view=live → viewSlug = "live"
 * // Call setViewSlug("completed") → navigates to /jobs?view=completed (no reload)
 * // Call setViewSlug(null) → navigates to /jobs
 * ```
 */
export function useViewFromPath({
  foundationSlug,
}: UseViewFromPathOptions): UseViewFromPathReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract view slug from query param: /jobs?view=live → "live"
  // Also check for legacy path-based URLs: /jobs/view/live → "live"
  const viewSlug = useMemo(() => {
    // First check query param (new format)
    const queryView = searchParams?.get('view');
    if (queryView) {
      return queryView;
    }

    // Fallback: check path-based URL (legacy format)
    // This ensures backwards compatibility during transition
    if (!pathname) return null;

    const parts = pathname.split("/").filter(Boolean);
    const foundationIndex = parts.indexOf(foundationSlug);

    // Check if the segment after foundation is "view" and there's a slug after that
    // Pattern: /jobs/view/live → parts = ["jobs", "view", "live"]
    if (
      foundationIndex >= 0 &&
      parts[foundationIndex + 1] === "view" &&
      parts[foundationIndex + 2]
    ) {
      return parts[foundationIndex + 2];
    }

    return null;
  }, [searchParams, pathname, foundationSlug]);

  // Navigate to a view using query params (client-side, no page reload)
  const setViewSlug = useCallback(
    (slug: string | null) => {
      // Get base path without /view/slug suffix (handle legacy URLs)
      let basePath = pathname || `/${foundationSlug}`;

      // Strip legacy /view/[slug] from path if present
      const viewSegmentIndex = basePath.indexOf('/view/');
      if (viewSegmentIndex !== -1) {
        basePath = basePath.substring(0, viewSegmentIndex);
      }

      if (slug) {
        // Navigate with query param - keeps page mounted, no SSR reload
        router.push(`${basePath}?view=${slug}`, { scroll: false });
      } else {
        // Navigate to base path (default view)
        router.push(basePath, { scroll: false });
      }
    },
    [router, pathname, foundationSlug]
  );

  const isDefaultView = viewSlug === null;

  return { viewSlug, setViewSlug, isDefaultView };
}

export default useViewFromPath;
