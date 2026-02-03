"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type { JobTab, JobTabsResponse, JobTabReorderItem } from "@/lib/types/job-tabs";

interface UseJobTabsReturn {
  tabs: JobTab[];
  loading: boolean;
  error: string | null;
  reorderTabs: (items: JobTabReorderItem[]) => Promise<void>;
  toggleHidden: (tabId: number) => Promise<void>;
  setParent: (tabId: number, parentId: number | null) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  refetch: () => Promise<void>;
}

// SSoT: Now uses WarehouseFolder API (replaces old job_tabs endpoint)
export function useJobTabs(): UseJobTabsReturn {
  const [tabs, setTabs] = React.useState<JobTab[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchTabs = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // SSoT: Use WarehouseFolder API with scope=job
      const response = await api.get<{ success: boolean; data: { tabs: any[] } }>("/api/v1/warehouse_folders?scope=job");
      if (response?.success && response.data?.tabs) {
        // Transform WarehouseFolder format to JobTab format for backwards compatibility
        const transformedTabs: JobTab[] = response.data.tabs.map((tab: any) => ({
          id: tab.id,
          name: tab.display_name,
          slug: tab.tab_key,
          icon: tab.icon_name || "file",
          position: tab.order_position,
          is_active: tab.enabled,
          is_hidden: !tab.enabled,
          parent_id: tab.parent_id,
          has_children: (tab.children?.length || 0) > 0,
          children: tab.children?.map((child: any) => ({
            id: child.id,
            name: child.display_name,
            slug: child.tab_key,
            icon: child.icon_name || "file",
            position: child.order_position,
            is_active: child.enabled,
            is_hidden: !child.enabled,
            parent_id: child.parent_id,
            has_children: false,
            children: [],
          })) || [],
        }));
        setTabs(transformedTabs);
      }
    } catch (err) {
      setError("Failed to load tab configuration");
      console.error("Failed to fetch job tabs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTabs();
  }, [fetchTabs]);

  const reorderTabs = async (items: JobTabReorderItem[]) => {
    try {
      // SSoT: Use WarehouseFolder reorder API
      await api.post("/api/v1/warehouse_folders/reorder", {
        scope: "job",
        tabs: items.map(item => ({ id: item.id, order_position: item.position }))
      });
      await fetchTabs();
    } catch (err) {
      console.error("Failed to reorder tabs:", err);
      throw err;
    }
  };

  const toggleHidden = async (tabId: number) => {
    try {
      // SSoT: Use WarehouseFolder toggle API
      await api.post(`/api/v1/warehouse_folders/${tabId}/toggle`);
      await fetchTabs();
    } catch (err) {
      console.error("Failed to toggle tab visibility:", err);
      throw err;
    }
  };

  const setParent = async (tabId: number, parentId: number | null) => {
    try {
      // SSoT: Use WarehouseFolder update API
      await api.patch(`/api/v1/warehouse_folders/${tabId}`, {
        warehouse_folder: { parent_id: parentId }
      });
      await fetchTabs();
    } catch (err) {
      console.error("Failed to set tab parent:", err);
      throw err;
    }
  };

  const resetToDefaults = async () => {
    // Note: Reset functionality would need to be implemented in WarehouseFolder if needed
    console.warn("Reset to defaults not yet implemented for WarehouseFolder");
    await fetchTabs();
  };

  return {
    tabs,
    loading,
    error,
    reorderTabs,
    toggleHidden,
    setParent,
    resetToDefaults,
    refetch: fetchTabs,
  };
}
