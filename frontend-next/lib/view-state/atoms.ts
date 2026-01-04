/**
 * View State Atoms
 * Foundation-scoped atoms using atomFamily
 *
 * Each foundation (jobs, contacts, etc.) gets its own isolated atom instance.
 * This eliminates state pollution when navigating between pages.
 *
 * Usage:
 *   const [viewState, setViewState] = useAtom(viewStateFamily('jobs'));
 *   // Jobs and Contacts have completely separate state
 */

import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import { createDefaultViewState, type ViewState, type ViewStateUpdate } from "./types";

/**
 * Foundation-scoped view state atom
 *
 * Each foundation ID creates a separate atom instance with isolated state.
 * This is the core solution to the state pollution problem.
 */
export const viewStateFamily = atomFamily((foundationId: string) =>
  atom<ViewState>(createDefaultViewState())
);

/**
 * Derived atom for getting/setting specific view state fields
 * Useful for components that only need part of the state
 */
export const createViewStateFieldAtom = <K extends keyof ViewState>(
  foundationId: string,
  field: K
) =>
  atom(
    (get) => get(viewStateFamily(foundationId))[field],
    (get, set, value: ViewState[K]) => {
      const current = get(viewStateFamily(foundationId));
      set(viewStateFamily(foundationId), { ...current, [field]: value });
    }
  );

/**
 * Write-only atom for atomic view state updates
 * Applies partial updates to the view state
 */
export const updateViewStateFamily = atomFamily((foundationId: string) =>
  atom(null, (get, set, update: ViewStateUpdate) => {
    const current = get(viewStateFamily(foundationId));
    set(viewStateFamily(foundationId), { ...current, ...update });
  })
);

/**
 * Write-only atom for resetting view state to defaults
 */
export const resetViewStateFamily = atomFamily((foundationId: string) =>
  atom(null, (_get, set) => {
    set(viewStateFamily(foundationId), createDefaultViewState());
  })
);

/**
 * Atom for tracking collapsed groups per foundation
 * Separated because Set needs special handling for reactivity
 */
export const collapsedGroupsFamily = atomFamily((_foundationId: string) =>
  atom<Set<string>>(new Set<string>())
);

/**
 * Write-only atom for toggling a group's collapsed state
 */
export const toggleCollapsedGroupFamily = atomFamily((foundationId: string) =>
  atom(null, (get, set, groupKey: string) => {
    const current = get(collapsedGroupsFamily(foundationId));
    const next = new Set(current);
    if (next.has(groupKey)) {
      next.delete(groupKey);
    } else {
      next.add(groupKey);
    }
    set(collapsedGroupsFamily(foundationId), next);
  })
);

/**
 * Write-only atom for setting all collapsed groups at once
 */
export const setCollapsedGroupsFamily = atomFamily((foundationId: string) =>
  atom(null, (_get, set, groups: Set<string> | string[]) => {
    set(
      collapsedGroupsFamily(foundationId),
      groups instanceof Set ? groups : new Set(groups)
    );
  })
);

/**
 * Write-only atom for clearing all collapsed groups
 */
export const clearCollapsedGroupsFamily = atomFamily((foundationId: string) =>
  atom(null, (_get, set) => {
    set(collapsedGroupsFamily(foundationId), new Set());
  })
);
