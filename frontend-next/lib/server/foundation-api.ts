/**
 * Server-side Foundation Data Fetching
 *
 * These functions run on the server during SSR/RSC and fetch data
 * before the page is sent to the client. This eliminates the white
 * screen flash that occurs with client-only data fetching.
 */

import { cookies } from 'next/headers';
import { getApiBaseUrl } from '@/lib/api';
import { isHiddenSystemColumn, isVisibleSystemColumn } from '@/lib/constants/system-columns';

const API_BASE_URL = getApiBaseUrl();

interface ApiColumn {
  id: number;
  foundation_id?: number;
  column_name: string;
  name: string;
  column_type: string;
  description?: string;
  available_choices?: string[];
  lookup_foundation_id?: number;
  lookup_display_column?: string;
  required?: boolean;
  is_unique?: boolean;
}

interface Foundation {
  id: number;
  name: string;
  slug: string;
  columns: ApiColumn[];
}

interface TableColumn {
  id?: number;
  foundation_id?: number;
  key: string;
  label: string;
  column_type?: string;
  resizable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
  choices?: string[];
  lookup_foundation_id?: number;
  lookup_display_column?: string;
  system?: boolean;
  editable?: boolean;
}

interface TableRow {
  id: number | string;
  [key: string]: unknown;
}

interface FoundationData {
  foundation: Foundation | null;
  columns: TableColumn[];
  records: TableRow[];
  totalCount: number | null;
  hasMore: boolean;
  error: string | null;
}

// SSoT: System columns defined in @/lib/constants/system-columns.ts
// Per GOLD_STANDARD_TABLE.md: System columns MUST be visible with yellow highlight

/**
 * Get auth token from cookies for server-side requests
 */
async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || null;
  console.log('[SSR] getAuthToken:', token ? `token found (${token.substring(0, 20)}...)` : 'no token');
  return token;
}

/**
 * Fetch foundation data by slug on the server
 * This runs during SSR and provides initial data to components
 */
export async function fetchFoundationBySlug(slug: string): Promise<FoundationData> {
  console.log('[SSR] fetchFoundationBySlug starting for:', slug);
  const token = await getAuthToken();

  if (!token) {
    console.log('[SSR] No auth token - returning empty data');
    return {
      foundation: null,
      columns: [],
      records: [],
      totalCount: null,
      hasMore: false,
      error: 'Not authenticated',
    };
  }

  try {
    // Fetch foundation metadata
    const foundationRes = await fetch(`${API_BASE_URL}/api/v1/foundations/${slug}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable caching - always fetch fresh data
    });

    if (!foundationRes.ok) {
      throw new Error(`Failed to fetch foundation: ${foundationRes.status}`);
    }

    const foundationData = await foundationRes.json();
    const foundation = foundationData.foundation as Foundation;

    // Fetch records (associations are eager-loaded on backend for performance)
    // Use cursor-based pagination: initial load is 100 records for instant page load
    // More records will be loaded in background by ContactsPageClient
    const recordsRes = await fetch(
      `${API_BASE_URL}/api/v1/foundations/${foundation.id}/records?limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Disable caching - always fetch fresh data
      }
    );

    if (!recordsRes.ok) {
      throw new Error(`Failed to fetch records: ${recordsRes.status}`);
    }

    const recordsData = await recordsRes.json();
    const records = (recordsData.records || []) as TableRow[];
    // total_count is at top level for cursor pagination, inside pagination for offset pagination
    const totalCount = recordsData.total_count ?? recordsData.pagination?.total_count ?? null;
    // has_more indicates if there are more records to load
    const hasMore = recordsData.has_more ?? (records.length === 100); // Default to true if we got a full page

    // Transform columns to TeeemTableView format
    const columns = transformColumns(foundation);

    console.log('[SSR] Successfully fetched:', slug, '- records:', records.length, '- hasMore:', hasMore);
    return {
      foundation,
      columns,
      records,
      totalCount,
      hasMore,
      error: null,
    };
  } catch (err) {
    console.error('[SSR] Failed to fetch foundation data:', err);
    return {
      foundation: null,
      columns: [],
      records: [],
      totalCount: null,
      hasMore: false,
      error: err instanceof Error ? err.message : 'Failed to load data',
    };
  }
}

