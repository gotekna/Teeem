import { useState, useEffect } from "react";
import { api } from "@/lib/api";

/**
 * useDocumentTypes - THE ONE hook for fetching document types.
 *
 * SSoT: All document type fetching goes through this hook.
 * Uses ?for=select by default (1 query, ~20ms) instead of full
 * serialization (1081 queries, 1375ms, 32KB).
 *
 * @param options.scope - Filter by scope ("job", "company", "contacts", "library")
 * @param options.full  - Set true for full serialization (classification, admin pages only)
 * @param options.includeInactive - Include inactive document types (admin only)
 * @param options.skip  - Skip fetching (e.g., when external data is provided)
 */

export interface DocumentTypeSelect {
  id: number;
  name: string;
  display_name?: string | null;
  abbreviation?: string | null;
  scope?: string | null;
  folder?: string | null;
}

// Module-level cache: lightweight doc types rarely change within a session
let cachedSelectData: DocumentTypeSelect[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

interface UseDocumentTypesOptions {
  scope?: string;
  full?: boolean;
  includeInactive?: boolean;
  skip?: boolean;
}

interface UseDocumentTypesResult<T> {
  documentTypes: T[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDocumentTypes(
  options: UseDocumentTypesOptions & { full: true }
): UseDocumentTypesResult<Record<string, unknown>>;
export function useDocumentTypes(
  options?: UseDocumentTypesOptions
): UseDocumentTypesResult<DocumentTypeSelect>;
export function useDocumentTypes(
  options: UseDocumentTypesOptions = {}
): UseDocumentTypesResult<DocumentTypeSelect | Record<string, unknown>> {
  const { scope, full = false, includeInactive = false, skip = false } = options;
  const [data, setData] = useState<(DocumentTypeSelect | Record<string, unknown>)[]>([]);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }

    // Check module-level cache for lightweight fetches (no scope filter, no full)
    if (!full && !scope && !includeInactive && cachedSelectData && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      setData(cachedSelectData);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchDocumentTypes() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (!full) params.set("for", "select");
        if (scope) params.set("scope", scope);
        if (includeInactive) params.set("include_inactive", "true");

        const url = `/api/v1/document_types${params.toString() ? `?${params}` : ""}`;
        const response = await api.get<{ success: boolean; data: DocumentTypeSelect[] }>(url);

        if (!cancelled) {
          const result = response?.data || [];
          setData(result);

          // Cache lightweight, unfiltered results
          if (!full && !scope && !includeInactive) {
            cachedSelectData = result as DocumentTypeSelect[];
            cacheTimestamp = Date.now();
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load document types");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDocumentTypes();
    return () => { cancelled = true; };
  }, [scope, full, includeInactive, skip, refreshCount]);

  return {
    documentTypes: data,
    loading,
    error,
    refresh: () => setRefreshCount((c) => c + 1),
  };
}

/** Invalidate the module-level cache (call after create/update/delete) */
export function clearDocumentTypesCache() {
  cachedSelectData = null;
  cacheTimestamp = 0;
}
