"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

/**
 * Layout Container Components
 *
 * These components handle the common layout patterns used throughout TEEEM:
 * - Full height containers (tables, lists)
 * - Edge-to-edge layouts (no padding)
 * - Split views (list + preview pattern)
 * - Sticky headers that stay fixed while content scrolls
 *
 * Usage:
 *   <FullHeightContainer>
 *     <StickyHeader>Header content</StickyHeader>
 *     <ScrollArea>Scrollable content</ScrollArea>
 *   </FullHeightContainer>
 */

// =============================================================================
// FULL HEIGHT CONTAINER
// =============================================================================

interface FullHeightContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Use edge-to-edge mode (no padding) */
  edgeToEdge?: boolean;
}

/**
 * Container that fills available vertical space.
 * Automatically sets the appropriate layout mode.
 *
 * @example
 * <FullHeightContainer>
 *   <StickyHeader>
 *     <h1>Page Title</h1>
 *   </StickyHeader>
 *   <ScrollArea>
 *     <Table ... />
 *   </ScrollArea>
 * </FullHeightContainer>
 */
export function FullHeightContainer({
  children,
  className,
  edgeToEdge = false,
}: FullHeightContainerProps) {
  useSetLayoutMode(edgeToEdge ? "edge-to-edge" : "full-height");

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      {children}
    </div>
  );
}

// =============================================================================
// STICKY HEADER
// =============================================================================

interface StickyHeaderProps {
  children: React.ReactNode;
  className?: string;
  /** Use border-bottom for separation */
  bordered?: boolean;
  /** Background color class */
  bg?: string;
}

/**
 * Header that sticks to the top while content scrolls below.
 *
 * @example
 * <StickyHeader bordered>
 *   <div className="flex items-center justify-between">
 *     <h1>Title</h1>
 *     <Button>Action</Button>
 *   </div>
 * </StickyHeader>
 */
export function StickyHeader({
  children,
  className,
  bordered = true,
  bg = "bg-card",
}: StickyHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 shrink-0 px-3 py-2",
        bg,
        bordered && "border-b",
        className
      )}
    >
      {children}
    </div>
  );
}

// =============================================================================
// SCROLL AREA
// =============================================================================

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Scrollable content area that fills remaining space.
 *
 * @example
 * <ScrollArea>
 *   <div className="p-4">
 *     Long content here...
 *   </div>
 * </ScrollArea>
 */
export function ScrollArea({ children, className }: ScrollAreaProps) {
  return (
    <div className={cn("flex-1 min-h-0 overflow-auto", className)}>
      {children}
    </div>
  );
}

// =============================================================================
// SPLIT VIEW
// =============================================================================

interface SplitViewProps {
  children: React.ReactNode;
  className?: string;
  /** Width of left panel (CSS value or Tailwind class like "w-[30%]") */
  leftWidth?: string;
  /** Whether to use edge-to-edge layout mode */
  edgeToEdge?: boolean;
}

/**
 * Split view container with left list and right preview panels.
 * Use SplitViewLeft, SplitViewRight, and SplitViewHeader inside.
 *
 * @example
 * <SplitView leftWidth="30%">
 *   <SplitViewLeft>
 *     <SplitViewHeader position="left">
 *       <Badge>Category</Badge>
 *     </SplitViewHeader>
 *     <ScrollArea>
 *       <ItemList items={items} />
 *     </ScrollArea>
 *   </SplitViewLeft>
 *   <SplitViewRight>
 *     <SplitViewHeader position="right">
 *       <Button>Action</Button>
 *     </SplitViewHeader>
 *     <PreviewContent />
 *   </SplitViewRight>
 * </SplitView>
 */
export function SplitView({
  children,
  className,
  leftWidth = "30%",
  edgeToEdge = true,
}: SplitViewProps) {
  useSetLayoutMode(edgeToEdge ? "edge-to-edge" : "full-height");

  // Convert percentage to CSS custom property for children to use
  const style = {
    "--split-left-width": leftWidth,
  } as React.CSSProperties;

  return (
    <div className={cn("relative h-full", className)} style={style}>
      {children}
    </div>
  );
}

// =============================================================================
// SPLIT VIEW PANELS
// =============================================================================

interface SplitViewPanelProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Left panel of a split view (list side).
 * Positions absolutely and respects the header height.
 */
export function SplitViewLeft({ children, className }: SplitViewPanelProps) {
  return (
    <div
      className={cn(
        "absolute top-0 left-0 bottom-0 flex flex-col bg-card",
        className
      )}
      style={{ width: "var(--split-left-width, 30%)" }}
    >
      {children}
    </div>
  );
}

/**
 * Right panel of a split view (preview side).
 * Positions absolutely to the right of the left panel.
 */
export function SplitViewRight({ children, className }: SplitViewPanelProps) {
  return (
    <div
      className={cn(
        "absolute top-0 right-0 bottom-0 flex flex-col border-l bg-card",
        className
      )}
      style={{ left: "var(--split-left-width, 30%)" }}
    >
      {children}
    </div>
  );
}

// =============================================================================
// SPLIT VIEW HEADER
// =============================================================================

interface SplitViewHeaderProps {
  children: React.ReactNode;
  className?: string;
  /** Which panel this header is for */
  position: "left" | "right";
  /** Show border-bottom */
  bordered?: boolean;
}

/**
 * Sticky header for a split view panel.
 *
 * @example
 * <SplitViewHeader position="left">
 *   <Badge>Documents (5)</Badge>
 *   <Button>Add</Button>
 * </SplitViewHeader>
 */
export function SplitViewHeader({
  children,
  className,
  position,
  bordered = true,
}: SplitViewHeaderProps) {
  return (
    <div
      className={cn(
        "shrink-0 px-3 py-2 bg-card z-10",
        bordered && "border-b",
        position === "right" && "flex items-center justify-end gap-2",
        className
      )}
    >
      {children}
    </div>
  );
}

// =============================================================================
// SPLIT VIEW CONTENT
// =============================================================================

interface SplitViewContentProps {
  children: React.ReactNode;
  className?: string;
  /** Enable scrolling */
  scroll?: boolean;
}

/**
 * Content area within a split view panel.
 * Fills remaining space after header.
 */
export function SplitViewContent({
  children,
  className,
  scroll = true,
}: SplitViewContentProps) {
  return (
    <div
      className={cn(
        "flex-1 min-h-0",
        scroll && "overflow-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

// =============================================================================
// PANEL (Generic)
// =============================================================================

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Generic panel with flex column layout.
 * Useful for creating sections with header + content.
 */
export function Panel({ children, className }: PanelProps) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {children}
    </div>
  );
}

/**
 * Panel header - sticky at top of panel.
 */
export function PanelHeader({
  children,
  className,
  bordered = true,
}: {
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 px-3 py-2 bg-card",
        bordered && "border-b",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Panel content - scrollable area filling remaining space.
 */
export function PanelContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 min-h-0 overflow-auto", className)}>
      {children}
    </div>
  );
}
