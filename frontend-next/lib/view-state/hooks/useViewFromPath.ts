/**
 * useViewFromPath Hook
 * Syncs view selection with URL path segments (SSoT URL Pattern)
 *
 * URL Pattern (Path-Based - Standard):
 *   /jobs              → viewSlug = null (default view)
 *   /jobs/view/live    → viewSlug = "live"
 *   /contacts/view/company_role → viewSlug = "company_role"
 *
 * Legacy Support:
 *   /jobs?view=live    → Redirected to /jobs/view/live by server
 *
 * SSoT: Path-based URLs are human-readable and bookmarkable.
 * See: lib/component-registry.ts URL PATTERNS section
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
 * Hook for syncing view selection with URL path segments
 *
 * @example
 * ```tsx
 * const { viewSlug, setViewSlug } = useViewFromPath({ foundationSlug: "jobs" });
 *
 * // On /jobs/view/live → viewSlug = "live"
 * // Call setViewSlug("completed") → navigates to /jobs/view/completed
 * // Call setViewSlug(null) → navigates to /jobs
 * ```
 */
export function useViewFromPath({
  foundationSlug,
}: UseViewFromPathOptions): UseViewFromPathReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract view slug from path: /jobs/view/live → "live"
  // Also check legacy query param for backwards compatibility
  const viewSlug = useMemo(() => {
    if (!pathname) return null;

    const parts = pathname.split("/").filter(Boolean);
    const foundationIndex = parts.indexOf(foundationSlug);

    // Check path-based URL (standard format)
    // Pattern: /jobs/view/live → parts = ["jobs", "view", "live"]
    if (
      foundationIndex >= 0 &&
      parts[foundationIndex + 1] === "view" &&
      parts[foundationIndex + 2]
    ) {
      return parts[foundationIndex + 2];
    }

    // Legacy: check query param (will be redirected to path by server)
    const queryView = searchParams?.get('view');
    if (queryView) {
      return queryView;
    }

    return null;
  }, [pathname, searchParams, foundationSlug]);

  // Navigate to a view using path-based URL (SSoT standard)
  const setViewSlug = useCallback(
    (slug: string | null) => {
      // Get base path without /view/slug suffix
      let basePath = pathname || `/${foundationSlug}`;

      // Strip /view/[slug] from path if present
      const viewSegmentIndex = basePath.indexOf('/view/');
      if (viewSegmentIndex !== -1) {
        basePath = basePath.substring(0, viewSegmentIndex);
      }

      // Also strip any query params from base path
      const queryIndex = basePath.indexOf('?');
      if (queryIndex !== -1) {
        basePath = basePath.substring(0, queryIndex);
      }

      if (slug) {
        // Navigate to path-based view URL
        router.push(`${basePath}/view/${slug}`, { scroll: false });
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
