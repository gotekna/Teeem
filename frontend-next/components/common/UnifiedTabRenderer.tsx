"use client";

/**
 * UnifiedTabRenderer - Dynamic tab rendering from EntityTabs database
 *
 * This component renders tabs dynamically based on the EntityTabs configuration.
 * It replaces hardcoded tab conditionals with database-driven rendering.
 *
 * Features:
 * - Fetches tabs from useEntityTabs(scope)
 * - Builds hierarchy (L1 → L2 → L3)
 * - Renders component from registry OR SharePoint folder
 * - Standardized props via TabComponentProps
 * - Feature flag for safe rollout
 *
 * Usage:
 *   <UnifiedTabRenderer
 *     scope="corporate"
 *     entityId={companyId}
 *     entityType="Company"
 *     entityData={company}
 *   />
 */

import * as React from "react";
import { Suspense } from "react";
import { useEntityTabs } from "@/lib/hooks/useEntityTabs";
import { getTabComponent, isTabComponentRegistered } from "@/lib/tab-component-registry";
import { TabNavigation } from "./TabNavigation";
import { AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { EntityTab, EntityTabScope, TabGroup } from "@/lib/types/entity-tabs";
import type { TabComponentProps, TabNavigationState } from "@/lib/types/tab-component";

// ============================================
// FEATURE FLAG
// ============================================

/**
 * Feature flag for UnifiedTabRenderer
 *
 * Set via environment variable: NEXT_PUBLIC_USE_UNIFIED_TABS=true
 * Or override per-page: <UnifiedTabRenderer forceEnabled={true} />
 */
export function isUnifiedTabsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return process.env.NEXT_PUBLIC_USE_UNIFIED_TABS === "true";
}

// ============================================
// TYPES
// ============================================

interface UnifiedTabRendererProps {
  /** Tab scope (corporate, job, contact) */
  scope: EntityTabScope;

  /** Entity ID for data fetching */
  entityId: string;

  /** Entity type for filtering (Company, Trust, etc.) */
  entityType?: string;

  /** Full entity data from parent */
  entityData?: Record<string, unknown>;

  /** Tab group to filter by (optional) */
  tabGroup?: TabGroup;

  /** Company name for display */
  companyName?: string;

  /** Read-only mode */
  readOnly?: boolean;

  /** Callback to refresh parent data */
  onRefresh?: () => Promise<void>;

  /** Callback for entity updates */
  onUpdate?: (data?: unknown) => void;

  /** Override feature flag - force enabled */
  forceEnabled?: boolean;

  /** Initial active tab key (optional) */
  initialTab?: string;

  /** Render function for fallback (legacy) mode */
  fallbackRenderer?: (activeTab: string, activeSubTab: string | null) => React.ReactNode;
}

// ============================================
// SKELETON COMPONENTS
// ============================================

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center p-8">
      <Spinner size={24} className="text-muted-foreground" />
    </div>
  );
}

function TabError({ error, tabName }: { error: string; tabName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400 mb-2" />
      <p className="font-medium text-red-600 dark:text-red-400">Failed to load {tabName || "tab"}</p>
      <p className="text-sm text-muted-foreground mt-1">{error}</p>
    </div>
  );
}

