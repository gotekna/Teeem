"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

interface TabItem {
  name: string;
  slug: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface WrappingTabsListProps {
  tabs: TabItem[];
  className?: string;
}

/**
 * A TabsList that wraps into multiple rows instead of scrolling horizontally.
 * Use this when you have many tabs and want them all visible without scrolling.
 *
 * Usage:
 * ```tsx
 * <Tabs value={activeTab} onValueChange={setActiveTab}>
 *   <WrappingTabsList tabs={tabs} />
 *   <TabsContent value="tab1">...</TabsContent>
 * </Tabs>
 * ```
 */
export function WrappingTabsList({ tabs, className }: WrappingTabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex flex-wrap gap-1 rounded-lg bg-muted p-1",
        className
      )}
    >
      {tabs.map((tab) => (
        <TabsPrimitive.Trigger
          key={tab.slug}
          value={tab.slug}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
            "hover:bg-background/50",
            "gap-2"
          )}
        >
          {tab.icon && <tab.icon className="h-4 w-4" />}
          {tab.name}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
  );
}