/**
 * Transform API columns to TeeemTableView format
 */
function transformColumns(foundation: Foundation): TableColumn[] {
  if (!foundation?.columns) return [];

  const tableColumns: TableColumn[] = [
    { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 40 }
  ];

  foundation.columns.forEach((col: ApiColumn) => {
    // Skip hidden system columns (e.g., deleted_at)
    if (isHiddenSystemColumn(col.column_name)) return;

    // Check if this is a visible system column (id, created_at, updated_at)
    const isSystemCol = isVisibleSystemColumn(col.column_name);

    tableColumns.push({
      id: col.id,
      foundation_id: col.foundation_id || foundation.id,
      key: col.column_name,
      label: col.name,
      column_type: col.column_type,
      resizable: true,
      sortable: true,
      filterable: true,
      width: getDefaultWidth(col.column_name, col.column_type),
      choices: col.available_choices,
      lookup_foundation_id: col.lookup_foundation_id,
      lookup_display_column: col.lookup_display_column,
      // SSoT: System columns are visible but not editable (GOLD_STANDARD_TABLE.md)
      system: isSystemCol,
      editable: !isSystemCol,
    });
  });

  return tableColumns;
}

// Export ViewData type for use in page components
export type { ViewData };

/**
 * SSR Group Count data for pre-loading
 */
export interface SSRGroupCount {
  key: string | null;
  count: number;
  displayValue: string;
}

export interface SSRGroupCounts {
  groups: SSRGroupCount[];
  totalRecords: number;
  displayValuesMap: Record<string, Record<number, string>>;
}

/**
 * Extended foundation data including optional view configuration
 */
interface FoundationDataWithView extends FoundationData {
  view: ViewData | null;
  views: ViewData[];  // All views for the foundation (for toolbar buttons)
  groupCounts: SSRGroupCounts | null;
}

/**
 * Fetch foundation data optimized for SSR/LCP
 *
 * This is the preferred function for Server Components.
 * Fetches foundation metadata and records in parallel with minimal payload.
 * Optionally fetches view configuration to eliminate flash on grouped views.
 *
 * @param slug - Foundation slug (e.g., "contacts", "jobs")
 * @param options - Optional configuration
 * @param options.limit - Number of records to fetch (default: 20 for fast LCP)
 * @param options.viewSlug - View slug from URL to pre-fetch (eliminates flash)
 */
