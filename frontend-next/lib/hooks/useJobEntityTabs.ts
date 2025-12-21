"use client";

import * as React from "react";
import { useEntityTabs } from "./useEntityTabs";
import type { EntityTab } from "@/lib/types/entity-tabs";
import type { JobTab, JobTabReorderItem } from "@/lib/types/job-tabs";

/**
 * Adapter hook that wraps useEntityTabs for job scope
 * Returns data in the JobTab format expected by existing components
 *
 * This enables gradual migration from the old job_tabs API to the
 * unified entity_tabs API while maintaining backwards compatibility.
 */

// Transform EntityTab to JobTab format
function entityTabToJobTab(entityTab: EntityTab): JobTab {
  return {
    id: entityTab.id,
    name: entityTab.display_name,
    slug: entityTab.tab_key,
    icon: entityTab.icon_name || "file",
    position: entityTab.order_position,
    is_hidden: !entityTab.enabled,
    has_children: entityTab.children && entityTab.children.length > 0,
    children: entityTab.children?.map(entityTabToJobTab) || [],
  };
}

interface UseJobEntityTabsReturn {
  tabs: JobTab[];
  loading: boolean;
  error: string | null;
  reorderTabs: (items: JobTabReorderItem[]) => Promise<void>;
  toggleHidden: (tabId: number) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useJobEntityTabs(): UseJobEntityTabsReturn {
  const {
    tabs: entityTabs,
    loading,
    error,
    reorderTabs: reorderEntityTabs,
    toggleEnabled,
    refetch,
  } = useEntityTabs({ scope: "job" });

  // Transform EntityTabs to JobTabs
  const tabs = React.useMemo(() => {
    return entityTabs.map(entityTabToJobTab);
  }, [entityTabs]);

  // Adapter for reorder function
  const reorderTabs = async (items: JobTabReorderItem[]) => {
    // Transform JobTabReorderItem to the format expected by useEntityTabs
    const entityReorderItems = items.map((item) => ({
      id: item.id,
      parent_id: item.parent_id,
    }));
    await reorderEntityTabs(entityReorderItems);
  };

  // Adapter for toggle function
  const toggleHidden = async (tabId: number) => {
    await toggleEnabled(tabId);
  };

  return {
    tabs,
    loading,
    error,
    reorderTabs,
    toggleHidden,
    refetch,
  };
}
