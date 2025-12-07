/**
 * React hook for entity types
 *
 * Usage:
 * const { entityTypes, metadata, loading, error } = useEntityTypes();
 *
 * // Get only types shown in create form
 * const createFormTypes = metadata.filter(m => m.show_in_create_form);
 */

import { useState, useEffect } from "react";
import {
  fetchEntityTypes,
  EntityTypeMetadata,
  EntityTypesResponse
} from "@/lib/entity-types";

interface UseEntityTypesResult {
  /** Array of entity type values: ["person", "company", "trust", "sole_trader", "price_only"] */
  entityTypes: string[];
  /** Full metadata for each entity type */
  metadata: EntityTypeMetadata[];
  /** Types that should be shown in create forms (excludes price_only) */
  createFormTypes: EntityTypeMetadata[];
  /** Loading state */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh the entity types from API */
  refresh: () => Promise<void>;
}

export function useEntityTypes(): UseEntityTypesResult {
  const [data, setData] = useState<EntityTypesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEntityTypes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchEntityTypes();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entity types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntityTypes();
  }, []);

  const entityTypes = data?.entity_types || [];
  const metadata = data?.metadata || [];
  const createFormTypes = metadata.filter(m => m.show_in_create_form);

  return {
    entityTypes,
    metadata,
    createFormTypes,
    loading,
    error,
    refresh: loadEntityTypes
  };
}
