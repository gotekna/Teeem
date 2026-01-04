/**
 * useViewFromPath Hook
 * Syncs view selection with URL path
 *
 * URL Pattern:
 *   /jobs              → viewSlug = null (default view)
 *   /jobs/view/live    → viewSlug = "live"
 *   /contacts/view/company_role → viewSlug = "company_role"
 *
 * Note: Uses /view/ segment to avoid conflicts with /jobs/[id] detail pages
 */

"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

interface UseViewFromPathOptions {
  /** Foundation slug for path construction (e.g., "jobs", "contacts") */
  foundationSlug: string;
}

interface UseViewFromPathReturn {
  /** Current view slug from path, null if on default view */
  viewSlug: string | null;
  /** Navigate to a different view */
  setViewSlug: (slug: string | null) => void;
  /** Check if currently on default view (no slug) */
  isDefaultView: boolean;
}

/**
 * Hook for syncing view selection with URL path
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

  // Extract view slug from path: /jobs/view/live → "live"
  const viewSlug = useMemo(() => {
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
  }, [pathname, foundationSlug]);

  // Navigate to a view
  const setViewSlug = useCallback(
    (slug: string | null) => {
      if (slug) {
        // Navigate to /foundation/view/slug
        router.push(`/${foundationSlug}/view/${slug}`);
      } else {
        // Navigate to /foundation (default view)
        router.push(`/${foundationSlug}`);
      }
    },
    [router, foundationSlug]
  );

  const isDefaultView = viewSlug === null;

  return { viewSlug, setViewSlug, isDefaultView };
}

export default useViewFromPath;
