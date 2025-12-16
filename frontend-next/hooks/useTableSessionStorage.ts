"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * View state that can be persisted to session storage
 */
export interface TableViewState {
  /** Column widths by column key */
  columnWidths?: Record<string, number>;
  /** Column order (array of column keys) */
  columnOrder?: string[];
  /** Visible columns (array of column keys) */
  visibleColumns?: string[];
  /** Sort columns configuration */
  sortColumns?: Array<{
    column: string;
    dir: "asc" | "desc" | "custom";
    customOrder?: string[];
  }>;
  /** Collapsed group keys */
  collapsedGroups?: string[];
  /** Current search term */
  search?: string;
  /** Current search mode */
  searchMode?: "contains" | "exact" | "starts_with" | "fuzzy" | "regex";
  /** Row limit (for "show more" state) */
  rowLimit?: number;
  /** Scroll position */
  scrollTop?: number;
  /** Timestamp of last update */
  timestamp?: number;
}

const STORAGE_VERSION = 1;
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get the storage key for a foundation
 */
function getStorageKey(foundationId: string | number | null): string | null {
  if (!foundationId) return null;
  return `teeem-table-state-v${STORAGE_VERSION}-${foundationId}`;
}

/**
 * Safely read from session storage
 */
function readFromStorage(key: string): TableViewState | null {
  if (typeof window === "undefined") return null;

  try {
    const data = sessionStorage.getItem(key);
    if (!data) return null;

    const parsed = JSON.parse(data) as TableViewState;

    // Check if cache is expired
    if (parsed.timestamp && Date.now() - parsed.timestamp > CACHE_EXPIRY_MS) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    // Invalid JSON or other error - clear it
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore
    }
    return null;
  }
}

/**
 * Safely write to session storage
 */
function writeToStorage(key: string, state: TableViewState): void {
  if (typeof window === "undefined") return;

  try {
    const data = JSON.stringify({
      ...state,
      timestamp: Date.now(),
    });
    sessionStorage.setItem(key, data);
  } catch (e) {
    // Quota exceeded or other error - try to clear old entries
    console.warn("[useTableSessionStorage] Failed to save state:", e);
    try {
      // Clear all teeem table states (oldest first would be ideal but this is simpler)
      for (let i = 0; i < sessionStorage.length; i++) {
        const storageKey = sessionStorage.key(i);
        if (storageKey?.startsWith("teeem-table-state-")) {
          sessionStorage.removeItem(storageKey);
          break; // Remove one and retry
        }
      }
      // Retry
      sessionStorage.setItem(key, JSON.stringify({ ...state, timestamp: Date.now() }));
    } catch {
      // Give up
    }
  }
}

/**
 * Hook to persist table view state to session storage
 *
 * This provides L2 caching that survives page refreshes but not browser closes.
 * Used for things like column widths, sort order, collapsed groups, etc.
 *
 * Benefits:
 * - Instant restore when navigating back to a table
 * - Remembers scroll position
 * - Remembers search and filter state
 * - Auto-expires after 24 hours
 *
 * @param foundationId - The foundation ID to scope the cache
 * @param enabled - Whether caching is enabled (default: true)
 */
export function useTableSessionStorage(
  foundationId: string | number | null | undefined,
  enabled: boolean = true
) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [cachedState, setCachedState] = useState<TableViewState | null>(null);

  // Track if we've already loaded from storage
  const hasLoadedRef = useRef(false);

  // Get storage key
  const storageKey = getStorageKey(foundationId ?? null);

  // Load state from storage on mount
  useEffect(() => {
    if (!enabled || !storageKey || hasLoadedRef.current) return;

    const stored = readFromStorage(storageKey);
    if (stored) {
      setCachedState(stored);
    }
    hasLoadedRef.current = true;
    setIsInitialized(true);
  }, [enabled, storageKey]);

  // Save specific values to storage
  const saveState = useCallback(
    (updates: Partial<TableViewState>) => {
      if (!enabled || !storageKey) return;

      setCachedState((prev) => {
        const next = { ...prev, ...updates };
        writeToStorage(storageKey, next);
        return next;
      });
    },
    [enabled, storageKey]
  );

  // Save column widths
  const saveColumnWidths = useCallback(
    (widths: Record<string, number>) => {
      saveState({ columnWidths: widths });
    },
    [saveState]
  );

  // Save column order
  const saveColumnOrder = useCallback(
    (order: string[]) => {
      saveState({ columnOrder: order });
    },
    [saveState]
  );

  // Save visible columns
  const saveVisibleColumns = useCallback(
    (columns: string[]) => {
      saveState({ visibleColumns: columns });
    },
    [saveState]
  );

  // Save sort columns
  const saveSortColumns = useCallback(
    (
      sort: Array<{
        column: string;
        dir: "asc" | "desc" | "custom";
        customOrder?: string[];
      }>
    ) => {
      saveState({ sortColumns: sort });
    },
    [saveState]
  );

  // Save collapsed groups
  const saveCollapsedGroups = useCallback(
    (groups: string[]) => {
      saveState({ collapsedGroups: groups });
    },
    [saveState]
  );

  // Save search state
  const saveSearch = useCallback(
    (
      search: string,
      mode?: "contains" | "exact" | "starts_with" | "fuzzy" | "regex"
    ) => {
      saveState({ search, searchMode: mode });
    },
    [saveState]
  );

  // Save scroll position
  const saveScrollPosition = useCallback(
    (scrollTop: number) => {
      saveState({ scrollTop });
    },
    [saveState]
  );

  // Save row limit
  const saveRowLimit = useCallback(
    (rowLimit: number) => {
      saveState({ rowLimit });
    },
    [saveState]
  );

  // Clear all cached state for this foundation
  const clearCache = useCallback(() => {
    if (!storageKey) return;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
    setCachedState(null);
  }, [storageKey]);

  return {
    /** Whether the initial load from storage is complete */
    isInitialized,
    /** The cached state (null if not loaded or nothing cached) */
    cachedState,
    /** Save column widths */
    saveColumnWidths,
    /** Save column order */
    saveColumnOrder,
    /** Save visible columns */
    saveVisibleColumns,
    /** Save sort columns */
    saveSortColumns,
    /** Save collapsed groups */
    saveCollapsedGroups,
    /** Save search state */
    saveSearch,
    /** Save scroll position */
    saveScrollPosition,
    /** Save row limit */
    saveRowLimit,
    /** Save arbitrary state updates */
    saveState,
    /** Clear all cached state */
    clearCache,
  };
}

export default useTableSessionStorage;