function MissingComponent({ componentName }: { componentName: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-amber-300 rounded-lg bg-amber-50 dark:bg-amber-950/20">
      <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
      <p className="font-medium text-amber-700 dark:text-amber-400">
        Component Not Registered
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        <code className="bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
          {componentName}
        </code>
        {" "}is not found in tab-component-registry.ts
      </p>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function UnifiedTabRenderer({
  scope,
  entityId,
  entityType,
  entityData,
  tabGroup,
  companyName,
  readOnly = false,
  onRefresh,
  onUpdate,
  forceEnabled = false,
  initialTab,
  fallbackRenderer,
}: UnifiedTabRendererProps) {
  // Check feature flag
  const isEnabled = forceEnabled || isUnifiedTabsEnabled();

  // Fetch tabs from API
  const { tabs, loading, error, refetch } = useEntityTabs({
    scope,
    entityType,
    tabGroup,
  });

  // Tab navigation state (L1, L2, L3)
  const [navState, setNavState] = React.useState<TabNavigationState>({
    activeL1Key: initialTab || null,
    activeL2Key: null,
    activeL3Key: null,
  });

  // Build tab hierarchy
  const { l1Tabs, l2Tabs, l3Tabs, activeL1, activeL2, activeL3 } = React.useMemo(() => {
    // L1 tabs: root-level tabs (no parent)
    const l1 = tabs.filter((t) => !t.parent_id && t.enabled);

    // Find active L1
    const currentL1 = navState.activeL1Key
      ? l1.find((t) => t.tab_key === navState.activeL1Key)
      : l1[0] || null;

    // L2 tabs: children of active L1
    const l2 = currentL1
      ? tabs.filter((t) => t.parent_id === currentL1.id && t.enabled)
      : [];

    // Find active L2
    const currentL2 = navState.activeL2Key
      ? l2.find((t) => t.tab_key === navState.activeL2Key)
      : l2[0] || null;

    // L3 tabs: children of active L2
    const l3 = currentL2
      ? tabs.filter((t) => t.parent_id === currentL2.id && t.enabled)
      : [];

    // Find active L3
    const currentL3 = navState.activeL3Key
      ? l3.find((t) => t.tab_key === navState.activeL3Key)
      : l3[0] || null;

    return {
      l1Tabs: l1,
      l2Tabs: l2,
      l3Tabs: l3,
      activeL1: currentL1,
      activeL2: currentL2,
      activeL3: currentL3,
    };
  }, [tabs, navState]);

  // Auto-select first tab when data loads
  React.useEffect(() => {
    if (!loading && l1Tabs.length > 0 && !navState.activeL1Key) {
      setNavState((prev) => ({
        ...prev,
        activeL1Key: l1Tabs[0].tab_key,
      }));
    }
  }, [loading, l1Tabs, navState.activeL1Key]);

  // Handle tab changes
  const handleL1Change = React.useCallback((tabKey: string) => {
    setNavState({
      activeL1Key: tabKey,
      activeL2Key: null, // Reset L2/L3 when L1 changes
      activeL3Key: null,
    });
  }, []);

  const handleL2Change = React.useCallback((tabKey: string) => {
    setNavState((prev) => ({
      ...prev,
      activeL2Key: tabKey,
      activeL3Key: null, // Reset L3 when L2 changes
    }));
  }, []);

  const handleL3Change = React.useCallback((tabKey: string) => {
    setNavState((prev) => ({
      ...prev,
      activeL3Key: tabKey,
    }));
  }, []);

  // Get the deepest active tab (for component rendering)
  const activeTab = activeL3 || activeL2 || activeL1;

  // Build props for tab component
  // Includes companyId for backwards compatibility with Xero components
  const tabProps: TabComponentProps = React.useMemo(
    () => ({
      entityId,
      companyId: entityId, // Legacy alias for Xero components
      entityType,
      entityData,
      tabConfig: activeTab || undefined,
      onRefresh,
      onUpdate,
      companyName,
      readOnly,
    }),
    [entityId, entityType, entityData, activeTab, onRefresh, onUpdate, companyName, readOnly]
  );

  // ============================================
  // FALLBACK MODE (Feature flag OFF)
  // ============================================
  if (!isEnabled && fallbackRenderer) {
    return fallbackRenderer(
      navState.activeL1Key || "",
      navState.activeL2Key || null
    );
  }

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return <TabSkeleton />;
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error) {
    return <TabError error={error} />;
  }

  // ============================================
  // NO TABS STATE
  // ============================================
  if (l1Tabs.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        No tabs configured for this entity type.
      </div>
    );
  }

  // ============================================
  // RENDER TAB CONTENT
  // ============================================
  const renderTabContent = () => {
    if (!activeTab) {
      return <div className="p-4">Select a tab</div>;
    }

    // If tab has a component_name, try to render from registry
    if (activeTab.component_name) {
      const Component = getTabComponent(activeTab.component_name);

      if (!Component) {
        return <MissingComponent componentName={activeTab.component_name} />;
      }

      return (
        <Suspense fallback={<TabSkeleton />}>
          <Component {...tabProps} />
        </Suspense>
      );
    }

    // If tab has storage folder, render folder view
    if (activeTab.warehouse_enabled && activeTab.full_warehouse_path) {
      // TODO: Import StorageFolderView when extracted
      return (
        <div className="p-4 text-muted-foreground">
          Storage folder: {activeTab.full_warehouse_path}
        </div>
      );
    }

    // No component and no storage folder - empty state
    return (
      <div className="p-4 text-center text-muted-foreground">
        This tab has no content configured.
        {activeTab.description && (
          <p className="mt-2 text-sm">{activeTab.description}</p>
        )}
      </div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <TabNavigation
        l1Tabs={l1Tabs}
        l2Tabs={l2Tabs}
        l3Tabs={l3Tabs}
        activeL1Key={navState.activeL1Key}
        activeL2Key={navState.activeL2Key}
        activeL3Key={navState.activeL3Key}
        onL1Change={handleL1Change}
        onL2Change={handleL2Change}
        onL3Change={handleL3Change}
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">{renderTabContent()}</div>
    </div>
  );
}

// ============================================
// RE-EXPORTS
// ============================================

export { TabNavigation } from "./TabNavigation";
export { isTabComponentRegistered, getTabComponent } from "@/lib/tab-component-registry";
