"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type {
  WarehouseFolder,
  WarehouseFolderScope,
  WarehouseFoldersResponse,
  WarehouseFolderResponse,
  WarehouseFolderCreateParams,
  WarehouseFolderUpdateParams,
  ReorderTabParams,
  TabGroup,
} from "@/lib/types/warehouse-folders";

// =============================================================================
// REQUEST DEDUPLICATION - Prevents duplicate API calls that cause screen flashing
// =============================================================================
// Problem: Multiple components calling useWarehouseFolders({ scope: "job" }) each make
// their own API call, causing multiple loading -> loaded cycles (flashing).
// Solution: Cache in-flight requests and recent responses at module level.
// =============================================================================

interface CachedResponse {
  tabs: WarehouseFolder[];
  groups: TabGroup[];
  primaryXeroName: string | null;
  timestamp: number;
}

// Module-level cache for request deduplication
interface CachedRequest {
  promise: Promise<WarehouseFoldersResponse>;
  timestamp: number;
}
const requestCache = new Map<string, CachedRequest>();
const responseCache = new Map<string, CachedResponse>();
const CACHE_TTL_MS = 5000; // Cache responses for 5 seconds
const REQUEST_CACHE_TTL_MS = 30000; // Max 30 seconds for in-flight requests

function getCacheKey(
  scope: WarehouseFolderScope,
  entityType?: string,
  tabGroup?: TabGroup,
  includeDisabled?: boolean
): string {
  return `${scope}:${entityType || ""}:${tabGroup || ""}:${includeDisabled || false}`;
}

function getCachedResponse(key: string): CachedResponse | null {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached;
  }
  // Expired - clean up
  responseCache.delete(key);
  return null;
}

function invalidateCache(key: string): void {
  responseCache.delete(key);
  requestCache.delete(key);
}

interface UseWarehouseFoldersOptions {
  scope: WarehouseFolderScope;
  entityType?: string; // For filtering corporate tabs by Company, Trust, etc.
  tabGroup?: TabGroup; // Filter by group
  includeDisabled?: boolean; // Include disabled tabs (for admin views)
}

interface UseWarehouseFoldersReturn {
  tabs: WarehouseFolder[];
  groups: TabGroup[];
  loading: boolean;
  error: string | null;
  // SSoT: Primary Xero account name (from XeroCredential.is_primary)
  primaryXeroName: string | null;
  // CRUD operations
  createTab: (params: WarehouseFolderCreateParams) => Promise<WarehouseFolder>;
  updateTab: (id: number, params: WarehouseFolderUpdateParams) => Promise<WarehouseFolder>;
  deleteTab: (id: number) => Promise<void>;
  // Specialized operations
  reorderTabs: (items: ReorderTabParams[], optimisticTabs?: WarehouseFolder[]) => Promise<void>;
  toggleEnabled: (id: number) => Promise<WarehouseFolder>;
  // Refresh
  refetch: () => Promise<void>;
}

