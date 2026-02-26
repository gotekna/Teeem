"use client";

import * as React from "react";
import {
  Lock,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getIcon } from "@/lib/icon-map";
import type { WarehouseFolder } from "@/lib/types/warehouse-folders";
import type { Contact } from "../types";
import type { XeroLink } from "./ContactHeader";

// =============================================================================
// SSoT: Contact Tab Visibility Evaluation
// =============================================================================
// These rules match the visibility_rule values in WarehouseFolder database.
// When evaluating, the rule string maps to a function that checks contact data.
// =============================================================================

interface TabVisibilityData {
  contact: Contact;
  xeroLinks: XeroLink[];
  directorshipsCount: number;
  shareholdingsCount: number;
  trustRolesCount: number;
  membershipsCount: number;
  caseRelationshipsCount: number;
}

/**
 * SSoT: Evaluate visibility_rule against contact data
 * Returns true if tab should be visible, false if hidden
 */
function evaluateVisibility(
  rule: string | null | undefined,
  data: TabVisibilityData
): boolean {
  // No rule = always visible
  if (!rule || rule === "always") return true;

  const { contact, xeroLinks, directorshipsCount, shareholdingsCount, trustRolesCount, membershipsCount, caseRelationshipsCount } = data;

  switch (rule) {
    // Machine-readable codes (SSoT)
    case "has_corporate_data":
      // Visible when contact has any corporate relationships
      return directorshipsCount > 0 || shareholdingsCount > 0 || trustRolesCount > 0 || membershipsCount > 0;

    case "has_cases":
      // Visible when contact has linked cases
      return caseRelationshipsCount > 0;

    case "has_email":
      // Visible when contact has an email address
      return !!contact.email;

    case "has_xero_links":
      // Visible when contact has Xero links
      return xeroLinks.length > 0;

    case "has_xero_links_and_supplier":
      // Visible when contact has Xero links AND is a supplier
      return xeroLinks.length > 0 && !!contact["is_supplier?"];

    case "is_supplier":
      // Visible when contact is a supplier
      return !!contact["is_supplier?"];

    case "has_directorships":
      // Visible when contact has directorships
      return directorshipsCount > 0;

    // Human-readable strings (legacy from migration 20260115100000)
    // These match machine codes but use readable text for admin UI display
    case "Always visible":
    case "Always visible (filtered by entity type)":
      return true;

    case "Has linked corporate":
      return directorshipsCount > 0 || shareholdingsCount > 0 || trustRolesCount > 0 || membershipsCount > 0;

    case "Has linked cases":
      return caseRelationshipsCount > 0;

    case "Has Primary Xero links":
      return xeroLinks.length > 0;

    default:
      // Unknown rule - default to visible (silent, not a warning)
      return true;
  }
}

/**
 * Get badge count for tabs that show counts
 */
function getTabBadgeCount(
  tabKey: string,
  data: TabVisibilityData
): number | null {
  switch (tabKey) {
    case "corporate":
      const total = data.directorshipsCount + data.shareholdingsCount + data.trustRolesCount + data.membershipsCount;
      return total > 0 ? total : null;

    case "cases":
      return data.caseRelationshipsCount > 0 ? data.caseRelationshipsCount : null;

    case "directorships":
      // Only show current directorships
      return data.directorshipsCount > 0 ? data.directorshipsCount : null;

    default:
      return null;
  }
}

// =============================================================================
// ContactTabsRenderer Component
// =============================================================================

interface ContactTabsRendererProps {
  tabs: WarehouseFolder[];
  activeTab: string;
  activeSubTab?: string | null;
  onTabChange: (tabKey: string) => void;
  onSubTabChange: (parentKey: string, childKey: string) => void;
  contact: Contact;
  xeroLinks: XeroLink[];
  // Counts for visibility evaluation
  directorshipsCount: number;
  shareholdingsCount: number;
  trustRolesCount: number;
  membershipsCount: number;
  caseRelationshipsCount: number;
  emailsCount?: number;
}

export function ContactTabsRenderer({
  tabs,
  activeTab,
  activeSubTab,
  onTabChange,
  onSubTabChange,
  contact,
  xeroLinks,
  directorshipsCount,
  shareholdingsCount,
  trustRolesCount,
  membershipsCount,
  caseRelationshipsCount,
  emailsCount,
}: ContactTabsRendererProps) {
  // Build visibility data object
  const visibilityData: TabVisibilityData = {
    contact,
    xeroLinks,
    directorshipsCount,
    shareholdingsCount,
    trustRolesCount,
    membershipsCount,
    caseRelationshipsCount,
  };

  // Filter to ROOT tabs only (no parent_id)
  const rootTabs = React.useMemo(() => {
    return tabs
      .filter((tab) => !tab.parent_id && tab.enabled)
      .sort((a, b) => (a.order_position || 0) - (b.order_position || 0));
  }, [tabs]);

  return (
    <TabsList className="flex-wrap h-auto gap-1">
      {rootTabs.map((tab) => {
        // Evaluate visibility
        const isVisible = evaluateVisibility(tab.visibility_rule, visibilityData);
        if (!isVisible) return null;

        const badgeCount = getTabBadgeCount(tab.tab_key, visibilityData);
        const showLock = !contact.can_view_confidential && (tab.tab_key === "corporate" || tab.tab_key === "financial");

        // Get icon
        const IconComponent = tab.icon_name ? getIcon(tab.icon_name) : null;

        // Sub-tabs are rendered inline below the active tab,
        // so no dropdown chevron needed on the parent tab.
        return (
          <TabsTrigger key={tab.tab_key} value={tab.tab_key}>
            {IconComponent && <IconComponent className="h-3.5 w-3.5 mr-1" />}
            {tab.display_name}
            {badgeCount !== null && (
              <Badge variant="secondary" className="ml-1.5">
                {badgeCount}
              </Badge>
            )}
            {showLock && <Lock className="h-3 w-3 ml-1 text-amber-500" />}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

export default ContactTabsRenderer;
