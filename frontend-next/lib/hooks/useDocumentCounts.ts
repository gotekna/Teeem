"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface DocumentCountsResponse {
  success: boolean;
  counts: Record<string, number>;
  parentCounts: Record<string, number>;
}

interface UseDocumentCountsOptions {
  linkableType: string;
  linkableId: number | string | undefined;
  scope: string;
  entityType?: string;
}

interface UseDocumentCountsReturn {
  counts: Record<string, number>;
  parentCounts: Record<string, number>;
  loading: boolean;
  refetch: () => void;
}

/**
 * Generic hook for fetching document counts per warehouse folder tab.
 * Works for any entity type (Property, Contact, CorporateCompany, etc.)
 *
 * Usage:
 * ```tsx
 * const { counts, parentCounts } = useDocumentCounts({
 *   linkableType: "Property",
 *   linkableId: id,
 *   scope: "property",
 * });
 * ```
 */
export function useDocumentCounts({
  linkableType,
  linkableId,
  scope,
  entityType,
}: UseDocumentCountsOptions): UseDocumentCountsReturn {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [parentCounts, setParentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!linkableId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        linkable_type: linkableType,
        linkable_id: String(linkableId),
        scope,
      });
      if (entityType) params.append("entity_type", entityType);

      const res = await api.get<DocumentCountsResponse>(
        `/api/v1/warehouse_types/document_counts?${params.toString()}`
      );

      if (res?.success) {
        setCounts(res.counts || {});
        setParentCounts(res.parentCounts || {});
      }
    } catch (err) {
      console.error("Failed to fetch document counts:", err);
    } finally {
      setLoading(false);
    }
  }, [linkableType, linkableId, scope, entityType]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { counts, parentCounts, loading, refetch: fetchCounts };
}
