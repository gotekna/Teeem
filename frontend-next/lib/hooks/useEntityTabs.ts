"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type {
  EntityTab,
  EntityTabScope,
  EntityTabsResponse,
  EntityTabResponse,
  EntityTabCreateParams,
  EntityTabUpdateParams,
  ReorderTabParams,
  TabGroup,
} from "@/lib/types/entity-tabs";

interface UseEntityTabsOptions {
  scope: EntityTabScope;
  entityType?: string; // For filtering corporate_entity tabs by Company, Trust, etc.
  tabGroup?: TabGroup; // Filter by group
  includeDisabled?: boolean; // Include disabled tabs (for admin views)
}

interface UseEntityTabsReturn {
  tabs: EntityTab[];
  groups: TabGroup[];
  loading: boolean;
  error: string | null;
  // CRUD operations
  createTab: (params: EntityTabCreateParams) => Promise<EntityTab>;
  updateTab: (id: number, params: EntityTabUpdateParams) => Promise<EntityTab>;
  deleteTab: (id: number) => Promise<void>;
  // Specialized operations
  reorderTabs: (items: ReorderTabParams[]) => Promise<void>;
  toggleEnabled: (id: number) => Promise<EntityTab>;
  // Refresh
  refetch: () => Promise<void>;
}

export function useEntityTabs(options: UseEntityTabsOptions): UseEntityTabsReturn {
  const { scope, entityType, tabGroup, includeDisabled } = options;
  const [tabs, setTabs] = React.useState<EntityTab[]>([]);
  const [groups, setGroups] = React.useState<TabGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchTabs = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams({ scope });
      if (entityType) params.append("entity_type", entityType);
      if (tabGroup) params.append("tab_group", tabGroup);
      if (includeDisabled) params.append("include_disabled", "true");

      const response = await api.get<EntityTabsResponse>(
        `/api/v1/entity_tabs?${params.toString()}`
      );

      if (response?.success) {
        setTabs(response.data.tabs);
        setGroups(response.data.groups);
      } else {
        setError("Failed to load tabs");
      }
    } catch (err) {
      setError("Failed to load tab configuration");
      console.error("Failed to fetch entity tabs:", err);
    } finally {
      setLoading(false);
    }
  }, [scope, entityType, tabGroup, includeDisabled]);

  React.useEffect(() => {
    fetchTabs();
  }, [fetchTabs]);

  const createTab = async (params: EntityTabCreateParams): Promise<EntityTab> => {
    try {
      const response = await api.post<EntityTabResponse>("/api/v1/entity_tabs", {
        entity_tab: { ...params, scope },
      });

      if (response?.success) {
        await fetchTabs();
        return response.data;
      }
      throw new Error("Failed to create tab");
    } catch (err) {
      console.error("Failed to create tab:", err);
      throw err;
    }
  };

  const updateTab = async (
    id: number,
    params: EntityTabUpdateParams
  ): Promise<EntityTab> => {
    try {
      const response = await api.patch<EntityTabResponse>(`/api/v1/entity_tabs/${id}`, {
        entity_tab: params,
      });

      if (response?.success) {
        await fetchTabs();
        return response.data;
      }
      throw new Error("Failed to update tab");
    } catch (err) {
      console.error("Failed to update tab:", err);
      throw err;
    }
  };

  const deleteTab = async (id: number): Promise<void> => {
    try {
      const response = await api.delete<{ success: boolean; error?: string }>(
        `/api/v1/entity_tabs/${id}`
      );

      if (!response?.success) {
        throw new Error(response?.error || "Failed to delete tab");
      }
      await fetchTabs();
    } catch (err) {
      console.error("Failed to delete tab:", err);
      throw err;
    }
  };

  const reorderTabs = async (items: ReorderTabParams[]): Promise<void> => {
    try {
      await api.post("/api/v1/entity_tabs/reorder", { tabs: items });
      await fetchTabs();
    } catch (err) {
      console.error("Failed to reorder tabs:", err);
      throw err;
    }
  };

  const toggleEnabled = async (id: number): Promise<EntityTab> => {
    try {
      const response = await api.post<EntityTabResponse>(
        `/api/v1/entity_tabs/${id}/toggle`
      );

      if (response?.success) {
        await fetchTabs();
        return response.data;
      }
      throw new Error("Failed to toggle tab");
    } catch (err) {
      console.error("Failed to toggle tab visibility:", err);
      throw err;
    }
  };

  return {
    tabs,
    groups,
    loading,
    error,
    createTab,
    updateTab,
    deleteTab,
    reorderTabs,
    toggleEnabled,
    refetch: fetchTabs,
  };
}
