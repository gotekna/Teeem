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

export function useJobTabs(): UseJobTabsReturn {
  const [tabs, setTabs] = React.useState<JobTab[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchTabs = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<JobTabsResponse>("/api/v1/job_tabs");
      if (response?.success) {
        setTabs(response.tabs);
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
      await api.patch("/api/v1/job_tabs/reorder", { tabs: items });
      await fetchTabs();
    } catch (err) {
      console.error("Failed to reorder tabs:", err);
      throw err;
    }
  };

  const toggleHidden = async (tabId: number) => {
    try {
      await api.patch(`/api/v1/job_tabs/${tabId}/toggle_hidden`);
      await fetchTabs();
    } catch (err) {
      console.error("Failed to toggle tab visibility:", err);
      throw err;
    }
  };

  const setParent = async (tabId: number, parentId: number | null) => {
    try {
      await api.patch(`/api/v1/job_tabs/${tabId}/set_parent`, { parent_id: parentId });
      await fetchTabs();
    } catch (err) {
      console.error("Failed to set tab parent:", err);
      throw err;
    }
  };

  const resetToDefaults = async () => {
    try {
      const response = await api.post<JobTabsResponse>("/api/v1/job_tabs/reset");
      if (response?.success) {
        setTabs(response.tabs);
      }
    } catch (err) {
      console.error("Failed to reset tabs:", err);
      throw err;
    }
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
