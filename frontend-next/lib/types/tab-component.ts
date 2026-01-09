/**
 * Tab Component Types - SSoT for Tab Component Props
 *
 * All tab components rendered by UnifiedTabRenderer MUST implement TabComponentProps.
 * This ensures consistent behavior and enables dynamic rendering.
 */

import type { EntityTab, EntityTabScope } from "@/lib/types/entity-tabs";

/**
 * TabComponentProps - Standard props for all tab components
 *
 * Every component registered in tab-component-registry.ts MUST accept these props.
 * Components may ignore props they don't need, but the interface must be compatible.
 */
export interface TabComponentProps {
  /**
   * The ID of the entity being viewed (company ID, job ID, contact ID, etc.)
   * This is the primary identifier for data fetching.
   */
  entityId: string;

  /**
   * LEGACY: Alias for entityId, used by Xero components
   * Provided for backwards compatibility during migration.
   * New components should use entityId.
   */
  companyId?: string;

  /**
   * The type of entity (for multi-type pages like corporate companies)
   * Examples: "company", "trust", "partnership", "person"
   */
  entityType?: string;

  /**
   * Full entity data object (optional, for components that need additional context)
   * This avoids redundant API calls when parent already has the data.
   */
  entityData?: Record<string, unknown>;

  /**
   * The EntityTab configuration from the database
   * Contains: tab_key, display_name, component_name, parent_id, etc.
   */
  tabConfig?: EntityTab;

  /**
   * Callback to refresh the parent data
   * Called after mutations that affect the parent entity.
   */
  onRefresh?: () => Promise<void>;

  /**
   * Callback to update parent state
   * For components that need to communicate state changes upstream.
   */
  onUpdate?: (data?: unknown) => void;

  /**
   * Optional: Company name for display purposes
   * Some components show company context in their UI.
   */
  companyName?: string;

  /**
   * Optional: Read-only mode
   * When true, component should disable all edit functionality.
   */
  readOnly?: boolean;
}

/**
 * TabRenderContext - Context for the tab renderer
 *
 * Passed to UnifiedTabRenderer, contains all context needed to render tabs.
 */
export interface TabRenderContext {
  /**
   * Entity identifiers
   */
  entityId: string;
  entityType?: string;

  /**
   * Full entity data (fetched by parent page)
   */
  entityData?: Record<string, unknown>;

  /**
   * Tab scope for useEntityTabs hook
   */
  scope: EntityTabScope;

  /**
   * Parent callbacks
   */
  onRefresh?: () => Promise<void>;
  onUpdate?: (data?: unknown) => void;

  /**
   * Display context
   */
  companyName?: string;
  readOnly?: boolean;
}

/**
 * TabHierarchy - Represents tab navigation levels
 *
 * Supports 3-level hierarchy: L1 > L2 > L3
 * Example: Overview > Corporate > Directors
 */
export interface TabHierarchy {
  /** Level 1 tabs (top-level navigation) */
  l1Tabs: EntityTab[];

  /** Level 2 tabs (children of active L1) */
  l2Tabs: EntityTab[];

  /** Level 3 tabs (children of active L2, used by Xero) */
  l3Tabs: EntityTab[];

  /** Currently active tab at each level */
  activeL1: EntityTab | null;
  activeL2: EntityTab | null;
  activeL3: EntityTab | null;
}

/**
 * TabNavigationState - State for tab navigation
 */
export interface TabNavigationState {
  /** Active tab key at each level */
  activeL1Key: string | null;
  activeL2Key: string | null;
  activeL3Key: string | null;
}

/**
 * Helper type: Extract component props from a lazy component
 */
export type ExtractTabComponentProps<T> = T extends React.LazyExoticComponent<
  React.ComponentType<infer P>
>
  ? P
  : never;
