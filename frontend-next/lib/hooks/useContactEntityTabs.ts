"use client";

import * as React from "react";
import { useEntityTabs } from "./useEntityTabs";
import type { EntityTab } from "@/lib/types/entity-tabs";

/**
 * useContactEntityTabs - Adapter hook for contact scope EntityTabs
 *
 * Wraps useEntityTabs with contact-specific filtering logic.
 * Some contact tabs are conditional based on contact properties:
 * - corporate: requires linked_company && can_view_corporate
 * - cases: requires can_view_cases
 * - emails: requires contact.email
 * - invoices: requires is_customer?
 * - pricebook: requires is_supplier?
 * - directorships: requires directorships count > 0
 *
 * Usage:
 *   const { tabs, loading, error } = useContactEntityTabs({
 *     contact: contactData,
 *     directorshipsCount: directorships.length,
 *   });
 *
 * NOTE: Requires 'contact' scope to be configured in backend EntityTabs.
 * Until backend is ready, this hook will return an empty tabs array.
 */

export interface ContactTabFilters {
  // Contact object with permission flags
  contact: {
    email?: string;
    linked_company?: unknown;
    can_view_corporate?: boolean;
    can_view_cases?: boolean;
    "is_customer?"?: boolean;
    "is_supplier?"?: boolean;
  } | null;
  // External counts for conditional tabs
  directorshipsCount?: number;
}

// Contact tab types (matching tab_key values)
type ContactTabKey =
  | "overview"
  | "corporate"
  | "documents"
  | "financial"
  | "coms"
  | "cases"
  | "emails"
  | "invoices"
  | "pricebook"
  | "portal"
  | "directorships";

// Tab visibility rules based on contact properties
function isTabVisible(tab: EntityTab, filters: ContactTabFilters): boolean {
  const { contact, directorshipsCount = 0 } = filters;

  // If no contact loaded yet, only show always-visible tabs
  if (!contact) {
    const alwaysVisible: ContactTabKey[] = ["overview", "documents", "financial", "coms", "portal"];
    return alwaysVisible.includes(tab.tab_key as ContactTabKey);
  }

  // Tab-specific visibility rules
  switch (tab.tab_key as ContactTabKey) {
    case "corporate":
      return !!(contact.linked_company && contact.can_view_corporate);

    case "cases":
      return !!contact.can_view_cases;

    case "emails":
      return !!contact.email;

    case "invoices":
      return !!contact["is_customer?"];

    case "pricebook":
      return !!contact["is_supplier?"];

    case "directorships":
      return directorshipsCount > 0;

    // Always visible tabs
    case "overview":
    case "documents":
    case "financial":
    case "coms":
    case "portal":
      return true;

    // Unknown tabs - show if enabled
    default:
      return tab.enabled;
  }
}

export interface UseContactEntityTabsReturn {
  tabs: EntityTab[];
  allTabs: EntityTab[]; // All tabs before filtering (for admin)
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useContactEntityTabs(filters: ContactTabFilters): UseContactEntityTabsReturn {
  const {
    tabs: entityTabs,
    loading,
    error,
    refetch,
  } = useEntityTabs({ scope: "contact" });

  // Filter tabs based on contact properties
  const tabs = React.useMemo(() => {
    return entityTabs.filter((tab) => isTabVisible(tab, filters));
  }, [entityTabs, filters]);

  return {
    tabs,
    allTabs: entityTabs,
    loading,
    error,
    refetch,
  };
}

export default useContactEntityTabs;
