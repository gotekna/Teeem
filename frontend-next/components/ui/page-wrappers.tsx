"use client";

/**
 * PAGE WRAPPER COMPONENTS (SSoT)
 *
 * These are THE ONLY components that should call useSetLayoutMode.
 * Individual tabs and child components MUST NOT change global layout.
 *
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * // For full-height table pages (Jobs, Pricebook, Contacts, etc.)
 * import { TablePage } from "@/components/ui/page-wrappers";
 *
 * export default function JobsPage() {
 *   return (
 *     <TablePage>
 *       <TeeemTableView ... />
 *     </TablePage>
 *   );
 * }
 *
 * // For detail pages with tabs (Jobs/[id], Contacts/[id], etc.)
 * import { TabbedDetailPage } from "@/components/ui/page-wrappers";
 *
 * export default function JobDetailPage() {
 *   return (
 *     <TabbedDetailPage>
 *       <StickyHeader />
 *       <TabsContent />
 *     </TabbedDetailPage>
 *   );
 * }
 * ```
 *
 * CRITICAL: Never call useSetLayoutMode from tab components!
 * Use EdgeToEdgeTabContent, FullHeightTabContent, or ScrollableTabContent instead.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

export interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * TablePage - For full-height table pages
 *
 * THE ONE wrapper for pages that display a TeeemTableView as the main content.
 * Sets "full-height" layout mode and provides edge-to-edge table container.
 *
 * Used by: Jobs, Pricebook, Contacts, Estimates, Purchase Orders, etc.
 */
export function TablePage({ children, className }: PageWrapperProps) {
  useSetLayoutMode("full-height");

  return (
    <div className={cn("flex flex-col h-full -mx-4", className)}>
      {children}
    </div>
  );
}

/**
 * TabbedDetailPage - For detail pages with tabs
 *
 * THE ONE wrapper for pages that show entity details with multiple tabs.
 * Sets "full-height" layout mode for sticky headers and proper tab scrolling.
 *
 * Used by: Jobs/[id], Contacts/[id], Corporate entities, etc.
 */
export function TabbedDetailPage({ children, className }: PageWrapperProps) {
  useSetLayoutMode("full-height");

  return (
    <div className={cn("h-full flex flex-col overflow-hidden", className)}>
      {children}
    </div>
  );
}

/**
 * ScrollablePage - For simple scrollable content pages
 *
 * Uses default "padded" layout mode - no useSetLayoutMode call needed.
 * Page scrolls naturally with content.
 *
 * Used by: Settings pages, simple forms, static content, etc.
 */
export function ScrollablePage({ children, className }: PageWrapperProps) {
  // Uses default "padded" mode - no need to call useSetLayoutMode
  return (
    <div className={cn("space-y-6", className)}>
      {children}
    </div>
  );
}

/**
 * FullscreenPage - For pages that hide the sidebar
 *
 * Sets "fullscreen" layout mode which hides the sidebar completely.
 * Used for immersive experiences that need maximum screen real estate.
 *
 * Used by: Schedule Master, etc.
 */
export function FullscreenPage({ children, className }: PageWrapperProps) {
  useSetLayoutMode("fullscreen");

  return (
    <div className={cn("h-full", className)}>
      {children}
    </div>
  );
}

/**
 * EdgeToEdgePage - For pages that need no padding at all
 *
 * Sets "edge-to-edge" layout mode - no padding, full height.
 * Useful for custom layouts that manage their own spacing.
 */
export function EdgeToEdgePage({ children, className }: PageWrapperProps) {
  useSetLayoutMode("edge-to-edge");

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {children}
    </div>
  );
}
