"use client";

import { useState, useCallback, useMemo } from "react";
import type { DateRange } from "react-day-picker";

export interface EmailFilters {
  /** Text search query */
  search: string;
  /** Filter by email address (from/to/cc) */
  email: string;
  /** Date range filter */
  dateRange: DateRange | undefined;
  /** Only show emails with attachments */
  hasAttachments: boolean;
  /** Only show unassigned emails */
  unassigned: boolean;
  /** Only show unread emails */
  unread: boolean;
}

export interface UseEmailFiltersReturn {
  /** Current filter values */
  filters: EmailFilters;
  /** Update a single filter */
  setFilter: <K extends keyof EmailFilters>(key: K, value: EmailFilters[K]) => void;
  /** Update search text */
  setSearch: (search: string) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Check if any filters are active (excluding search) */
  hasActiveFilters: boolean;
  /** Count of active filters (excluding search) */
  activeFilterCount: number;
  /** Build URL params from filters */
  toURLParams: () => URLSearchParams;
  /** Get active filter labels for display */
  getActiveFilterLabels: () => string[];
}

const DEFAULT_FILTERS: EmailFilters = {
  search: "",
  email: "",
  dateRange: undefined,
  hasAttachments: false,
  unassigned: false,
  unread: false,
};

/**
 * Hook for managing email search filters
 *
 * Usage:
 * const { filters, setFilter, clearFilters, toURLParams } = useEmailFilters();
 *
 * // Apply filters to API call
 * const params = toURLParams();
 * params.append("my_emails", "true");
 * const response = await api.get(`/api/v1/email_warehouse?${params.toString()}`);
 */
export function useEmailFilters(): UseEmailFiltersReturn {
  const [filters, setFilters] = useState<EmailFilters>(DEFAULT_FILTERS);

  const setFilter = useCallback(<K extends keyof EmailFilters>(
    key: K,
    value: EmailFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.email !== "" ||
      filters.dateRange !== undefined ||
      filters.hasAttachments ||
      filters.unassigned ||
      filters.unread
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.email) count++;
    if (filters.dateRange?.from || filters.dateRange?.to) count++;
    if (filters.hasAttachments) count++;
    if (filters.unassigned) count++;
    if (filters.unread) count++;
    return count;
  }, [filters]);

  const toURLParams = useCallback((): URLSearchParams => {
    const params = new URLSearchParams();

    if (filters.search) {
      params.append("search", filters.search);
    }

    if (filters.email) {
      params.append("email", filters.email);
    }

    if (filters.dateRange?.from) {
      params.append("since", filters.dateRange.from.toISOString());
    }

    if (filters.dateRange?.to) {
      params.append("until", filters.dateRange.to.toISOString());
    }

    if (filters.hasAttachments) {
      params.append("has_attachments", "true");
    }

    if (filters.unassigned) {
      params.append("unassigned", "true");
    }

    if (filters.unread) {
      params.append("unread", "true");
    }

    return params;
  }, [filters]);

  const getActiveFilterLabels = useCallback((): string[] => {
    const labels: string[] = [];

    if (filters.email) {
      labels.push(`From/To: ${filters.email}`);
    }

    if (filters.dateRange?.from && filters.dateRange?.to) {
      const from = filters.dateRange.from.toLocaleDateString();
      const to = filters.dateRange.to.toLocaleDateString();
      labels.push(`${from} - ${to}`);
    } else if (filters.dateRange?.from) {
      labels.push(`After ${filters.dateRange.from.toLocaleDateString()}`);
    } else if (filters.dateRange?.to) {
      labels.push(`Before ${filters.dateRange.to.toLocaleDateString()}`);
    }

    if (filters.hasAttachments) {
      labels.push("Has attachments");
    }

    if (filters.unassigned) {
      labels.push("Unassigned");
    }

    if (filters.unread) {
      labels.push("Unread");
    }

    return labels;
  }, [filters]);

  return {
    filters,
    setFilter,
    setSearch,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    toURLParams,
    getActiveFilterLabels,
  };
}

export default useEmailFilters;
