"use client";

/**
 * XeroTabRenderer - Renders Xero tabs using the unified tab system
 *
 * This is a wrapper around UnifiedTabRenderer specifically for Xero tabs.
 * It provides:
 * - Feature flag support (NEXT_PUBLIC_USE_UNIFIED_TABS)
 * - Fallback to existing hardcoded rendering when flag is off
 * - Consistent props interface for Xero components
 *
 * Usage in corporate page:
 *   {activeTab === "xero" && (
 *     <XeroTabRenderer
 *       companyId={companyId}
 *       companyName={company?.name}
 *       company={company}
 *       onRefresh={loadCompany}
 *     />
 *   )}
 */

import * as React from "react";
import { Suspense } from "react";
import { useEntityTabs } from "@/lib/hooks/useEntityTabs";
import { getTabComponent } from "@/lib/tab-component-registry";
import { TabNavigation } from "@/components/common/TabNavigation";
import { Loader2, AlertCircle } from "lucide-react";
import type { EntityTab } from "@/lib/types/entity-tabs";

// ============================================
// FEATURE FLAG
// ============================================

function isUnifiedXeroTabsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return process.env.NEXT_PUBLIC_USE_UNIFIED_TABS === "true";
}

// ============================================
// TYPES
// ============================================

interface XeroTabRendererProps {
  /** Company ID (required) */
  companyId: string;

  /** Company name for display */
  companyName?: string;

  /** Full company data object - uses any to support CorporateCompany from caller */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  company?: any;

  /** Callback to refresh company data */
  onRefresh?: () => Promise<void>;

  /** Force enable unified tabs (for testing) */
  forceEnabled?: boolean;

  /** Initial sub-tab to show */
  initialTab?: string;

  /** Callback when sub-tab changes (for URL sync) */
  onTabChange?: (tabKey: string) => void;

  /**
   * Fallback render function for when feature flag is OFF
   * Returns the legacy hardcoded tab content
   */
  legacyRenderer?: (xeroSubTab: string) => React.ReactNode;

