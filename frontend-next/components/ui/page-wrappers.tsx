"use client";

/**
 * PAGE WRAPPER COMPONENTS (SSoT)
 *
 * 🔴 EVERY PAGE MUST USE A WRAPPER - See: lib/GOLD_STANDARD_PAGE_PATTERNS.md
 *
 * These are THE ONLY components that should call useSetLayoutMode.
 * Individual tabs and child components MUST NOT change global layout.
 *
 * WHY THIS MATTERS:
 * - 260+ pages need consistent scrolling behavior
 * - Parent layout can be block OR flex depending on mode
 * - Wrappers ensure pages work correctly in both modes
 *
 * See: frontend-next/lib/component-registry.ts
 * See: frontend-next/lib/GOLD_STANDARD_PAGE_PATTERNS.md
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
 * // For scrollable content (forms, settings, etc.)
 * import { ScrollablePage } from "@/components/ui/page-wrappers";
 *
 * export default function SettingsPage() {
 *   return (
 *     <ScrollablePage>
 *       <form className="space-y-6">...</form>
 *     </ScrollablePage>
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
import { useSetLayoutMode, useLayoutMode } from "@/contexts/LayoutModeContext";
import { BackButton } from "@/components/ui/back-button";

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
    <div className={cn("flex flex-col gap-6", className)}>
      {children}
    </div>
  );
}

// ============================================================================
// TabbedPage - THE ONE component for simple tabbed pages
// ============================================================================

export interface TabbedPageProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  /** Right-aligned actions in the header (e.g., Add button) */
  actions?: React.ReactNode;
  /** Show back button with fallback href */
  backHref?: string;
  /** Use full-height layout (for tabs with tables/full-height content) */
  fullHeight?: boolean;
  className?: string;
}

/**
 * TabbedPage - For pages with a single tab row (like Corporate, Financial, Xero)
 *
 * THE ONE wrapper for dashboard-style pages that have:
 * - A title/description header with optional actions
 * - A single row of tabs
 * - Content that can be either scrollable or full-height
 *
 * Usage:
 * ```tsx
 * <TabbedPage title="Corporate" description="Manage corporate entities">
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabsList>
 *       <TabsTrigger value="companies">Companies</TabsTrigger>
 *       <TabsTrigger value="groups">Groups</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="companies">...</TabsContent>
 *     <TabsContent value="groups">...</TabsContent>
 *   </Tabs>
 * </TabbedPage>
 * ```
 *
 * For full-height tabs (with tables):
 * ```tsx
 * <TabbedPage title="Financial" fullHeight>
 *   ...
 * </TabbedPage>
 * ```
 */
export function TabbedPage({
  children,
  title,
  description,
  actions,
  backHref,
  fullHeight = false,
  className,
}: TabbedPageProps) {
  // Set layout mode based on fullHeight prop
  // Note: Hook is always called but mode is conditional
  useSetLayoutMode(fullHeight ? "full-height" : "padded");

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        fullHeight && "h-full",
        className
      )}
    >
      {/* Header */}
      <div className={cn("flex items-start justify-between", fullHeight ? "shrink-0" : "")}>
        <div className={cn(backHref && "flex items-center gap-4")}>
          {backHref && <BackButton fallbackHref={backHref} />}
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Tabs Content */}
      <div className={fullHeight ? "flex-1 min-h-0 flex flex-col" : "flex-1 min-h-0"}>
        {children}
      </div>
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

// ============================================================================
// TabbedSettingsPage - THE ONE component for settings-style layouts
// ============================================================================

export interface TabbedSettingsPageProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}

interface TabSectionProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

interface ContentProps {
  children: React.ReactNode;
  className?: string;
}

// Create context to share layout mode state between subcomponents
const TabbedSettingsContext = React.createContext<{ isFullHeight: boolean }>({
  isFullHeight: false,
});

