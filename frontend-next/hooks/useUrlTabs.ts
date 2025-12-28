"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * useUrlTabs - SSoT hook for URL-synced tab navigation
 *
 * Ensures tab state is stored in URL query params, enabling:
 * - Browser back/forward button support
 * - Shareable URLs with tab state
 * - Consistent navigation behavior
 *
 * @param defaultTab - The default tab to show if no ?tab= param exists
 * @param paramName - Query param name (default: "tab")
 * @returns [activeTab, setActiveTab] - Current tab and setter function
 *
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = useUrlTabs("overview");
 *
 * <Tabs value={activeTab} onValueChange={setActiveTab}>
 *   <TabsTrigger value="overview">Overview</TabsTrigger>
 *   <TabsTrigger value="details">Details</TabsTrigger>
 * </Tabs>
 * ```
 */
export function useUrlTabs(
  defaultTab: string,
  paramName: string = "tab"
): [string, (tab: string) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Read current tab from URL, fallback to default
  const activeTab = searchParams.get(paramName) || defaultTab;

  // Update URL when tab changes
  const setActiveTab = useCallback(
    (newTab: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newTab === defaultTab) {
        // Remove param if it's the default (cleaner URLs)
        params.delete(paramName);
      } else {
        params.set(paramName, newTab);
      }

      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;

      router.push(newUrl, { scroll: false });
    },
    [router, searchParams, pathname, paramName, defaultTab]
  );

  return [activeTab, setActiveTab];
}

/**
 * useUrlSubTabs - For nested tab navigation (tab + subtab)
 *
 * @param defaultSubTab - Default subtab value
 * @param paramName - Query param name (default: "subtab")
 */
export function useUrlSubTabs(
  defaultSubTab: string,
  paramName: string = "subtab"
): [string, (subtab: string) => void] {
  return useUrlTabs(defaultSubTab, paramName);
}

export default useUrlTabs;