export async function fetchFoundationForSSR(
  slug: string,
  options?: { limit?: number; viewSlug?: string }
): Promise<FoundationDataWithView> {
  const limit = options?.limit ?? 20; // Only 20 rows for fast LCP
  const viewSlug = options?.viewSlug;
  const token = await getAuthToken();

  if (!token) {
    return {
      foundation: null,
      columns: [],
      records: [],
      totalCount: null,
      hasMore: false,
      error: 'Not authenticated',
      view: null,
      views: [],
      groupCounts: null,
    };
  }

  try {
    // Build parallel fetch promises - always fetch views to enable default view SSR
    const fetchPromises: Promise<Response>[] = [
      fetch(`${API_BASE_URL}/api/v1/foundations/${slug}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }),
      fetch(`${API_BASE_URL}/api/v1/foundations/${slug}/records?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }),
      // Always fetch views to enable default view SSR (eliminates CLS from view loading)
      fetch(`${API_BASE_URL}/api/v1/foundation_views?foundation_id=${slug}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }),
    ];

    // Parallel fetch for all resources
    const responses = await Promise.all(fetchPromises);
    const [foundationRes, recordsRes, viewsRes] = responses;

    if (!foundationRes.ok) {
      throw new Error(`Failed to fetch foundation: ${foundationRes.status}`);
    }
    if (!recordsRes.ok) {
      throw new Error(`Failed to fetch records: ${recordsRes.status}`);
    }

    // Parse responses in parallel
    const parsePromises = [
      foundationRes.json(),
      recordsRes.json(),
      viewsRes.ok ? viewsRes.json() : Promise.resolve({ views: [] }),
    ];

    const [foundationData, recordsData, viewsData] = await Promise.all(parsePromises);

    const foundation = foundationData.foundation as Foundation;
    const records = (recordsData.records || []) as TableRow[];
    const totalCount = recordsData.total_count ?? recordsData.pagination?.total_count ?? null;
    const hasMore = recordsData.has_more ?? (records.length === limit);

    const columns = transformColumns(foundation);

    // Find view: either by URL slug or auto-select default view
    // SSR CLS Fix: Always select a view to prevent client-side default view loading flash
    let view: ViewData | null = null;
    const views = (viewsData?.views || []) as ViewData[];

    if (viewSlug) {
      // Priority 1: URL-specified view
      view = views.find(v =>
        v.slug?.toLowerCase() === viewSlug.toLowerCase() ||
        String(v.id) === viewSlug
      ) || null;

      if (view) {
        console.log('[SSR] Pre-loaded URL view:', view.name, 'with grouping:', view.group_by_columns);
      } else {
        console.log('[SSR] View not found for slug:', viewSlug, '- falling back to default');
      }
    }

    // If no URL view, select default view (matches client-side selectDefaultView logic)
    if (!view && views.length > 0) {
      // Priority 2: Explicit default global view
      view = views.find(v => v.is_default && v.is_global) || null;
      // Priority 3: Any explicit default view
      if (!view) view = views.find(v => v.is_default) || null;
      // Priority 4: First global view at display_order 0
      if (!view) view = views.find(v => v.is_global && v.display_order === 0) || null;
      // Priority 5: First view at display_order 0
      if (!view) view = views.find(v => v.display_order === 0) || null;
      // Priority 6: First view
      if (!view) view = views[0] || null;

      if (view) {
        console.log('[SSR] Pre-loaded default view:', view.name, 'with grouping:', view.group_by_columns);
      }
    }

    // SSR CLS Fix: Fetch group counts if view has grouping
    // This eliminates CLS caused by groupedEntries recalculating when counts load
    let groupCounts: SSRGroupCounts | null = null;
    const groupByColumns = view?.group_by_columns || (view?.group_by_column ? [view.group_by_column] : []);

    if (groupByColumns.length > 0 && foundation?.id) {
      try {
        const groupByParam = groupByColumns.join(',');
        const groupsRes = await fetch(
          `${API_BASE_URL}/api/v1/foundations/${foundation.id}/groups?group_by=${encodeURIComponent(groupByParam)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          }
        );

        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          if (groupsData.success && groupsData.groups) {
            groupCounts = {
              groups: groupsData.groups.map((g: { key: string | null; count: number; display_value: string }) => ({
                key: g.key,
                count: g.count,
                displayValue: g.display_value,
              })),
              totalRecords: groupsData.total_records || 0,
              displayValuesMap: groupsData.display_values_map || {},
            };
            console.log('[SSR] Pre-loaded group counts:', groupCounts.groups.length, 'groups');
          }
        }
      } catch (groupErr) {
        console.error('[SSR] Failed to fetch group counts (non-fatal):', groupErr);
        // Continue without group counts - will load client-side
      }
    }

    return {
      foundation,
      columns,
      records,
      totalCount,
      hasMore,
      error: null,
      view,
      views,  // All views for SSR toolbar buttons
      groupCounts,
    };
  } catch (err) {
    console.error('[SSR] Failed to fetch foundation data:', err);
    return {
      foundation: null,
      columns: [],
      records: [],
      totalCount: null,
      hasMore: false,
      error: err instanceof Error ? err.message : 'Failed to load data',
      view: null,
      views: [],
      groupCounts: null,
    };
  }
}

