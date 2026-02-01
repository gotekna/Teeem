"use client";

import * as React from "react";

/**
 * Layout Mode System
 *
 * Allows components (especially tab contents) to declare their layout needs.
 * The app layout responds by adjusting padding, overflow, and height constraints.
 *
 * Modes:
 * - "padded" (default): Standard padding (px-4 pt-6), normal scrolling
 * - "full-height": Fills vertical space, keeps side padding, no page scroll
 * - "edge-to-edge": Fills everything, no padding, no page scroll
 * - "fullscreen": Hides sidebar, fills entire viewport (for Schedule Master)
 *
 * ============================================================================
 * 🔴 CRITICAL: SSoT - ONLY PAGE COMPONENTS SHOULD CALL useSetLayoutMode!
 * ============================================================================
 *
 * Tab components should NEVER call useSetLayoutMode directly.
 * This causes the header to shift when switching between tabs.
 *
 * CORRECT: Use page wrappers (@/components/ui/page-wrappers):
 *   - TablePage: For pages with TeeemTableView
 *   - TabbedDetailPage: For detail pages with tabs
 *   - ScrollablePage: For standard scrollable content
 *   - FullscreenPage: For fullscreen layouts (e.g., Schedule Master)
 *
 * Tab content should use tab containers (@/components/ui/tab-containers):
 *   - EdgeToEdgeTabContent: For full-width content (canvas, maps)
 *   - FullHeightTabContent: For split views, chat interfaces
 *   - ScrollableTabContent: For standard scrollable content
 *   - TableTabContent: For tabs with TeeemTableView
 *
 * See: frontend-next/lib/component-registry.ts
 */

export type LayoutMode = "padded" | "full-height" | "edge-to-edge" | "fullscreen";

interface LayoutModeContextType {
  mode: LayoutMode;
  setMode: (mode: LayoutMode) => void;
  // Computed styles based on mode
  containerClassName: string;
  contentClassName: string;
  shouldHideSidebar: boolean;
}

const LayoutModeContext = React.createContext<LayoutModeContextType | undefined>(undefined);

// ============================================================================
// 🔴 CRITICAL FIX (Feb 2026): Block Layout by Default for space-y Compatibility
// ============================================================================
//
// ROOT CAUSE: 208 files use `space-y-*` which is a BLOCK layout utility.
// Previously ALL modes forced `flex flex-col` which broke space-y everywhere.
//
// THE FIX:
// - "padded" mode: Block layout (overflow-auto only, no flex)
//   → Allows space-y, mt-*, mb-* to work naturally
//   → 99% of pages expect this (forms, content, settings)
//
// - "full-height" mode: Flex layout (needed for tables, fullscreen)
//   → Pages using TablePage, TabbedDetailPage explicitly need flex
//   → These pages call useSetLayoutMode("full-height")
//
// This fixes scrolling for 208 files while keeping specialized layouts working.
// ============================================================================

function getContainerClassName(mode: LayoutMode): string {
  // Container ALWAYS clips - the inner content div handles scrolling
  // Having overflow-auto on BOTH causes scroll conflicts
  switch (mode) {
    case "padded":
    case "full-height":
    case "edge-to-edge":
    case "fullscreen":
    default:
      return "h-full overflow-hidden";
  }
}

function getContentClassName(mode: LayoutMode): string {
  switch (mode) {
    case "padded":
      // ✅ BLOCK LAYOUT (default) - works with space-y-*, margin-top, etc.
      // This is what 99% of pages expect (forms, content, settings)
      return "pt-6 pb-0 px-4 overflow-auto";
    case "full-height":
      // ✅ FLEX LAYOUT - for pages that explicitly need it
      // Used by: TablePage, TabbedDetailPage, FullscreenPage
      return "pt-4 pb-0 px-4 flex flex-col overflow-auto";
    case "edge-to-edge":
      // ✅ FLEX LAYOUT - for edge-to-edge content
      return "flex flex-col overflow-auto";
    case "fullscreen":
      // ✅ FLEX LAYOUT - for fullscreen pages (Schedule Master)
      return "flex flex-col overflow-auto";
    default:
      return "pt-6 pb-0 px-4 overflow-auto";
  }
}

export function LayoutModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<LayoutMode>("padded");

  const value = React.useMemo(() => ({
    mode,
    setMode,
    containerClassName: getContainerClassName(mode),
    contentClassName: getContentClassName(mode),
    shouldHideSidebar: mode === "fullscreen",
  }), [mode]);

  return (
    <LayoutModeContext.Provider value={value}>
      {children}
    </LayoutModeContext.Provider>
  );
}

/**
 * Hook to access current layout mode
 */
export function useLayoutMode() {
  const context = React.useContext(LayoutModeContext);
  if (context === undefined) {
    throw new Error("useLayoutMode must be used within a LayoutModeProvider");
  }
  return context;
}

/**
 * Hook to declare a layout mode for a component
 * Automatically resets to "padded" when component unmounts
 *
 * Usage:
 * function MyFullHeightTab() {
 *   useSetLayoutMode("full-height");
 *   return <div className="h-full">...</div>;
 * }
 */
export function useSetLayoutMode(mode: LayoutMode) {
  const { setMode } = useLayoutMode();

  React.useEffect(() => {
    setMode(mode);

    // Reset to default when component unmounts
    return () => {
      setMode("padded");
    };
  }, [mode, setMode]);
}
