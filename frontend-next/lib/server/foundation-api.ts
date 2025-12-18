/**
 * Server-side Foundation Data Fetching
 *
 * These functions run on the server during SSR/RSC and fetch data
 * before the page is sent to the client. This eliminates the white
 * screen flash that occurs with client-only data fetching.
 */

import { cookies } from 'next/headers';
import { getApiBaseUrl } from '@/lib/api';

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

// System columns that are auto-generated (visible but not editable)
// Per GOLD_STANDARD_TABLE.md: System columns MUST be visible with yellow highlight
const SYSTEM_COLUMNS = ['id', 'created_at', 'updated_at', 'deleted_at'];

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
    // Check if this is a system column (visible but not editable)
    const isSystemColumn = SYSTEM_COLUMNS.includes(col.column_name);

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
      // System columns are visible but not editable (per GOLD_STANDARD_TABLE.md)
      system: isSystemColumn,
      editable: !isSystemColumn,
    });
  });

  return tableColumns;
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