export function useWarehouseFolders(options: UseWarehouseFoldersOptions): UseWarehouseFoldersReturn {
  const { scope, entityType, tabGroup, includeDisabled } = options;
  const cacheKey = getCacheKey(scope, entityType, tabGroup, includeDisabled);

  // Initialize from cache if available (prevents flash on mount)
  const cachedInitial = getCachedResponse(cacheKey);
  const [tabs, setTabs] = React.useState<WarehouseFolder[]>(cachedInitial?.tabs || []);
  const [groups, setGroups] = React.useState<TabGroup[]>(cachedInitial?.groups || []);
  const [loading, setLoading] = React.useState(!cachedInitial);
  const [error, setError] = React.useState<string | null>(null);
  // SSoT: Primary Xero account name (also cached)
  const [primaryXeroName, setPrimaryXeroName] = React.useState<string | null>(cachedInitial?.primaryXeroName || null);

  const fetchTabs = React.useCallback(async (forceRefresh = false) => {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCachedResponse(cacheKey);
      if (cached) {
        setTabs(cached.tabs);
        setGroups(cached.groups);
        setPrimaryXeroName(cached.primaryXeroName);
        setLoading(false);
        return;
      }
    }

    try {
      // Only show loading if we don't have data yet
      if (tabs.length === 0) {
        setLoading(true);
      }
      setError(null);

      // Build query params
      const params = new URLSearchParams({ scope });
      if (entityType) params.append("entity_type", entityType);
      if (tabGroup) params.append("tab_group", tabGroup);
      if (includeDisabled) params.append("include_disabled", "true");

      const url = `/api/v1/warehouse_folders?${params.toString()}`;

      // Deduplicate in-flight requests - if same request is already in progress, reuse it
      // Clear stale cache entries to prevent hanging on dead promises
      const now = Date.now();
      const cachedRequest = requestCache.get(cacheKey);

      if (cachedRequest && now - cachedRequest.timestamp > REQUEST_CACHE_TTL_MS) {
        console.warn(`Clearing stale warehouse folders request cache for ${cacheKey}`);
        requestCache.delete(cacheKey);
      }

      let requestPromise: Promise<WarehouseFoldersResponse>;
      const freshCached = requestCache.get(cacheKey);

      if (freshCached && !forceRefresh) {
        requestPromise = freshCached.promise;
      } else {
        requestPromise = api.get<WarehouseFoldersResponse>(url);
        requestCache.set(cacheKey, { promise: requestPromise, timestamp: now });
      }

      const response = await requestPromise;

      // Clean up in-flight cache
      requestCache.delete(cacheKey);

      if (response?.success) {
        const xeroName = response.data.primary_xero_name || null;
        // Cache the response (including primaryXeroName)
        responseCache.set(cacheKey, {
          tabs: response.data.tabs,
          groups: response.data.groups,
          primaryXeroName: xeroName,
          timestamp: Date.now(),
        });
        setTabs(response.data.tabs);
        setGroups(response.data.groups);
        // SSoT: Primary Xero account name
        setPrimaryXeroName(xeroName);
      } else {
        setError("Failed to load tabs");
      }
    } catch (err) {
      requestCache.delete(cacheKey);
      setError("Failed to load tab configuration");
      console.error("Failed to fetch warehouse folders:", err);
    } finally {
      setLoading(false);
    }
  }, [scope, entityType, tabGroup, includeDisabled, cacheKey, tabs.length]);

  React.useEffect(() => {
    fetchTabs();
  }, [fetchTabs]);

  const createTab = async (params: WarehouseFolderCreateParams): Promise<WarehouseFolder> => {
    try {
      const response = await api.post<WarehouseFolderResponse>("/api/v1/warehouse_folders", {
        warehouse_folder: { ...params, scope },
      });

      if (response?.success) {
        invalidateCache(cacheKey);
        await fetchTabs(true);
        return response.data;
      }
      throw new Error("Failed to create tab");
    } catch (err) {
      console.error("Failed to create tab:", err);
      throw err;
    }
  };

  const updateTab = async (
    id: number,
    params: WarehouseFolderUpdateParams
  ): Promise<WarehouseFolder> => {
    try {
      const response = await api.patch<WarehouseFolderResponse>(`/api/v1/warehouse_folders/${id}`, {
        warehouse_folder: params,
      });

      if (response?.success) {
        invalidateCache(cacheKey);
        await fetchTabs(true);
        return response.data;
      }
      throw new Error("Failed to update tab");
    } catch (err) {
      console.error("Failed to update tab:", err);
      throw err;
    }
  };

  const deleteTab = async (id: number): Promise<void> => {
    try {
      const response = await api.delete<{ success: boolean; error?: string }>(
        `/api/v1/warehouse_folders/${id}`
      );

      if (!response?.success) {
        throw new Error(response?.error || "Failed to delete tab");
      }
      invalidateCache(cacheKey);
      await fetchTabs(true);
    } catch (err) {
      console.error("Failed to delete tab:", err);
      throw err;
    }
  };

  const reorderTabs = async (items: ReorderTabParams[], optimisticTabs?: WarehouseFolder[]): Promise<void> => {
    // Optimistic update - immediately show new order to prevent jitter
    if (optimisticTabs) {
      setTabs(optimisticTabs);
    }

    try {
      await api.post("/api/v1/warehouse_folders/reorder", { tabs: items });
      invalidateCache(cacheKey);
      await fetchTabs(true); // Confirm with server data
    } catch (err) {
      console.error("Failed to reorder tabs:", err);
      // Revert on error by refetching
      invalidateCache(cacheKey);
      await fetchTabs(true);
      throw err;
    }
  };

  const toggleEnabled = async (id: number): Promise<WarehouseFolder> => {
    try {
      const response = await api.post<WarehouseFolderResponse>(
        `/api/v1/warehouse_folders/${id}/toggle`
      );

      if (response?.success) {
        invalidateCache(cacheKey);
        await fetchTabs(true);
        return response.data;
      }
      throw new Error("Failed to toggle tab");
    } catch (err) {
      console.error("Failed to toggle tab visibility:", err);
      throw err;
    }
  };

  // Force refresh bypasses cache
  const refetch = React.useCallback(async () => {
    invalidateCache(cacheKey);
    await fetchTabs(true);
  }, [cacheKey, fetchTabs]);

  return {
    tabs,
    groups,
    loading,
    error,
    primaryXeroName,
    createTab,
    updateTab,
    deleteTab,
    reorderTabs,
    toggleEnabled,
    refetch,
  };
}

// Backwards compatibility alias
export const useEntityTabs = useWarehouseFolders;

// Re-export types for convenience
export type { UseWarehouseFoldersOptions, UseWarehouseFoldersReturn };

// Backwards compatibility type aliases
export type UseEntityTabsOptions = UseWarehouseFoldersOptions;
export type UseEntityTabsReturn = UseWarehouseFoldersReturn;
