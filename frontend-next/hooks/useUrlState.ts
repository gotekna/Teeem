"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * useUrlState - SSoT hook for URL-synced complex state management
 *
 * Extends useUrlTabs to handle multiple params, arrays, and nullable values.
 * Ensures navigation state is stored in URL query params, enabling:
 * - Browser back/forward button support
 * - Shareable URLs with navigation state
 * - Consistent navigation behavior
 * - Page refresh preserves state
 *
 * @param defaults - Object with default values for each param
 * @returns [state, setState, clearState] - Current state, setter, and clear function
 *
 * @example
 * ```tsx
 * const [state, setState] = useUrlState({
 *   scope: "corporate",
 *   tabId: null as string | null,
 *   action: null as string | null,
 *   expanded: [] as string[],
 * });
 *
 * // Read state
 * const isEditing = state.action === "edit";
 * const expandedItems = new Set(state.expanded.map(Number));
 *
 * // Update state (merges with existing)
 * setState({ scope: "job" });
 * setState({ tabId: "123", action: "edit" });
 * setState({ action: null }); // Removes param from URL
 * setState({ expanded: ["1", "2", "3"] }); // Arrays become comma-separated
 * ```
 */
export function useUrlState<T extends Record<string, string | string[] | null>>(
  defaults: T
): [T, (updates: Partial<T>) => void, (keys?: (keyof T)[]) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Parse current state from URL, falling back to defaults
  const state = useMemo(() => {
    const result = { ...defaults } as T;

    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const value = searchParams.get(key as string);
      const defaultValue = defaults[key];

      if (value !== null) {
        // Value exists in URL
        if (Array.isArray(defaultValue)) {
          // Parse comma-separated array
          (result as Record<string, unknown>)[key as string] = value
            .split(",")
            .filter(Boolean);
        } else {
          (result as Record<string, unknown>)[key as string] = value;
        }
      } else {
        // Use default value
        (result as Record<string, unknown>)[key as string] = defaultValue;
      }
    }

    return result;
  }, [searchParams, defaults]);

  // Update URL with new state (merges with existing params)
  // Uses window.location.search to avoid stale closure issues when
  // multiple updates happen before React re-renders with new searchParams
  const setState = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(window.location.search);

      for (const [key, value] of Object.entries(updates)) {
        const defaultValue = defaults[key as keyof T];

        if (value === null || value === undefined) {
          // Remove param when set to null/undefined
          params.delete(key);
        } else if (Array.isArray(value)) {
          // Handle array values
          if (value.length === 0) {
            // Empty array = remove param
            params.delete(key);
          } else if (
            Array.isArray(defaultValue) &&
            JSON.stringify(value) === JSON.stringify(defaultValue)
          ) {
            // Same as default = remove param (cleaner URLs)
            params.delete(key);
          } else {
            // Non-empty array = comma-separated
            params.set(key, value.join(","));
          }
        } else if (value === defaultValue) {
          // Same as default = remove param (cleaner URLs)
          params.delete(key);
        } else {
          // Set the value
          params.set(key, String(value));
        }
      }

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

      router.push(newUrl, { scroll: false });
    },
    [router, pathname, defaults]
  );

  // Clear specific params or all tracked params
  const clearState = useCallback(
    (keys?: (keyof T)[]) => {
      const params = new URLSearchParams(window.location.search);

      const keysToDelete = keys || (Object.keys(defaults) as (keyof T)[]);
      keysToDelete.forEach((key) => params.delete(key as string));

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

      router.push(newUrl, { scroll: false });
    },
    [router, pathname, defaults]
  );

  return [state, setState, clearState];
}

/**
 * Helper to convert Set<number> to/from URL-friendly string array
 */
export function setToUrlArray(set: Set<number>): string[] {
  return Array.from(set).map(String);
}

export function urlArrayToSet(arr: string[]): Set<number> {
  return new Set(arr.map(Number).filter((n) => !isNaN(n)));
}

export default useUrlState;
