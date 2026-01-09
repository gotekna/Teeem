/**
 * Foundation Columns Hook
 *
 * Auto-fetches columns from Foundation API with:
 * - SSR hydration support (initialColumns)
 * - Module-level caching for instant loading
 * - SSoT violation detection
 *
 * Phase 8 of TeeemTableView refactoring.
 */

import { useState, useEffect } from 'react';
import {
  getCachedColumns,
  invalidateColumnsCache,
  fetchColumnsForFoundation,
} from '../utils/columns-cache';
import type { TableColumn } from '../types';

export interface FoundationInfo {
  id: number;
  slug: string;
}

export interface UseFoundationColumnsOptions {
  /** Foundation ID/slug (can be number or string) */
  foundationId: string | number | null | undefined;
  /** SSR-provided initial columns (for hydration) */
  initialColumns?: TableColumn[] | null;
  /** Prop columns for SSoT violation detection */
  propColumns?: TableColumn[] | null;
}

export interface UseFoundationColumnsReturn {
  /** Fetched columns (or initialColumns if provided) */
  columns: TableColumn[] | null;
  /** Whether columns are loading */
  isLoading: boolean;
  /** Resolved foundation info (id and slug) */
  foundationInfo: FoundationInfo | null;
}

export function useFoundationColumns(
  options: UseFoundationColumnsOptions
): UseFoundationColumnsReturn {
  const { foundationId, initialColumns, propColumns } = options;

  // CLS FIX: Initialize from SSR data immediately (not via useEffect)
  const [columns, setColumns] = useState<TableColumn[] | null>(
    initialColumns || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [foundationInfo, setFoundationInfo] = useState<FoundationInfo | null>(null);

  useEffect(() => {
    // SSR: Skip client fetch if server provided columns
    if (initialColumns && initialColumns.length > 0) {
      setColumns(initialColumns);
      setIsLoading(false);
      return;
    }

    if (!foundationId) {
      setColumns(null);
      setFoundationInfo(null);
      return;
    }

    // ULTRA: Check cache first for instant loading
    const cached = getCachedColumns(foundationId);
    if (cached) {
      setColumns(cached.columns);
      setFoundationInfo(cached.foundationInfo);
      setIsLoading(false);
      return;
    }

    const fetchColumns = async () => {
      setIsLoading(true);
      try {
        const result = await fetchColumnsForFoundation(foundationId);

        if (result) {
          setColumns(result.columns);
          setFoundationInfo(result.foundationInfo);

          // SSoT VIOLATION: Alert if parent passed hardcoded columns when Foundation exists
          if (propColumns && propColumns.length > 0 && result.columns.length > 0) {
            const propKeys = propColumns
              .filter(c => !['select', 'actions'].includes(c.key))
              .map(c => c.key);
            const foundationKeys = result.columns
              .filter(c => !['select', 'actions'].includes(c.key))
              .map(c => c.key);

            if (propKeys.length !== foundationKeys.length) {
              const inPropsNotFoundation = propKeys.filter(
                k => !foundationKeys.includes(k)
              );
              const inFoundationNotProps = foundationKeys.filter(
                k => !propKeys.includes(k)
              );

              const errorMessage =
                `[useFoundationColumns] SSoT VIOLATION: columns prop has ${propKeys.length} columns, ` +
                `but Foundation ${foundationId} has ${foundationKeys.length} columns.\n` +
                `In PROPS but not Foundation: ${inPropsNotFoundation.join(', ') || 'none'}\n` +
                `In FOUNDATION but not Props: ${inFoundationNotProps.join(', ') || 'none'}\n` +
                `FIX: Remove the columns prop - TeeemTableView auto-fetches from Foundation API (SSoT)`;

              if (process.env.NODE_ENV === 'development') {
                throw new Error(errorMessage);
              } else {
                console.error(errorMessage);
              }
            }
          }
        } else {
          // Fetch failed - clean up stale caches
          invalidateColumnsCache(foundationId);

          // Clean up localStorage views cache
          try {
            const viewsCacheKey = 'teeem_views_cache';
            const viewsCache = localStorage.getItem(viewsCacheKey);
            if (viewsCache) {
              const parsed = JSON.parse(viewsCache);
              if (parsed[foundationId]) {
                delete parsed[foundationId];
                localStorage.setItem(viewsCacheKey, JSON.stringify(parsed));
              }
            }
          } catch {
            // Ignore cache cleanup errors
          }

          // Clean up sessionStorage table state
          try {
            const sessionKey = `teeem-table-state-v1-${foundationId}`;
            sessionStorage.removeItem(sessionKey);
          } catch {
            // Ignore cache cleanup errors
          }

          setColumns(null);
        }
      } catch (error) {
        console.error(
          `[useFoundationColumns] Failed to fetch columns for Foundation ${foundationId}:`,
          error
        );
        setColumns(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchColumns();
  }, [foundationId, propColumns, initialColumns]);

  return {
    columns,
    isLoading,
    foundationInfo,
  };
}
