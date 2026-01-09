"use client";

/**
 * TAB CONTENT CONTAINERS
 *
 * These containers handle internal layout for tab content.
 *
 * CRITICAL: These MUST NOT call useSetLayoutMode!
 * Only page-level components should change the global layout mode.
 * Tabs handle their own internal padding/layout needs.
 *
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import {
 *   EdgeToEdgeTabContent,
 *   FullHeightTabContent,
 *   ScrollableTabContent
 * } from "@/components/ui/tab-containers";
 *
 * // For tabs that need edge-to-edge content (like Plans with canvas)
 * <TabsContent value="plans">
 *   <EdgeToEdgeTabContent>
 *     <JobPlansTab ... />
 *   </EdgeToEdgeTabContent>
 * </TabsContent>
 *
 * // For tabs that need full height (like Communications with split view)
 * <TabsContent value="coms">
 *   <FullHeightTabContent>
 *     <JobCommunicationsTab ... />
 *   </FullHeightTabContent>
 * </TabsContent>
 *
 * // For standard scrollable tab content (default)
 * <TabsContent value="overview">
 *   <ScrollableTabContent>
 *     <OverviewContent ... />
 *   </ScrollableTabContent>
 * </TabsContent>
 * ```
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * EdgeToEdgeTabContent - For tabs that need full-width content
 *
 * Removes parent padding so content can extend edge-to-edge.
 * Use for: Canvas views, full-width maps, immersive content.
 *
 * DOES NOT call useSetLayoutMode - handles padding internally.
 */
export function EdgeToEdgeTabContent({ children, className }: TabContainerProps) {
  return (
    <div className={cn("h-full -mx-3 -mb-6", className)}>
      {children}
    </div>
  );
}

/**
 * FullHeightTabContent - For tabs that need to fill available height
 *
 * Creates a flex container that fills parent height.
 * Use for: Split views, chat interfaces, anything that shouldn't scroll the page.
 *
 * DOES NOT call useSetLayoutMode - handles height internally.
 */
export function FullHeightTabContent({ children, className }: TabContainerProps) {
  return (
    <div className={cn("h-full flex flex-col min-h-0", className)}>
      {children}
    </div>
  );
}

/**
 * ScrollableTabContent - For standard scrollable content (default)
 *
 * Standard container with top margin. Content scrolls within the tab area.
 * Use for: Forms, lists, cards, standard content layouts.
 *
 * DOES NOT call useSetLayoutMode - uses default styling.
 */
export function ScrollableTabContent({ children, className }: TabContainerProps) {
  return (
    <div className={cn("mt-4", className)}>
      {children}
    </div>
  );
}

/**
 * TableTabContent - For tabs that display a TeeemTableView
 *
 * Provides proper height and negative margin for full-width tables.
 * Use for: Any tab that shows a data table.
 *
 * DOES NOT call useSetLayoutMode - handles table layout internally.
 */
export function TableTabContent({ children, className }: TabContainerProps) {
  return (
    <div className={cn("h-full flex flex-col -mx-3", className)}>
      {children}
    </div>
  );
}
