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
    <div className={cn("space-y-6", className)}>
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
        fullHeight ? "flex flex-col h-full" : "space-y-6",
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
      <div className={fullHeight ? "flex-1 min-h-0 flex flex-col" : ""}>
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
          isFullHeight ? "flex flex-col h-full" : "space-y-6",
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
            className={cn("space-y-4", isFullHeight ? "shrink-0" : "")}
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
 * Automatically applies correct spacing based on layout mode:
 * - Full-height mode: flex-1, min-h-0, mt-4
 * - Scrollable mode: no special styling (parent space-y-6 handles it)
 */
function Content({ children, className }: ContentProps) {
  const { isFullHeight } = React.useContext(TabbedSettingsContext);

  return (
    <div
      className={cn(
        isFullHeight ? "flex-1 min-h-0 mt-4" : "",
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