/**
 * ⚠️ CRITICAL FIX (Feb 2026): Flex Layout Compatibility for Scrolling
 *
 * ROOT CAUSE: Parent layout uses `flex flex-col overflow-auto` for main content area.
 * Previously these page wrappers used `space-y-6` which is incompatible with flex containers.
 *
 * THE PROBLEM:
 * 1. app/(app)/layout.tsx: `<div className="h-full flex flex-col overflow-auto">`
 * 2. Page wrappers used: `space-y-6` (block layout utility)
 * 3. Result: Content grows beyond viewport but doesn't scroll (broken flex hierarchy)
 *
 * THE FIX:
 * - Changed all wrappers to use `flex flex-col gap-*` instead of `space-y-*`
 * - Content components use `flex-1 min-h-0` to enable proper scrolling
 * - This makes wrappers flex-compatible and allows parent overflow to work
 *
 * COMPONENTS FIXED:
 * - TabbedSettingsPage: `space-y-6` → `flex flex-col gap-6`
 * - TabbedPage: `space-y-6` → `flex flex-col gap-6`
 * - ScrollablePage: `space-y-6` → `flex flex-col gap-6`
 * - TabbedSettingsPage.Content: Always `flex-1 min-h-0` for scrolling
 */

/**
 * TabbedSettingsPage - For pages with multiple tab rows (like Settings)
 *
 * THE ONE wrapper for pages that have:
 * - A title/description header
 * - Multiple tab sections (Personal, Organization, etc.)
 * - Content that can be either scrollable or full-height
 *
 * The component auto-detects layout mode from child pages and adjusts accordingly.
 *
 * Usage:
 * ```tsx
 * <TabbedSettingsPage title="Settings" description="Manage your settings">
 *   <TabbedSettingsPage.TabSection label="PERSONAL">
 *     <Tabs><TabsList>...</TabsList></Tabs>
 *   </TabbedSettingsPage.TabSection>
 *
 *   <TabbedSettingsPage.TabSection label="ORGANIZATION">
 *     <Tabs><TabsList>...</TabsList></Tabs>
 *   </TabbedSettingsPage.TabSection>
 *
 *   <TabbedSettingsPage.Content>
 *     {children}
 *   </TabbedSettingsPage.Content>
 * </TabbedSettingsPage>
 * ```
 */
function TabbedSettingsPageRoot({
  children,
  title,
  description,
  className,
}: TabbedSettingsPageProps) {
  // Detect layout mode from child pages (e.g., TablePage, ScheduleMasterTab)
  const { mode } = useLayoutMode();

  // SSoT: Respect layout mode from child pages (e.g., TablePage, ScheduleMasterTab)
  const isFullHeight =
    mode === "full-height" || mode === "fullscreen" || mode === "edge-to-edge";

  // Separate TabSections from Content
  const childArray = React.Children.toArray(children);
  const tabSections: React.ReactNode[] = [];
  const contentChildren: React.ReactNode[] = [];

  childArray.forEach((child) => {
    if (React.isValidElement(child)) {
      if (child.type === TabSection) {
        tabSections.push(child);
      } else if (child.type === Content) {
        contentChildren.push(child);
      } else {
        // Unknown children go to content
        contentChildren.push(child);
      }
    }
  });

  return (
    <TabbedSettingsContext.Provider value={{ isFullHeight }}>
      <div
        className={cn(
          "flex flex-col gap-6",
          isFullHeight && "h-full",
          className
        )}
      >
        {/* Header */}
        <div className={isFullHeight ? "shrink-0" : ""}>
          <h1 className="text-2xl font-bold tracking-tight font-serif">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>

        {/* Tab Sections */}
        {tabSections.length > 0 && (
          <div
            className={cn("flex flex-col gap-4", isFullHeight ? "shrink-0" : "")}
          >
            {tabSections}
          </div>
        )}

        {/* Content */}
        {contentChildren}
      </div>
    </TabbedSettingsContext.Provider>
  );
}

/**
 * TabSection - A labeled section containing tabs
 *
 * Used within TabbedSettingsPage to create labeled tab groups.
 */
function TabSection({ label, children, className }: TabSectionProps) {
  return (
    <div className={className}>
      <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2 tracking-wider">
        {label}
      </h3>
      {children}
    </div>
  );
}

/**
 * Content - The main content area
 *
 * Always uses flex-1 min-h-0 to work properly in flex layout:
 * - flex-1: Fills remaining space
 * - min-h-0: Allows shrinking for overflow/scroll to work
 * - Parent gap-6 handles spacing (no manual margin needed)
 */
function Content({ children, className }: ContentProps) {
  return (
    <div
      className={cn(
        "flex-1 min-h-0",
        className
      )}
    >
      {children}
    </div>
  );
}

// Compose the component with its subcomponents
export const TabbedSettingsPage = Object.assign(TabbedSettingsPageRoot, {
  TabSection,
  Content,
});
