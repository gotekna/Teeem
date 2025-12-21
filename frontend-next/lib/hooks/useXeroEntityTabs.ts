"use client";

import * as React from "react";
import { useEntityTabs } from "./useEntityTabs";
import type { EntityTab } from "@/lib/types/entity-tabs";

/**
 * SSoT: Adapter hook for Xero feature tabs
 *
 * Wraps useEntityTabs for xero scope and transforms
 * the response to match the format expected by the corporate pages.
 *
 * This enables migration from the old /api/v1/xero/tabs
 * to the unified /api/v1/entity_tabs?scope=xero
 */

// Types matching what the corporate page expects for Xero tabs
export interface XeroFeatureTab {
  id: string;
  name: string;
  type: "functional" | "document";
  component?: string;
  folderId?: number;
  description?: string;
  group?: string;
  head_only?: boolean;
  group_member?: boolean;
  parent?: string;
  order_position?: number;
  is_parent?: boolean;
}

interface UseXeroEntityTabsReturn {
  tabs: XeroFeatureTab[];
  // Level 1 tabs (no parent)
  rootTabs: XeroFeatureTab[];
  // Get children of a parent tab
  getChildTabs: (parentId: string) => XeroFeatureTab[];
  // State
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Transform EntityTab to XeroFeatureTab format
function entityTabToXeroTab(entityTab: EntityTab, parentKey?: string): XeroFeatureTab {
  const hasChildren = entityTab.children && entityTab.children.length > 0;

  return {
    id: entityTab.tab_key,
    name: entityTab.display_name,
    type: entityTab.has_sharepoint_folder ? "document" : "functional",
    component: entityTab.component_name || undefined,
    folderId: undefined, // Legacy field, not used in new system
    description: entityTab.description || undefined,
    group: entityTab.tab_group || undefined,
    head_only: false, // These filters are now handled via entity_filters
    group_member: false,
    parent: parentKey,
    order_position: entityTab.order_position,
    is_parent: hasChildren,
  };
}

// Flatten the tree structure into a flat list with parent references
function flattenTabs(tabs: EntityTab[], parentKey?: string): XeroFeatureTab[] {
  const result: XeroFeatureTab[] = [];

  for (const tab of tabs) {
    result.push(entityTabToXeroTab(tab, parentKey));

    if (tab.children && tab.children.length > 0) {
      result.push(...flattenTabs(tab.children, tab.tab_key));
    }
  }

  return result;
}

export function useXeroEntityTabs(): UseXeroEntityTabsReturn {
  const {
    tabs: entityTabs,
    loading,
    error,
    refetch,
  } = useEntityTabs({ scope: "xero" });

  // Transform to XeroFeatureTab format (flattened with parent references)
  const tabs = React.useMemo(() => {
    return flattenTabs(entityTabs);
  }, [entityTabs]);

  // Root tabs (no parent)
  const rootTabs = React.useMemo(() => {
    return tabs.filter((t) => !t.parent).sort((a, b) => (a.order_position || 0) - (b.order_position || 0));
  }, [tabs]);

  // Get children of a parent tab
  const getChildTabs = React.useCallback(
    (parentId: string) => {
      return tabs
        .filter((t) => t.parent === parentId)
        .sort((a, b) => (a.order_position || 0) - (b.order_position || 0));
    },
    [tabs]
  );

  return {
    tabs,
    rootTabs,
    getChildTabs,
    loading,
    error,
    refetch,
  };
}
