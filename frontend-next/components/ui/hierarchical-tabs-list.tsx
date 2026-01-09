"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icon-map";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EntityTab } from "@/lib/types/entity-tabs";

interface HierarchicalTabsListProps {
  tabs: EntityTab[];
  activeTab: string;
  /** Explicit parent tab key - use when URL specifies parent (avoids tab_key collision issues) */
  activeParentTab?: string;
  onTabChange?: (tabKey: string) => void;
  className?: string;
}

/**
 * A two-row TabsList that displays parent tabs in the first row and
 * children of the selected parent in the second row.
 *
 * SSoT: Uses EntityTab directly from useEntityTabs hook (Phase 5)
 *
 * Usage:
 * ```tsx
 * const { tabs } = useEntityTabs({ scope: "job" });
 *
 * <Tabs value={activeTab} onValueChange={setActiveTab}>
 *   <HierarchicalTabsList
 *     tabs={tabs}
 *     activeTab={activeTab}
 *     onTabChange={setActiveTab}
 *   />
 *   <TabsContent value="overview">...</TabsContent>
 * </Tabs>
 * ```
 */
export function HierarchicalTabsList({
  tabs,
  activeTab,
  activeParentTab,
  onTabChange,
  className,
}: HierarchicalTabsListProps) {
  // Find the parent tab that contains the active tab as a child
  const findParentOfActiveTab = React.useCallback((): EntityTab | null => {
    for (const tab of tabs) {
      if (tab.children?.some((child) => child.tab_key === activeTab)) {
        return tab;
      }
    }
    return null;
  }, [tabs, activeTab]);

  // Determine which parent tab is "selected" for showing children
  // Priority: 1) explicit activeParentTab prop, 2) parent of active child, 3) active parent tab itself
  const selectedParent = React.useMemo(() => {
    // If explicit parent tab is provided (from URL), use it directly
    // This avoids tab_key collision issues (e.g., parent "Site" vs child "site" under "Photo")
    if (activeParentTab) {
      return tabs.find((tab) => tab.tab_key === activeParentTab) || null;
    }

    // First, check if active tab is a child of some parent
    const parentOfChild = findParentOfActiveTab();
    if (parentOfChild) return parentOfChild;

    // Otherwise, check if active tab is itself a parent with children
    const activeAsParent = tabs.find(
      (tab) => tab.tab_key === activeTab && tab.children && tab.children.length > 0
    );
    return activeAsParent || null;
  }, [tabs, activeTab, activeParentTab, findParentOfActiveTab]);

  // Get visible tabs (enabled)
  const visibleTabs = tabs.filter((tab) => tab.enabled);

  // Check if we have any children to show
  const childrenToShow = selectedParent?.children?.filter((child) => child.enabled) || [];

  return (
    <div className={cn("space-y-1", className)}>
      {/* Row 1: Parent tabs */}
      <TabsPrimitive.List
        className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
      >
        {visibleTabs.map((tab) => {
          // SSoT: Use effective_icon_name for inherited icons
          const IconComponent = getIcon(tab.effective_icon_name || tab.icon_name || "file");
          const hasChildren = tab.children && tab.children.length > 0;
          const displayMode = tab.display_mode || 'both';
          const showIcon = displayMode !== 'text_only';
          const showText = displayMode !== 'icon_only';

          // ULTRA FIX: Manually determine if this parent should be highlighted
          // This prevents collision when parent "Site" (key=site) vs child "site" under Photo
          const isSelectedParent = selectedParent?.tab_key === tab.tab_key;
          const isDirectlyActive = activeTab === tab.tab_key && !selectedParent;

          const tabContent = (
            <TabsPrimitive.Trigger
              key={tab.tab_key}
              // ULTRA FIX: Use prefixed value to prevent collision with child tab_keys
              // e.g., parent "site" becomes "__p__site", won't match child "site"
              value={`__p__${tab.tab_key}`}
              onClick={() => onTabChange?.(tab.tab_key)}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                "hover:bg-background/50",
                showIcon && showText && "gap-2",
                // ULTRA FIX: Manually apply active styles (don't rely on data-[state=active])
                (isSelectedParent || isDirectlyActive) && "bg-background text-foreground shadow-sm"
              )}
            >
              {showIcon && <IconComponent className="h-4 w-4" />}
              {showText && tab.display_name}
              {showText && hasChildren && (
                <span className="text-xs text-muted-foreground ml-0.5">
                  ({tab.children!.filter((c) => c.enabled).length})
                </span>
              )}
            </TabsPrimitive.Trigger>
          );

          // SSoT: Wrap icon-only tabs in tooltip to show name
          if (displayMode === 'icon_only') {
            return (
              <TooltipProvider key={tab.tab_key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {tabContent}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{tab.display_name}</p>
                    {hasChildren && (
                      <p className="text-xs text-muted-foreground">
                        {tab.children!.filter((c) => c.enabled).length} sub-tabs
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return tabContent;
        })}
      </TabsPrimitive.List>

      {/* Row 2: Children of selected parent */}
      {/* SSoT: Child tabs use composite keys (parent__child) to prevent tab_key collisions */}
      {childrenToShow.length > 0 && selectedParent && (
        <TabsPrimitive.List
          className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1 ml-4"
        >
          {childrenToShow.map((child) => {
            // SSoT: Use effective_icon_name for inherited icons
            const ChildIcon = getIcon(child.effective_icon_name || child.icon_name || "file");
            // SSoT: Use composite key (parent__child) to prevent collision
            // e.g., parent "Photo" with child "site" → "photo__site"
            const compositeKey = `${selectedParent.tab_key}__${child.tab_key}`;
            const isChildActive = activeTab === compositeKey || activeTab === child.tab_key;
            // SSoT: Child tabs can only be 'both' or 'text_only' (not 'icon_only')
            const displayMode = child.display_mode || 'both';
            const showIcon = displayMode !== 'text_only';
            const showText = true; // Child tabs always show text
            return (
              <TabsPrimitive.Trigger
                key={child.tab_key}
                // SSoT: Use composite key to match TabsContent value
                value={compositeKey}
                onClick={() => onTabChange?.(compositeKey)}
                data-state={isChildActive ? "active" : "inactive"}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  "hover:bg-background/50",
                  showIcon && "gap-2"
                )}
              >
                {showIcon && <ChildIcon className="h-4 w-4" />}
                {showText && child.display_name}
              </TabsPrimitive.Trigger>
            );
          })}
        </TabsPrimitive.List>
      )}
    </div>
  );
}
