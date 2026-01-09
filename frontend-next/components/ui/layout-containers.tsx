"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

/**
 * Layout Container Components
 *
 * Based on the Plans tab gold standard pattern:
 * - Absolute positioning for split views
 * - Headers positioned at top with z-10
 * - Content panels start below headers (top-11 = 44px)
 * - 30/70 split by default
 *
 * Reference: JobPlansTab.tsx + TeeemDocumentView.tsx
 */

// =============================================================================
// SPLIT VIEW (Plans tab pattern)
// =============================================================================

interface SplitViewContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for split view layout. Uses edge-to-edge mode.
 *
 * @example
 * <SplitViewContainer>
 *   <SplitLeftHeader>...</SplitLeftHeader>
 *   <SplitRightHeader>...</SplitRightHeader>
 *   <SplitLeftPanel>...</SplitLeftPanel>
 *   <SplitRightPanel>...</SplitRightPanel>
 * </SplitViewContainer>
 */
export function SplitViewContainer({ children, className }: SplitViewContainerProps) {
  useSetLayoutMode("edge-to-edge");

  return (
    <div className={cn("relative h-full", className)}>
      {children}
    </div>
  );
}

// =============================================================================
// SPLIT HEADERS (sticky at top, z-10)
// =============================================================================

interface SplitHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Header for left panel (30% width).
 * Absolutely positioned at top-left with z-10.
 *
 * Pattern from JobPlansTab:
 * `absolute top-0 left-0 w-[30%] px-3 py-2 z-10 bg-card border-b`
 */
export function SplitLeftHeader({ children, className }: SplitHeaderProps) {
  return (
    <div className={cn(
      "absolute top-0 left-0 w-[30%] px-3 py-2 z-10 bg-card border-b",
      className
    )}>
      {children}
    </div>
  );
}

/**
 * Header for right panel (70% width).
 * Absolutely positioned at top-right with z-10.
 *
 * Pattern from JobPlansTab:
 * `absolute top-0 left-[30%] right-0 px-3 py-2 z-10 bg-card border-b`
 */
export function SplitRightHeader({ children, className }: SplitHeaderProps) {
  return (
    <div className={cn(
      "absolute top-0 left-[30%] right-0 px-3 py-2 z-10 bg-card border-b",
      className
    )}>
      {children}
    </div>
  );
}

// =============================================================================
// SPLIT PANELS (content areas)
// =============================================================================

interface SplitPanelProps {
  children: React.ReactNode;
  className?: string;
  /** Whether this panel has a header above it (adds top-11 offset) */
  hasHeader?: boolean;
}

/**
 * Left panel (30% width, list side).
 * Starts at top-11 (44px) to clear header.
 *
 * Pattern from TeeemDocumentView:
 * `absolute top-11 left-0 bottom-0 w-[30%] bg-card`
 */
export function SplitLeftPanel({ children, className, hasHeader = true }: SplitPanelProps) {
  return (
    <div className={cn(
      "absolute left-0 bottom-0 w-[30%] bg-card overflow-auto",
      hasHeader ? "top-11" : "top-0",
      className
    )}>
      {children}
    </div>
  );
}

/**
 * Right panel (70% width, preview side).
 * Starts at top-0 by default (preview extends to top).
 *
 * Pattern from TeeemDocumentView:
 * `absolute top-0 left-[30%] right-0 bottom-0 border-l bg-card`
 */
export function SplitRightPanel({ children, className, hasHeader = false }: SplitPanelProps) {
  return (
    <div className={cn(
      "absolute left-[30%] right-0 bottom-0 border-l bg-card",
      hasHeader ? "top-11" : "top-0",
      className
    )}>
      {children}
    </div>
  );
}

// =============================================================================
// FULL HEIGHT CONTAINER (for tables, lists)
// =============================================================================

interface FullHeightContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Use edge-to-edge mode (no padding) */
  edgeToEdge?: boolean;
}

/**
 * Container that fills available vertical space.
 * Use with StickyHeader and ScrollContent for scrollable tables.
 *
 * @example
 * <FullHeightContainer>
 *   <StickyHeader>
 *     <h1>Page Title</h1>
 *   </StickyHeader>
 *   <ScrollContent>
 *     <Table ... />
 *   </ScrollContent>
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
// STICKY HEADER (for full-height containers)
// =============================================================================

interface StickyHeaderProps {
  children: React.ReactNode;
  className?: string;
  /** Show border-bottom */
  bordered?: boolean;
}

/**
 * Header that sticks to top while content scrolls.
 * Use inside FullHeightContainer.
 */
export function StickyHeader({
  children,
  className,
  bordered = true,
}: StickyHeaderProps) {
  return (
    <div className={cn(
      "shrink-0 px-3 py-2 bg-card z-10",
      bordered && "border-b",
      className
    )}>
      {children}
    </div>
  );
}

// =============================================================================
// SCROLL CONTENT (scrollable area)
// =============================================================================

interface ScrollContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Scrollable content area that fills remaining space.
 * Use inside FullHeightContainer after StickyHeader.
 */
export function ScrollContent({ children, className }: ScrollContentProps) {
  return (
    <div className={cn("flex-1 min-h-0 overflow-auto", className)}>
      {children}
    </div>
  );
}

// =============================================================================
// EDGE TO EDGE CONTAINER (simple)
// =============================================================================

interface EdgeToEdgeContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Simple container that sets edge-to-edge layout mode.
 * Content fills entire area with no padding.
 */
export function EdgeToEdgeContainer({ children, className }: EdgeToEdgeContainerProps) {
  useSetLayoutMode("edge-to-edge");

  return (
    <div className={cn("relative h-full", className)}>
      {children}
    </div>
  );
}
