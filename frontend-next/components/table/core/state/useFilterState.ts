/**
 * Filter State Hook
 *
 * Consolidates all filter-related state management:
 * - Cascade filters (column, operator, value)
 * - Filter groups (multiple filter sets)
 * - Inter-group logic (AND/OR between groups)
 * - Show/hide filters UI toggle
 *
 * Wraps Jotai atoms for cleaner component code.
 */

import { useAtom } from 'jotai';
import {
  currentFiltersAtom,
  currentFilterGroupsAtom,
  currentInterGroupLogicAtom,
  showFiltersAtom,
} from '@/lib/table-atoms';

export interface CascadeFilter {
  id: string | number;
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty';
  value: unknown;
}

export interface FilterGroup {
  id: string | number;
  name: string;
  filters: CascadeFilter[];
  logic: 'AND' | 'OR';
}

export interface FilterState {
  // Legacy cascade filters (deprecated, but still used in some places)
  cascadeFilters: CascadeFilter[];
  setCascadeFilters: (value: CascadeFilter[]) => void;

  // Filter groups (new system)
  filterGroups: FilterGroup[];
  setFilterGroups: (value: FilterGroup[]) => void;

  // Inter-group logic (AND/OR between groups)
  interGroupLogic: 'AND' | 'OR';
  setInterGroupLogic: (value: 'AND' | 'OR') => void;

  // UI toggle
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;
}

/**
 * Hook for managing filter state
 *
 * @returns Filter state and setters
 */
export function useFilterState(): FilterState {
  const [cascadeFilters, setCascadeFilters] = useAtom(currentFiltersAtom);
  const [filterGroups, setFilterGroups] = useAtom(currentFilterGroupsAtom);
  const [interGroupLogic, setInterGroupLogic] = useAtom(currentInterGroupLogicAtom);
  const [showFilters, setShowFilters] = useAtom(showFiltersAtom);

  return {
    cascadeFilters,
    setCascadeFilters,
    filterGroups,
    setFilterGroups,
    interGroupLogic,
    setInterGroupLogic,
    showFilters,
    setShowFilters,
  };
}