  /**
   * Component for rendering SharePoint document folder tabs
   * Used when tab has has_sharepoint_folder=true
   * Uses any for company to support CorporateCompany type from caller
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DocumentsTabComponent?: React.ComponentType<{
    companyId: string;
    company: any;
    category?: string;
  }>;
}

// ============================================
// SKELETON COMPONENTS
// ============================================

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
        {" "}not found in tab-component-registry
      </p>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function XeroTabRenderer({
  companyId,
  companyName,
  company,
  onRefresh,
  forceEnabled = false,
  initialTab = "connection",
  onTabChange,
  legacyRenderer,
  DocumentsTabComponent,
}: XeroTabRendererProps) {
  const isEnabled = forceEnabled || isUnifiedXeroTabsEnabled();

  // State for current sub-tab
  const [activeSubTab, setActiveSubTab] = React.useState(initialTab);

  // Fetch Xero tabs from API (children of "xero" parent in corporate_entity scope)
  const { tabs, loading, error } = useEntityTabs({
    scope: "corporate_entity",
    // entityType filtering not needed for Xero tabs
  });

  // Filter to just Xero tabs (tabs with parent that has tab_key="xero")
  // NOTE: Backend returns NESTED tabs (children inside parent.children array)
  const xeroTabs = React.useMemo((): EntityTab[] => {
    // Find the Xero parent tab
    const xeroParent = tabs.find((t) => t.tab_key === "xero" && !t.parent_id);
    if (!xeroParent) return [];

    // Children are NESTED inside parent (EntityTab.children array)
    const children: EntityTab[] = xeroParent.children || [];
    return children.filter((t) => t.enabled);
  }, [tabs]);

  // Build hierarchy (L1 = direct children of xero, L2 = grandchildren)
  // NOTE: Backend returns NESTED structure, so L2 tabs are in L1.children
  const { l1Tabs, l2Tabs, activeL1, activeL2 } = React.useMemo(() => {
    // L1 tabs = xeroTabs (direct children of Xero parent)
    const l1 = xeroTabs;

    // Find active L1 - match by tab_key or prefix
    const currentL1 = l1.find((t) => t.tab_key === activeSubTab)
      || l1.find((t) => activeSubTab.startsWith(t.tab_key))
      || l1[0] || null;

    // L2 tabs = children NESTED inside active L1 tab
    const l2Children: EntityTab[] = currentL1?.children || [];
    const l2 = l2Children.filter((t) => t.enabled);

    // Find active L2
    const currentL2 = l2.find((t) => t.tab_key === activeSubTab) || l2[0] || null;

    return {
      l1Tabs: l1,
      l2Tabs: l2,
      activeL1: currentL1,
      activeL2: currentL2,
    };
  }, [xeroTabs, activeSubTab]);

  // Handle tab changes
  const handleL1Change = React.useCallback(
    (tabKey: string) => {
      setActiveSubTab(tabKey);
      onTabChange?.(tabKey);
    },
    [onTabChange]
  );

  const handleL2Change = React.useCallback(
    (tabKey: string) => {
      setActiveSubTab(tabKey);
      onTabChange?.(tabKey);
    },
    [onTabChange]
  );

  // Get deepest active tab for rendering
  const activeTab = activeL2 || activeL1;

  // ============================================
  // FALLBACK MODE (Feature flag OFF)
  // ============================================
  if (!isEnabled && legacyRenderer) {
    return <>{legacyRenderer(activeSubTab)}</>;
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
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="font-medium text-red-600">Failed to load Xero tabs</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  // ============================================
  // NO TABS STATE
  // ============================================
  if (xeroTabs.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        No Xero tabs configured. Configure in Admin &gt; System &gt; Entity Configuration.
      </div>
    );
  }

  // ============================================
  // RENDER TAB CONTENT
  // ============================================
  const renderTabContent = () => {
    if (!activeTab) {
      return <div className="p-4">Select a Xero tab</div>;
    }

    // If tab has a component_name, try to render from registry
    if (activeTab.component_name) {
      const Component = getTabComponent(activeTab.component_name);

      if (!Component) {
        return <MissingComponent componentName={activeTab.component_name} />;
      }

      // Build props for the component
      const componentProps = {
        // Standard TabComponentProps
        entityId: companyId,
        companyId, // Legacy alias
        companyName,
        entityData: company,
        tabConfig: activeTab,
        onRefresh,
        // Xero-specific props that some components expect
        onConnectionChange: () => {}, // Placeholder
        onComplete: () => handleL1Change("overview"), // After setup, go to overview
      };

      return (
        <Suspense fallback={<TabSkeleton />}>
          <Component {...componentProps} />
        </Suspense>
      );
    }

    // If tab has SharePoint folder, render folder view
    if (activeTab.has_sharepoint_folder && activeTab.full_sharepoint_path) {
      // Use provided DocumentsTabComponent if available
      if (DocumentsTabComponent && company) {
        return (
          <Suspense fallback={<TabSkeleton />}>
            <DocumentsTabComponent
              companyId={companyId}
              company={company}
              category={activeTab.tab_key}
            />
          </Suspense>
        );
      }

      // Fallback: show path info
      return (
        <div className="p-4 text-muted-foreground">
          SharePoint folder: {activeTab.full_sharepoint_path}
        </div>
      );
    }

    // No component and no SharePoint - empty state
    return (
      <div className="p-4 text-center text-muted-foreground">
        This tab has no content configured.
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
        l3Tabs={[]}
        activeL1Key={activeL1?.tab_key || null}
        activeL2Key={activeL2?.tab_key || null}
        activeL3Key={null}
        onL1Change={handleL1Change}
        onL2Change={handleL2Change}
        onL3Change={() => {}}
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">{renderTabContent()}</div>
    </div>
  );
}

export default XeroTabRenderer;
