'use client';

import { useFoundationBySlug } from './useFoundationBySlug';
import type { UseFoundationBySlugReturn } from './useFoundationBySlug';

/**
 * Hook for loading foundation data by ID
 * This is a convenience wrapper around useFoundationBySlug since the API accepts both
 *
 * @param foundationId - The foundation ID (e.g., 214 for Contacts)
 * @param options - Additional options for data loading
 */
export function useFoundationById(
  foundationId: number | null,
  options: {
    perPage?: number;
    autoLoad?: boolean;
  } = {}
): UseFoundationBySlugReturn {
  // Convert ID to string for the slug-based hook (API accepts both)
  const slug = foundationId ? String(foundationId) : null;
  return useFoundationBySlug(slug, options);
}

export default useFoundationById;
