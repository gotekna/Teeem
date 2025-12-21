"use client";

import * as React from "react";
import { useEntityTabs } from "./useEntityTabs";
import type { EntityTab } from "@/lib/types/entity-tabs";

/**
 * SSoT: Adapter hook for corporate entity tabs
 *
 * Wraps useEntityTabs for corporate_entity scope and transforms
 * the response to match the format expected by the corporate pages.
 *
 * This enables migration from the old /api/v1/corporate/entity_tabs
 * to the unified /api/v1/entity_tabs?scope=corporate_entity
 */

// Types matching what the corporate page expects
export interface CorporateTab {
  id: string;
  name: string;
  group: string;
  icon?: string;
  component?: string;
  sub_tabs?: Array<{ name: string; folder?: string }>;
}

export interface OverviewTab {
  id: string;
  name: string;
}

export interface DocumentFolderTab {
  id: string;
  name: string;
  icon?: string;
}

interface UseCorporateEntityTabsReturn {
  // Raw tabs in CorporateTab format
  tabs: CorporateTab[];
  // Pre-split by group for convenience
  overviewTabs: OverviewTab[];
  documentTabs: DocumentFolderTab[];
  xeroSubTabs: Array<{ id: string; name: string; description: string; folderId: number }>;
  // State
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Transform EntityTab to CorporateTab format
function entityTabToCorporateTab(entityTab: EntityTab): CorporateTab {
  return {
    id: entityTab.tab_key,
    name: entityTab.display_name,
    group: entityTab.tab_group || "special",
    icon: entityTab.icon_name || undefined,
    component: entityTab.component_name || undefined,
    sub_tabs: entityTab.children?.map((child) => ({
      name: child.display_name,
      folder: child.sharepoint_folder_path || undefined,
    })),
  };
}

export function useCorporateEntityTabs(entityType?: string): UseCorporateEntityTabsReturn {
  const {
    tabs: entityTabs,
    loading,
    error,
    refetch,
  } = useEntityTabs({
    scope: "corporate_entity",
    entityType: entityType,
  });

  // Transform to CorporateTab format
  const tabs = React.useMemo(() => {
    return entityTabs.map(entityTabToCorporateTab);
  }, [entityTabs]);

  // Split tabs by group
  const overviewTabs = React.useMemo(() => {
    return tabs
      .filter((t) => t.group === "overview")
      .map((t) => ({ id: t.id, name: t.name }));
  }, [tabs]);

  const documentTabs = React.useMemo(() => {
    return tabs
      .filter((t) => t.group === "documents")
      .map((t) => {
        // Some tabs need "-docs" suffix to avoid conflicts with other tabs
        const needsDocsSuffix = ["assets", "dividends", "loans", "minutes"].includes(t.id);
        return {
          id: needsDocsSuffix ? `${t.id}-docs` : t.id,
          name: t.name,
          icon: t.icon,
        };
      });
  }, [tabs]);

  // Extract Xero sub-tabs if present
  const xeroSubTabs = React.useMemo(() => {
    const xeroTab = tabs.find((t) => t.id === "xero");
    if (!xeroTab?.sub_tabs || xeroTab.sub_tabs.length === 0) {
      return [];
    }
    return xeroTab.sub_tabs.map((st) => ({
      id: `xero-doc-${st.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: st.name,
      description: "",
      folderId: 0,
    }));
  }, [tabs]);

  return {
    tabs,
    overviewTabs,
    documentTabs,
    xeroSubTabs,
    loading,
    error,
    refetch,
  };
}
