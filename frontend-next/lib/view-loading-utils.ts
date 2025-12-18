/**
 * View Loading Utilities
 *
 * Consolidates duplicate view selection logic that previously existed in 3 places:
 * - TeeemTableView.tsx:2170-2194 (cached views path)
 * - TeeemTableView.tsx:2280-2307 (fresh API load path)
 * - ViewManagerSheet.tsx:210-232 (view manager path)
 *
 * Now provides a single, consistent implementation for default view selection.
 */

import type { SavedView } from '@/components/table/types';

export interface ViewSelectionOptions {
  /**
   * URL view ID from ?view=123 parameter (numeric ID)
   * If provided, will match by ID directly (O(1) lookup)
   * Non-numeric values are ignored (returns null for urlViewId match)
   */
  urlViewId?: number | null;

  /**
   * Whether to prefer global views over personal views
   * Default: true
   */
  preferGlobal?: boolean;
}

/**
 * Select default view from a list of views
 *
 * Priority order:
 * 1. URL parameter match by ID (?view=123)
 * 2. Explicit default flag (global preferred if preferGlobal=true)
 * 3. First global view at display_order 0
 * 4. First view at display_order 0
 * 5. First view in array
 *
 * @param views - Array of available SavedView objects
 * @param options - Selection options
 * @returns Selected view or null if no views available
 */
export function selectDefaultView(
  views: SavedView[],
  options: ViewSelectionOptions = {}
): SavedView | null {
  if (views.length === 0) return null;

  const { urlViewId, preferGlobal = true } = options;

  // Priority 1: Check URL parameter by ID (fast O(1) lookup)
  if (urlViewId !== null && urlViewId !== undefined) {
    const urlView = views.find(v => v.id === urlViewId || v.id === String(urlViewId));
    if (urlView) {
      return urlView;
    }
  }

  // Priority 2: Explicit default flag (global preferred if enabled)
  if (preferGlobal) {
    const defaultGlobalView = views.find(v => v.isDefault && v.is_global);
    if (defaultGlobalView) {
      return defaultGlobalView;
    }
  }

  const defaultView = views.find(v => v.isDefault);
  if (defaultView) {
    return defaultView;
  }

  // Priority 3: First global view at display_order 0
  const firstGlobal = views.find(v => v.is_global && v.display_order === 0);
  if (firstGlobal) {
    return firstGlobal;
  }

  // Priority 4: First view at display_order 0
  const firstOrdered = views.find(v => v.display_order === 0);
  if (firstOrdered) {
    return firstOrdered;
  }

  // Priority 5: Fallback to first view
  return views[0];
}

// NOTE: slugifyViewName was removed - we now use numeric IDs directly
// Using numeric IDs is faster (O(1) lookup), more stable (rename-safe),
// and avoids slug collision issues (e.g., "Person" vs "person" vs "Person!")

/**
 * Find a view by ID from a list of views
 *
 * @param views - Array of views to search
 * @param viewId - ID of view to find (number or string)
 * @returns Found view or null
 */
export function findViewById(
  views: SavedView[],
  viewId: number | string | null
): SavedView | null {
  if (!viewId) return null;
  return views.find(v => v.id === viewId) || null;
}

/**
 * Find a view by name from a list of views
 *
 * @param views - Array of views to search
 * @param viewName - Name of view to find
 * @param exactMatch - Whether to require exact match (default: true)
 * @returns Found view or null
 */
export function findViewByName(
  views: SavedView[],
  viewName: string,
  exactMatch = true
): SavedView | null {
  if (!viewName) return null;

  if (exactMatch) {
    return views.find(v => v.name === viewName) || null;
  } else {
    const lowerName = viewName.toLowerCase();
    return views.find(v => v.name.toLowerCase().includes(lowerName)) || null;
  }
}

/**
 * Sort views by display order
 *
 * @param views - Array of views to sort
 * @returns Sorted array (does not mutate original)
 */
export function sortViewsByDisplayOrder(views: SavedView[]): SavedView[] {
  // Safety: ensure views is an array to prevent .sort() errors
  if (!Array.isArray(views)) return [];
  return [...views].sort((a, b) => {
    const orderA = a.display_order ?? 999;
    const orderB = b.display_order ?? 999;
    return orderA - orderB;
  });
}

/**
 * Filter views by type (global vs personal)
 *
 * @param views - Array of views to filter
 * @param type - 'global' or 'personal'
 * @returns Filtered array
 */
export function filterViewsByType(
  views: SavedView[],
  type: 'global' | 'personal'
): SavedView[] {
  return views.filter(v => type === 'global' ? v.is_global : !v.is_global);
}
