"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * usePathTabs - SSoT hook for path-based tab navigation
 *
 * Uses clean URL paths instead of query params:
 * - /page/tab instead of /page?tab=xxx
 * - Browser back/forward button support
 * - Shareable, human-readable URLs
 *
 * @param basePath - The base path before the tab segment (e.g., "/jobs/123")
 * @param defaultTab - The default tab to show if no tab in path
 * @returns [activeTab, setActiveTab] - Current tab and setter function
 *
 * @example
 * ```tsx
 * // For /jobs/123/overview, /jobs/123/schedule, etc.
 * const [activeTab, setActiveTab] = usePathTabs(`/jobs/${jobId}`, "overview");
 *
 * <Tabs value={activeTab} onValueChange={setActiveTab}>
 *   <TabsTrigger value="overview">Overview</TabsTrigger>
 *   <TabsTrigger value="schedule">Schedule</TabsTrigger>
 * </Tabs>
 * ```
 */
export function usePathTabs(
  basePath: string,
  defaultTab: string
): [string, (tab: string) => void] {
  const router = useRouter();
  const pathname = usePathname();

  // Parse active tab from path: /basePath/tab → "tab"
  const activeTab = useMemo(() => {
    const remaining = pathname.replace(basePath, "").split("/").filter(Boolean);
    return remaining[0] || defaultTab;
  }, [pathname, basePath, defaultTab]);

  // Navigate to new tab via path
  const setActiveTab = useCallback(
    (newTab: string) => {
      const url = newTab === defaultTab
        ? basePath  // Clean URL for default tab
        : `${basePath}/${newTab}`;
      router.push(url, { scroll: false });
    },
    [router, basePath, defaultTab]
  );

  return [activeTab, setActiveTab];
}

/**
 * usePathSubTabs - For nested tab navigation (parent/child paths)
 *
 * @param basePath - Base path including parent tab (e.g., "/jobs/123/photo")
 * @param defaultSubTab - Default subtab value
 * @returns [activeSubTab, setActiveSubTab]
 *
 * @example
 * ```tsx
 * // For /jobs/123/photo/site, /jobs/123/photo/progress, etc.
 * const [activeSubTab, setActiveSubTab] = usePathSubTabs(`/jobs/${jobId}/photo`, "site");
 * ```
 */
export function usePathSubTabs(
  basePath: string,
  defaultSubTab: string
): [string, (subtab: string) => void] {
  return usePathTabs(basePath, defaultSubTab);
}

export default usePathTabs;
