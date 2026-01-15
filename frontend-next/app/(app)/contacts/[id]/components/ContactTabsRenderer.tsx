"use client";

import * as React from "react";
import {
  ChevronDown,
  Lock,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icon-map";
import type { EntityTab } from "@/lib/types/entity-tabs";
import type { Contact } from "../types";
import type { XeroLink } from "./ContactHeader";

// =============================================================================
// SSoT: Contact Tab Visibility Evaluation
// =============================================================================
// These rules match the visibility_rule values in EntityTab database.
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

    default:
      // Unknown rule - default to visible
      console.warn(`[ContactTabsRenderer] Unknown visibility_rule: ${rule}`);
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
  tabs: EntityTab[];
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

  // Create a map for quick lookup of tabs by key
  const tabsByKey = React.useMemo(() => {
    const map = new Map<string, EntityTab>();
    tabs.forEach((tab) => map.set(tab.tab_key, tab));
    return map;
  }, [tabs]);

  return (
    <TabsList className="flex-wrap h-auto gap-1">
      {rootTabs.map((tab) => {
        // Evaluate visibility
        const isVisible = evaluateVisibility(tab.visibility_rule, visibilityData);
        if (!isVisible) return null;

        // Get visible children for dropdown
        const visibleChildren = (tab.children || [])
          .filter((child) => child.enabled && evaluateVisibility(child.visibility_rule, visibilityData))
          .sort((a, b) => (a.order_position || 0) - (b.order_position || 0));

        const hasChildren = visibleChildren.length > 0;
        const badgeCount = getTabBadgeCount(tab.tab_key, visibilityData);
        const showLock = !contact.can_view_confidential && (tab.tab_key === "corporate" || tab.tab_key === "financial");

        // Get icon
        const IconComponent = tab.icon_name ? getIcon(tab.icon_name) : null;

        // If tab has children, render with dropdown
        if (hasChildren) {
          return (
            <TabWithDropdown
              key={tab.tab_key}
              tab={tab}
              children={visibleChildren}
              activeTab={activeTab}
              activeSubTab={activeSubTab}
              onTabChange={onTabChange}
              onSubTabChange={onSubTabChange}
              badgeCount={badgeCount}
              showLock={showLock}
              visibilityData={visibilityData}
            />
          );
        }

        // Simple tab without children
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

// =============================================================================
// TabWithDropdown Component - Tab with chevron dropdown for children
// =============================================================================

interface TabWithDropdownProps {
  tab: EntityTab;
  children: EntityTab[];
  activeTab: string;
  activeSubTab?: string | null;
  onTabChange: (tabKey: string) => void;
  onSubTabChange: (parentKey: string, childKey: string) => void;
  badgeCount: number | null;
  showLock: boolean;
  visibilityData: TabVisibilityData;
}

function TabWithDropdown({
  tab,
  children,
  activeTab,
  activeSubTab,
  onTabChange,
  onSubTabChange,
  badgeCount,
  showLock,
  visibilityData,
}: TabWithDropdownProps) {
  const [open, setOpen] = React.useState(false);

  // Check if current tab or any child is active
  const isActive = activeTab === tab.tab_key || children.some((c) => activeTab === c.tab_key);

  // Get icon
  const IconComponent = tab.icon_name ? getIcon(tab.icon_name) : null;

  return (
    <div className="flex items-center">
      {/* Main tab button - clicking goes to parent tab */}
      <TabsTrigger
        value={tab.tab_key}
        className={cn(
          "rounded-r-none pr-1",
          isActive && "data-[state=active]:bg-muted"
        )}
      >
        {IconComponent && <IconComponent className="h-3.5 w-3.5 mr-1" />}
        {tab.display_name}
        {badgeCount !== null && (
          <Badge variant="secondary" className="ml-1.5">
            {badgeCount}
          </Badge>
        )}
        {showLock && <Lock className="h-3 w-3 ml-1 text-amber-500" />}
      </TabsTrigger>

      {/* Dropdown for children */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-r-md px-1.5 py-1.5 text-sm font-medium ring-offset-background transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              "border-l border-border/50",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {children.map((child) => {
            const ChildIcon = child.icon_name ? getIcon(child.icon_name) : null;
            const childBadgeCount = getTabBadgeCount(child.tab_key, visibilityData);

            return (
              <DropdownMenuItem
                key={child.tab_key}
                className={cn(
                  "cursor-pointer",
                  activeSubTab === child.tab_key && "bg-accent"
                )}
                onClick={() => {
                  // Navigate to parent tab with sub-tab path
                  // URL format: /contacts/123/financial/invoices
                  onSubTabChange(tab.tab_key, child.tab_key);
                  setOpen(false);
                }}
              >
                {ChildIcon && <ChildIcon className="h-4 w-4 mr-2" />}
                {child.display_name}
                {childBadgeCount !== null && (
                  <Badge variant="secondary" className="ml-auto">
                    {childBadgeCount}
                  </Badge>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default ContactTabsRenderer;
