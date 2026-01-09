/**
 * usePathBasedViews - SSoT for path-based view URLs in embedded tables
 *
 * Provides consistent URL handling for TeeemTableView embedded in parent pages.
 * Parent page owns the URL, table notifies parent of view changes.
 *
 * URL Pattern: /base/path/view-slug
 * Example: /jobs/46/schedule/po-tasks-only
 *
 * Usage:
 *   const { viewSlug, handleViewChange } = usePathBasedViews({
 *     basePath: `/jobs/${jobId}/schedule`
 *   });
 *
 *   <TeeemTableView
 *     initialFilters={[...]}
 *     defaultViewSlug={viewSlug}
 *     onViewChange={handleViewChange}
 *   />
 */

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import type { SavedView } from "@/components/table/types";

interface UsePathBasedViewsOptions {
  /** Base path without view slug (e.g., `/jobs/46/schedule`) */
  basePath: string;
  /** Reserved slugs that aren't view names (e.g., ['gantt'] for special modes) */
  reservedSlugs?: string[];
}

interface UsePathBasedViewsResult {
  /** Current view slug from URL path, or null if none */
  viewSlug: string | null;
  /** Callback to update URL when view changes - pass to TeeemTableView onViewChange */
  handleViewChange: (view: SavedView | null) => void;
  /** Whether the current path is a reserved slug (e.g., /schedule/gantt) */
  isReservedPath: boolean;
}

export function usePathBasedViews({
  basePath,
  reservedSlugs = [],
}: UsePathBasedViewsOptions): UsePathBasedViewsResult {
  const pathname = usePathname();
  const router = useRouter();

  // Parse view slug from path: /base/path/view-slug → "view-slug"
  const viewSlug = React.useMemo(() => {
    const remaining = pathname.replace(basePath, "");
    const parts = remaining.split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname, basePath]);

  // Check if current slug is reserved (not a view name)
  const isReservedPath = React.useMemo(() => {
    return viewSlug !== null && reservedSlugs.includes(viewSlug);
  }, [viewSlug, reservedSlugs]);

  // Handle view change - update URL path
  // Only updates if view has a slug and we're not on a reserved path
  const handleViewChange = React.useCallback(
    (view: SavedView | null) => {
      if (view?.slug && !isReservedPath) {
        router.push(`${basePath}/${view.slug}`);
      }
    },
    [router, basePath, isReservedPath]
  );

  return {
    viewSlug: isReservedPath ? null : viewSlug,
    handleViewChange,
    isReservedPath,
  };
}