/**
 * View data returned from API for SSR
 * Type-compatible with SavedView from components/table/types.ts
 */
interface ViewData {
  id: number;
  name: string;
  slug: string;
  view_type?: "custom" | "default" | null;
  view_display_type?: "table" | "grouped" | "relational" | "hierarchy";
  is_global?: boolean;
  is_default?: boolean;
  foundation_id: number;
  filters?: {
    cascadeFilters?: Array<{
      id?: string;
      column: string;
      operator: string;
      value: unknown;
    }>;
    filterGroups?: Array<{ id: string; logic: 'AND' | 'OR' }>;
    interGroupLogic?: 'AND' | 'OR';
  };
  columns?: {
    visible?: Record<string, boolean>;
    order?: string[];
    widths?: Record<string, number>;
    autoFitColumns?: boolean;
    smartFit?: boolean;
    showTotals?: boolean;
    stickyActions?: boolean;
  };
  sort_order?: Array<{ column: string; dir: 'asc' | 'desc' }>;
  group_by_columns?: string[];
  group_by_column?: string;
  display_order?: number;
}

/**
 * Fetch a view by slug for SSR
 * Returns the view configuration to apply on initial render
 *
 * @param foundationSlug - Foundation slug (e.g., "jobs")
 * @param viewSlug - View slug from URL (e.g., "live")
 */
export async function fetchViewBySlug(
  foundationSlug: string,
  viewSlug: string
): Promise<ViewData | null> {
  const token = await getAuthToken();

  if (!token) {
    console.log('[SSR] No auth token - cannot fetch view');
    return null;
  }

  try {
    // Fetch all views for the foundation and find by slug
    // This is more reliable than a direct slug lookup since views can have
    // the same slug across different foundations
    const viewsRes = await fetch(
      `${API_BASE_URL}/api/v1/foundation_views?foundation_id=${foundationSlug}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!viewsRes.ok) {
      console.error('[SSR] Failed to fetch views:', viewsRes.status);
      return null;
    }

    const data = await viewsRes.json();
    const views = data.views as ViewData[];

    if (!views || !Array.isArray(views)) {
      console.log('[SSR] No views found for foundation:', foundationSlug);
      return null;
    }

    // Find view by slug (case-insensitive for flexibility)
    const view = views.find(v =>
      v.slug?.toLowerCase() === viewSlug.toLowerCase() ||
      // Also check numeric ID for backwards compatibility
      String(v.id) === viewSlug
    );

    if (view) {
      console.log('[SSR] Found view:', view.name, 'slug:', view.slug);
      return view;
    }

    console.log('[SSR] View not found for slug:', viewSlug);
    return null;
  } catch (err) {
    console.error('[SSR] Failed to fetch view:', err);
    return null;
  }
}

/**
 * Get default column width based on column name and type
 */
function getDefaultWidth(columnName: string, columnType: string): number {
  if (columnName === 'id') return 60;
  if (columnName === 'name' || columnName === 'title') return 250;
  if (columnName === 'primary_company_id') return 250;
  if (columnName === 'ted_number') return 100;
  if (columnName === 'status' || columnName === 'job_status') return 120;
  if (columnName === 'job_type') return 120;
  if (columnName === 'code') return 80;
  if (columnName.includes('email')) return 200;
  if (columnName.includes('phone')) return 130;

  switch (columnType) {
    case 'currency':
    case 'percentage':
      return 100;
    case 'date':
    case 'date_and_time':
      return 120;
    case 'boolean':
      return 80;
    case 'multiple_lines_text':
    case 'long_text':
      return 300;
    default:
      return 150;
  }
}
