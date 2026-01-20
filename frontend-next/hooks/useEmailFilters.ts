"use client";

import { useState, useCallback, useMemo } from "react";
import type { DateRange } from "react-day-picker";

export type EmailDirection = "" | "sent" | "received" | "cc" | "bcc";
export type EmailImportance = "" | "high" | "normal" | "low";

export interface EmailFilters {
  /** Text search query (may contain operators like from:, to:, subject:) */
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
  /** Filter by direction (sent/received/cc/bcc) */
  direction: EmailDirection;
  /** Filter by importance (high/normal/low) */
  importance: EmailImportance;
}

/**
 * Parsed search operators from the search query
 */
export interface ParsedOperators {
  /** from: operator - filter by sender */
  from?: string;
  /** to: operator - filter by recipient */
  to?: string;
  /** subject: operator - filter by subject line */
  subject?: string;
  /** has:attachment - filter emails with attachments */
  hasAttachment?: boolean;
  /** is:unread - filter unread emails */
  isUnread?: boolean;
  /** is:starred - filter starred emails */
  isStarred?: boolean;
  /** before: operator - emails before date */
  before?: string;
  /** after: operator - emails after date */
  after?: string;
  /** Remaining text after operators are extracted */
  textQuery: string;
}

/**
 * Parse Gmail-style search operators from a search query
 *
 * Supported operators:
 * - from:email@example.com - Filter by sender
 * - to:email@example.com - Filter by recipient
 * - subject:keyword or subject:"multi word" - Filter by subject
 * - has:attachment - Only emails with attachments
 * - is:unread - Only unread emails
 * - is:starred - Only starred emails
 * - before:2024-01-01 - Emails before date
 * - after:2024-01-01 - Emails after date
 *
 * Example: "from:john@example.com subject:invoice has:attachment important meeting"
 * Returns: { from: "john@example.com", subject: "invoice", hasAttachment: true, textQuery: "important meeting" }
 */
export function parseSearchOperators(query: string): ParsedOperators {
  const result: ParsedOperators = {
    textQuery: query,
  };

  if (!query) return result;

  let remaining = query;

  // Patterns for each operator
  const patterns: Array<{
    key: keyof ParsedOperators;
    regex: RegExp;
    transform?: (match: string) => unknown;
  }> = [
    // from:email
    { key: "from", regex: /from:(\S+)/i },
    // to:email
    { key: "to", regex: /to:(\S+)/i },
    // subject:"multi word" or subject:word
    { key: "subject", regex: /subject:"([^"]+)"|subject:(\S+)/i },
    // has:attachment or has:attachments
    {
      key: "hasAttachment",
      regex: /has:attachments?/i,
      transform: () => true,
    },
    // is:unread
    {
      key: "isUnread",
      regex: /is:unread/i,
      transform: () => true,
    },
    // is:starred
    {
      key: "isStarred",
      regex: /is:starred/i,
      transform: () => true,
    },
    // before:YYYY-MM-DD
    { key: "before", regex: /before:(\S+)/i },
    // after:YYYY-MM-DD
    { key: "after", regex: /after:(\S+)/i },
  ];

  for (const { key, regex, transform } of patterns) {
    const match = remaining.match(regex);
    if (match) {
      // Get the captured value (handle quoted strings)
      const value = match[1] || match[2] || match[0];
      const transformedValue = transform ? transform(value) : value;

      // Type-safe assignment based on key
      switch (key) {
        case "from":
        case "to":
        case "subject":
        case "before":
        case "after":
          result[key] = transformedValue as string;
          break;
        case "hasAttachment":
        case "isUnread":
        case "isStarred":
          result[key] = transformedValue as boolean;
          break;
      }

      // Remove the matched operator from the remaining string
      remaining = remaining.replace(regex, "").trim();
    }
  }

  // Clean up multiple spaces
  result.textQuery = remaining.replace(/\s+/g, " ").trim();

  return result;
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
  direction: "",
  importance: "",
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
 * const response = await api.get(`/api/v1/synced_email?${params.toString()}`);
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
      filters.unread ||
      filters.direction !== "" ||
      filters.importance !== ""
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.email) count++;
    if (filters.dateRange?.from || filters.dateRange?.to) count++;
    if (filters.hasAttachments) count++;
    if (filters.unassigned) count++;
    if (filters.unread) count++;
    if (filters.direction) count++;
    if (filters.importance) count++;
    return count;
  }, [filters]);

  const toURLParams = useCallback((): URLSearchParams => {
    const params = new URLSearchParams();

    // Parse search operators from the search string
    if (filters.search) {
      const parsed = parseSearchOperators(filters.search);

      // Send the remaining text query (after operators extracted)
      if (parsed.textQuery) {
        params.append("search", parsed.textQuery);
      }

      // Send parsed operators as separate params
      if (parsed.from) {
        params.append("from", parsed.from);
      }
      if (parsed.to) {
        params.append("to", parsed.to);
      }
      if (parsed.subject) {
        params.append("subject", parsed.subject);
      }
      if (parsed.hasAttachment) {
        params.append("has_attachments", "true");
      }
      if (parsed.isUnread) {
        params.append("unread", "true");
      }
      if (parsed.isStarred) {
        params.append("starred", "true");
      }
      // Date operators override the dateRange filter
      if (parsed.after) {
        params.append("since", new Date(parsed.after).toISOString());
      }
      if (parsed.before) {
        params.append("until", new Date(parsed.before).toISOString());
      }
    }

    if (filters.email) {
      params.append("email", filters.email);
    }

    // Only add date range if not overridden by search operators
    if (filters.dateRange?.from && !filters.search.includes("after:")) {
      params.append("since", filters.dateRange.from.toISOString());
    }

    if (filters.dateRange?.to && !filters.search.includes("before:")) {
      params.append("until", filters.dateRange.to.toISOString());
    }

    // Only add hasAttachments if not set by search operator
    if (filters.hasAttachments && !filters.search.toLowerCase().includes("has:attachment")) {
      params.append("has_attachments", "true");
    }

    if (filters.unassigned) {
      params.append("unassigned", "true");
    }

    // Only add unread if not set by search operator
    if (filters.unread && !filters.search.toLowerCase().includes("is:unread")) {
      params.append("unread", "true");
    }

    // Direction filter
    if (filters.direction) {
      params.append("direction", filters.direction);
    }

    // Importance filter
    if (filters.importance) {
      params.append("importance", filters.importance);
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

    if (filters.direction) {
      const directionLabels: Record<string, string> = {
        sent: "Sent",
        received: "Received",
        cc: "CC'd",
        bcc: "BCC'd",
      };
      labels.push(directionLabels[filters.direction] || filters.direction);
    }

    if (filters.importance) {
      const importanceLabels: Record<string, string> = {
        high: "High importance",
        normal: "Normal importance",
        low: "Low importance",
      };
      labels.push(importanceLabels[filters.importance] || filters.importance);
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
