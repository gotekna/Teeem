/**
 * View State Module
 * Foundation-scoped view state management
 *
 * This module provides isolated view state per foundation, eliminating
 * the state pollution issues with global Jotai atoms.
 *
 * Core Concepts:
 * - URL is SSoT for view selection (/jobs/live)
 * - Each foundation gets isolated state via atomFamily
 * - Atomic view application (all state changes at once)
 *
 * @example
 * ```tsx
 * import { useFoundationViewState } from "@/lib/view-state";
 *
 * function MyComponent() {
 *   const {
 *     activeViewId,
 *     groupByColumns,
 *     cascadeFilters,
 *     applyView,
 *     setViewSlug,
 *   } = useFoundationViewState("jobs", {
 *     initialView,
 *     viewSlug: "live",
 *   });
 * }
 * ```
 */

// Types
export type {
  ViewState,
  ViewStateUpdate,
  SSRViewConfig,
  UseFoundationViewStateOptions,
  GroupViewMode,
  ViewDisplayType,
} from "./types";
export { createDefaultViewState } from "./types";

// Atoms
export {
  viewStateFamily,
  updateViewStateFamily,
  resetViewStateFamily,
  collapsedGroupsFamily,
  toggleCollapsedGroupFamily,
  setCollapsedGroupsFamily,
  clearCollapsedGroupsFamily,
  createViewStateFieldAtom,
} from "./atoms";

// Hooks
export {
  useFoundationViewState,
  type UseFoundationViewStateReturn,
} from "./hooks/useFoundationViewState";
export { useViewFromPath } from "./hooks/useViewFromPath";
export { useViewPersistence } from "./hooks/useViewPersistence";

// Utils
export {
  mapSSRViewToState,
  mapSavedViewToState,
  mapStateToSavedView,
  getViewSlug,
  isSameView,
} from "./utils/view-mapper";
export {
  createViewState,
  getGroupViewMode,
  createDefaultVisibility,
  createDefaultColumnOrder,
  DEFAULT_QUICK_FILTERS,
  DEFAULT_SORT_ORDERS,
} from "./utils/view-defaults";
