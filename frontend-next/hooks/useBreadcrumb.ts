/**
 * useBreadcrumb Hook
 *
 * Simple hook for pages to interact with the breadcrumb trail.
 * Use this to set custom display names for detail pages.
 *
 * @example
 * function JobDetailPage() {
 *   const { setDisplayName } = useBreadcrumb();
 *
 *   useEffect(() => {
 *     if (job?.name) {
 *       setDisplayName(job.name);  // "Lot 513 Hickory Street"
 *     }
 *   }, [job?.name, setDisplayName]);
 * }
 */

import { useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  breadcrumbTrailAtom,
  breadcrumbPinnedAtom,
  breadcrumbVisibleAtom,
  type BreadcrumbItem,
} from "@/lib/breadcrumb-atoms";

interface UseBreadcrumbReturn {
  /** Current breadcrumb trail */
  trail: BreadcrumbItem[];
  /** Set a custom display name for the current (last) page */
  setDisplayName: (displayName: string) => void;
  /** Reset the trail to empty */
  resetTrail: () => void;
  /** Whether the breadcrumb bar is pinned */
  isPinned: boolean;
  /** Toggle pin state */
  togglePin: () => void;
}

export function useBreadcrumb(): UseBreadcrumbReturn {
  const [trail, setTrail] = useAtom(breadcrumbTrailAtom);
  const [isPinned, setIsPinned] = useAtom(breadcrumbPinnedAtom);

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
   * Reset the trail to empty
   */
  const resetTrail = useCallback(() => {
    setTrail([]);
  }, [setTrail]);

  /**
   * Toggle pin state
   */
  const togglePin = useCallback(() => {
    setIsPinned((prev) => !prev);
  }, [setIsPinned]);

  return {
    trail,
    setDisplayName,
    resetTrail,
    isPinned,
    togglePin,
  };
}
