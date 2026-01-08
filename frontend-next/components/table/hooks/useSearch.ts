/**
 * Search Feature Hook
 *
 * Complete search feature following the Feature Hook pattern:
 * - state: Current search configuration
 * - actions: Imperative methods to modify search
 * - apply: Pure function to search rows using headless core
 *
 * Supports multiple search modes: contains, exact, starts_with, fuzzy, regex.
 *
 * @example
 * const search = useSearch();
 * const searchedRows = search.apply(rows, columns);
 * search.actions.setQuery('john');
 * search.actions.setMode('fuzzy');
 */

import { useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import {
  searchQueryAtom,
  searchAllColumnsAtom,
  searchModeAtom,
  searchableColumnsAtom,
} from '@/lib/table-atoms';
import { searchRows, type SearchMode } from '@/lib/table-core';
import type { TableColumn } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchState {
  /** Current search query */
  query: string;
  /** Whether to search all columns */
  searchAllColumns: boolean;
  /** Search mode */
  mode: SearchMode;
  /** Columns marked as searchable */
  searchableColumns: Record<string, boolean>;
  /** Whether search is active */
  isSearching: boolean;
}

export interface SearchActions {
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Clear the search query */
  clearQuery: () => void;
  /** Toggle search all columns */
  toggleSearchAllColumns: () => void;
  /** Set search all columns */
  setSearchAllColumns: (value: boolean) => void;
  /** Set search mode */
  setMode: (mode: SearchMode) => void;
  /** Set which columns are searchable */
  setSearchableColumns: (columns: Record<string, boolean>) => void;
  /** Mark a column as searchable */
  markColumnSearchable: (columnKey: string, searchable: boolean) => void;
}

export interface UseSearchReturn {
  state: SearchState;
  actions: SearchActions;
  /** Apply search to rows (pure function from headless core) */
  apply: <TRow extends Record<string, unknown>>(
    rows: TRow[],
    columns: TableColumn[]
  ) => TRow[];
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Feature hook for table search
 *
 * Provides complete search functionality with multiple modes.
 * Uses the headless core for pure data processing.
 */
export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [searchAllColumns, setSearchAllColumns] = useAtom(searchAllColumnsAtom);
  const [mode, setMode] = useAtom(searchModeAtom);
  const [searchableColumns, setSearchableColumns] = useAtom(searchableColumnsAtom);

  // ============================================================================
  // STATE
  // ============================================================================

  const state = useMemo<SearchState>(() => ({
    query,
    searchAllColumns,
    mode,
    searchableColumns,
    isSearching: query.length > 0,
  }), [query, searchAllColumns, mode, searchableColumns]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const clearQuery = useCallback(() => {
    setQuery('');
  }, [setQuery]);

  const toggleSearchAllColumns = useCallback(() => {
    setSearchAllColumns((prev) => !prev);
  }, [setSearchAllColumns]);

  const markColumnSearchable = useCallback((columnKey: string, searchable: boolean) => {
    setSearchableColumns((prev: Record<string, boolean>) => ({
      ...prev,
      [columnKey]: searchable,
    }));
  }, [setSearchableColumns]);

  const actions = useMemo<SearchActions>(() => ({
    setQuery,
    clearQuery,
    toggleSearchAllColumns,
    setSearchAllColumns,
    setMode,
    setSearchableColumns,
    markColumnSearchable,
  }), [
    setQuery,
    clearQuery,
    toggleSearchAllColumns,
    setSearchAllColumns,
    setMode,
    setSearchableColumns,
    markColumnSearchable,
  ]);

  // ============================================================================
  // APPLY (data transformation using headless core)
  // ============================================================================

  const apply = useCallback(<TRow extends Record<string, unknown>>(
    rows: TRow[],
    columns: TableColumn[]
  ): TRow[] => {
    if (!query) return rows;

    return searchRows(rows, {
      search: query,
      searchMode: mode,
      columns: columns.map((c) => ({ key: c.key, column_type: c.column_type })),
      searchableColumns,
      searchAllColumns,
    });
  }, [query, mode, searchableColumns, searchAllColumns]);

  return {
    state,
    actions,
    apply,
  };
}

// ============================================================================
// SELECTOR HELPERS
// ============================================================================

/**
 * Get display label for search mode
 */
export function getSearchModeLabel(mode: SearchMode): string {
  switch (mode) {
    case 'contains':
      return 'Contains';
    case 'exact':
      return 'Exact Match';
    case 'starts_with':
      return 'Starts With';
    case 'fuzzy':
      return 'Fuzzy Search';
    case 'regex':
      return 'Regex';
    default:
      return 'Contains';
  }
}

/**
 * Get all available search modes
 */
export function getSearchModes(): { value: SearchMode; label: string }[] {
  return [
    { value: 'contains', label: 'Contains' },
    { value: 'exact', label: 'Exact Match' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'fuzzy', label: 'Fuzzy Search' },
    { value: 'regex', label: 'Regex' },
  ];
}
