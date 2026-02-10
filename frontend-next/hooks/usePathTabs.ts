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
  defaultTab: string,
  /** Optional list of valid tab IDs - invalid tabs fall back to defaultTab */
  validTabs?: string[]
): [string, (tab: string) => void, string | undefined] {
  const router = useRouter();
  const pathname = usePathname();

  // Parse active tab and sub-tab from path: /basePath/tab/sub → ["tab", "sub"]
  const { activeTab, subTab } = useMemo(() => {
    const parts = (pathname ?? "").replace(basePath, "").split("/").filter(Boolean);
    const rawTab = parts[0] || defaultTab;
    const tab = validTabs ? (validTabs.includes(rawTab) ? rawTab : defaultTab) : rawTab;
    return { activeTab: tab, subTab: parts[1] as string | undefined };
  }, [pathname, basePath, defaultTab, validTabs]);

  // Navigate to new tab via path
  const setActiveTab = useCallback(
    (newTab: string) => {
      router.push(`${basePath}/${newTab}`, { scroll: false });
    },
    [router, basePath]
  );

  return [activeTab, setActiveTab, subTab];
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
  const [tab, setTab] = usePathTabs(basePath, defaultSubTab);
  return [tab, setTab];
}

export default usePathTabs;
