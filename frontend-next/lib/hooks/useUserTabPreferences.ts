"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type { EntityTabScope } from "@/lib/types/entity-tabs";

interface UserTabPreferences {
  scope: EntityTabScope;
  hidden_tabs: string[];
  default_tab: string | null;
  tab_order: string[];
}

interface UseUserTabPreferencesReturn {
  preferences: UserTabPreferences | null;
  loading: boolean;
  error: string | null;
  hiddenTabs: string[];
  defaultTab: string | null;
  tabOrder: string[];
  isTabHidden: (tabKey: string) => boolean;
  toggleTab: (tabKey: string) => Promise<void>;
  setDefaultTab: (tabKey: string | null) => Promise<void>;
  setTabOrder: (order: string[]) => Promise<void>;
  updatePreferences: (hidden: string[], defaultTab: string | null, order?: string[]) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useUserTabPreferences(scope: EntityTabScope): UseUserTabPreferencesReturn {
  const [preferences, setPreferences] = React.useState<UserTabPreferences | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPreferences = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<{ success: boolean; data: UserTabPreferences }>(
        `/api/v1/user_entity_tab_preferences/${scope}`
      );

      if (response?.success) {
        setPreferences(response.data);
      } else {
        // No preferences saved yet - use defaults
        setPreferences({
          scope,
          hidden_tabs: [],
          default_tab: null,
          tab_order: [],
        });
      }
    } catch (err) {
      // Not found is OK - means no preferences saved yet
      setPreferences({
        scope,
        hidden_tabs: [],
        default_tab: null,
        tab_order: [],
      });
    } finally {
      setLoading(false);
    }
  }, [scope]);

  React.useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const hiddenTabs = React.useMemo(
    () => preferences?.hidden_tabs || [],
    [preferences]
  );

  const defaultTab = React.useMemo(
    () => preferences?.default_tab || null,
    [preferences]
  );

  const tabOrder = React.useMemo(
    () => preferences?.tab_order || [],
    [preferences]
  );

  const isTabHidden = React.useCallback(
    (tabKey: string) => hiddenTabs.includes(tabKey),
    [hiddenTabs]
  );

  const toggleTab = React.useCallback(async (tabKey: string) => {
    try {
      // Optimistic update
      const newHiddenTabs = hiddenTabs.includes(tabKey)
        ? hiddenTabs.filter((t) => t !== tabKey)
        : [...hiddenTabs, tabKey];

      setPreferences((prev) => prev ? { ...prev, hidden_tabs: newHiddenTabs } : null);

      const response = await api.post<{ success: boolean; data: { hidden_tabs: string[] } }>(
        `/api/v1/user_entity_tab_preferences/${scope}/toggle_tab`,
        { tab_key: tabKey }
      );

      if (response?.success) {
        setPreferences((prev) => prev ? { ...prev, hidden_tabs: response.data.hidden_tabs } : null);
      }
    } catch (err) {
      console.error("Failed to toggle tab:", err);
      await fetchPreferences(); // Revert on error
    }
  }, [scope, hiddenTabs, fetchPreferences]);

  const setDefaultTab = React.useCallback(async (tabKey: string | null) => {
    try {
      // Optimistic update
      setPreferences((prev) => prev ? { ...prev, default_tab: tabKey } : null);

      const response = await api.post<{ success: boolean; data: { default_tab: string | null } }>(
        `/api/v1/user_entity_tab_preferences/${scope}/set_default`,
        { tab_key: tabKey || "" }
      );

      if (response?.success) {
        setPreferences((prev) => prev ? { ...prev, default_tab: response.data.default_tab } : null);
      }
    } catch (err) {
      console.error("Failed to set default tab:", err);
      await fetchPreferences();
    }
  }, [scope, fetchPreferences]);

  const setTabOrder = React.useCallback(async (order: string[]) => {
    try {
      // Optimistic update
      setPreferences((prev) => prev ? { ...prev, tab_order: order } : null);

      const response = await api.post<{ success: boolean; data: { tab_order: string[] } }>(
        `/api/v1/user_entity_tab_preferences/${scope}/reorder`,
        { tab_order: order }
      );

      if (response?.success) {
        setPreferences((prev) => prev ? { ...prev, tab_order: response.data.tab_order } : null);
      }
    } catch (err) {
      console.error("Failed to set tab order:", err);
      await fetchPreferences();
    }
  }, [scope, fetchPreferences]);

  const updatePreferences = React.useCallback(async (hidden: string[], defaultTabKey: string | null, order?: string[]) => {
    try {
      const response = await api.patch<{ success: boolean; data: UserTabPreferences }>(
        `/api/v1/user_entity_tab_preferences/${scope}`,
        { hidden_tabs: hidden, default_tab: defaultTabKey, tab_order: order }
      );

      if (response?.success) {
        setPreferences(response.data);
      }
    } catch (err) {
      console.error("Failed to update preferences:", err);
      throw err;
    }
  }, [scope]);

  const resetToDefaults = React.useCallback(async () => {
    try {
      await api.delete(`/api/v1/user_entity_tab_preferences/${scope}`);
      setPreferences({
        scope,
        hidden_tabs: [],
        default_tab: null,
        tab_order: [],
      });
    } catch (err) {
      console.error("Failed to reset preferences:", err);
    }
  }, [scope]);

  return {
    preferences,
    loading,
    error,
    hiddenTabs,
    defaultTab,
    tabOrder,
    isTabHidden,
    toggleTab,
    setDefaultTab,
    setTabOrder,
    updatePreferences,
    resetToDefaults,
    refetch: fetchPreferences,
  };
}
