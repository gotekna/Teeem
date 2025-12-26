"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icon-map";
import type { EntityTab } from "@/lib/types/entity-tabs";

interface HierarchicalTabsListProps {
  tabs: EntityTab[];
  activeTab: string;
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
  // Either it's the active parent tab, or the parent of the active child
  const selectedParent = React.useMemo(() => {
    // First check if active tab is a parent with children
    const activeParent = tabs.find(
      (tab) => tab.tab_key === activeTab && tab.children && tab.children.length > 0
    );
    if (activeParent) return activeParent;

    // Otherwise, find the parent of the active child tab
    return findParentOfActiveTab();
  }, [tabs, activeTab, findParentOfActiveTab]);

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
          const IconComponent = getIcon(tab.icon_name || "file");
          const isParentOfActiveChild = selectedParent?.tab_key === tab.tab_key && tab.tab_key !== activeTab;
          const hasChildren = tab.children && tab.children.length > 0;

          return (
            <TabsPrimitive.Trigger
              key={tab.tab_key}
              value={tab.tab_key}
              onClick={() => onTabChange?.(tab.tab_key)}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                "hover:bg-background/50",
                "gap-2",
                // Highlight parent when a child is active
                isParentOfActiveChild && "bg-background/30"
              )}
            >
              <IconComponent className="h-4 w-4" />
              {tab.display_name}
              {hasChildren && (
                <span className="text-xs text-muted-foreground ml-0.5">
                  ({tab.children!.filter((c) => c.enabled).length})
                </span>
              )}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>

      {/* Row 2: Children of selected parent */}
      {childrenToShow.length > 0 && (
        <TabsPrimitive.List
          className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1 ml-4"
        >
          {childrenToShow.map((child) => {
            const ChildIcon = getIcon(child.icon_name || "file");
            const isChildActive = activeTab === child.tab_key;
            return (
              <TabsPrimitive.Trigger
                key={child.tab_key}
                value={child.tab_key}
                onClick={() => onTabChange?.(child.tab_key)}
                data-state={isChildActive ? "active" : "inactive"}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  "hover:bg-background/50",
                  "gap-2"
                )}
              >
                <ChildIcon className="h-4 w-4" />
                {child.display_name}
              </TabsPrimitive.Trigger>
            );
          })}
        </TabsPrimitive.List>
      )}
    </div>
  );
}
