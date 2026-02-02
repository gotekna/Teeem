/**
 * localStorage SSoT Utility
 *
 * Centralized, type-safe interface for localStorage operations.
 * Handles JSON serialization, SSR safety, error handling, and namespacing.
 *
 * Usage:
 *   import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/storage-utils';
 *
 *   const theme = getStorageItem(STORAGE_KEYS.VIEW_MODE, 'light');
 *   setStorageItem(STORAGE_KEYS.VIEW_MODE, 'dark');
 */

// Prefix for all TEEEM localStorage keys (SSoT)
const STORAGE_PREFIX = 'teeem_';

/**
 * Common localStorage keys used across the application (SSoT)
 * Add new keys here to maintain consistency
 */
export const STORAGE_KEYS = {
  // Auth & User
  TOKEN: 'token',
  PORTAL_TOKEN: 'portal_token',
  PORTAL_USER: 'portal_user',

  // UI State
  VIEW_MODE: 'view_mode',
  PERSONA: 'persona',
  SIDEBAR_STATE: 'sidebar_state',
  SIDEBAR_PINNED: 'sidebar_pinned',
  EMAIL_STATE: 'email_state',
  READING_PANE: 'reading_pane_position',

  // Task Hub
  TASK_HUB_VIEW: 'taskHub_activeView',
  TASK_HUB_FILTERS: 'taskHub_filters',
  TASK_COLORS: 'task_colors',
  AGENT_TASKS: 'agentTasks',

  // API Configuration
  API_URL: 'api_url',
  API_ENVIRONMENT: 'api_environment',

  // Feature-specific
  EMAIL_DRAFTS: 'email_drafts',
  EMAIL_FOLDERS_EXPANDED_PREFIX: 'email_folders_expanded_', // Append accountId
  VIEWS_CACHE: 'views_cache',
  OFFLINE_DATA: 'sm_offline_data',
  GANTT_CONFIG: 'ganttConfig',
  GANTT_CANVAS_STATE: 'gantt-canvas-state',
  INSPIRING_QUOTES: 'inspiringQuotes',
  ASSET_TYPES: 'asset_types',
  PDF_FIELD_SIZES: 'pdfFieldSizes',
  UPLOAD_TOKEN: 'upload_token',

  // Admin/System
  PDF_FIELDS_TEMPLATE: 'pdfFieldsTab_template',
  PDF_FIELDS_JOB_ID: 'pdfFieldsTab_jobId',
  PDF_FIELDS_PAGE: 'pdfFieldsTab_page',
  PDF_FIELDS_ZOOM: 'pdfFieldsTab_zoom',
  PDF_FIELDS_BLANK: 'pdfFieldsTab_blankTemplate',
  SM_COLUMN_STATUS: 'sm_column_status',

  // Task Color Settings (Task Hub)
  TASK_COLOR_SETTINGS: 'task-color-settings',

  // Gantt State (dynamic keys built with job/template ID)
  GANTT_COLUMNS_PREFIX: 'gantt-columns-', // Append jobId or 'template-{templateId}'
  GANTT_COLLAPSED_PREFIX: 'gantt-collapsed-', // Append jobId or 'template-{templateId}'

  // Modal Field Preferences (per-foundation)
  // Usage: getStorageItem(`${STORAGE_KEYS.MODAL_FIELDS_PREFIX}${foundationId}`, defaultValue)
  MODAL_FIELDS_PREFIX: 'modal-fields-',

  // Email Reading Pane Position
  EMAIL_READING_PANE: 'email_reading_pane',

  // Job Photos Page Filters
  JOB_PHOTOS_TYPES: 'job-photos-selected-job-types',
  JOB_PHOTOS_STATUSES: 'job-photos-selected-statuses',
  JOB_PHOTOS_SUPERVISORS: 'job-photos-selected-supervisors',

} as const;

/**
 * SSR-safe check for localStorage availability
 */
function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Get item from localStorage with type safety and JSON parsing
 *
 * @param key - Storage key (use STORAGE_KEYS constants)
 * @param defaultValue - Value to return if key not found or parsing fails
 * @param usePrefix - Whether to prepend STORAGE_PREFIX (default: true)
 * @returns Parsed value or defaultValue
 *
 * @example
 * const user = getStorageItem<User>(STORAGE_KEYS.PORTAL_USER, null);
 * const theme = getStorageItem(STORAGE_KEYS.VIEW_MODE, 'light');
 */
export function getStorageItem<T>(
  key: string,
  defaultValue: T,
  usePrefix: boolean = true
): T {
  if (!isStorageAvailable()) return defaultValue;

  try {
    const storageKey = usePrefix ? `${STORAGE_PREFIX}${key}` : key;
    const item = localStorage.getItem(storageKey);

    if (item === null) return defaultValue;

    // Try to parse as JSON, fall back to raw string if it fails
    try {
      return JSON.parse(item) as T;
    } catch {
      // If it's not JSON, return as-is (for plain strings like tokens)
      return item as T;
    }
  } catch (error) {
    console.error(`Failed to get localStorage item "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Set item in localStorage with JSON serialization
 *
 * @param key - Storage key (use STORAGE_KEYS constants)
 * @param value - Value to store (will be JSON.stringify'd)
 * @param usePrefix - Whether to prepend STORAGE_PREFIX (default: true)
 *
 * @example
 * setStorageItem(STORAGE_KEYS.VIEW_MODE, 'dark');
 * setStorageItem(STORAGE_KEYS.PORTAL_USER, { id: 1, name: 'John' });
 */
export function setStorageItem<T>(
  key: string,
  value: T,
  usePrefix: boolean = true
): void {
  if (!isStorageAvailable()) return;

  try {
    const storageKey = usePrefix ? `${STORAGE_PREFIX}${key}` : key;

    // For strings that look like plain tokens, store directly
    // For objects/arrays/numbers/booleans, stringify
    const serialized = typeof value === 'string' && !value.startsWith('{') && !value.startsWith('[')
      ? value
      : JSON.stringify(value);

    localStorage.setItem(storageKey, serialized);
  } catch (error) {
    console.error(`Failed to set localStorage item "${key}":`, error);
  }
}

/**
 * Remove item from localStorage
 *
 * @param key - Storage key (use STORAGE_KEYS constants)
 * @param usePrefix - Whether to prepend STORAGE_PREFIX (default: true)
 *
 * @example
 * removeStorageItem(STORAGE_KEYS.TOKEN);
 */
export function removeStorageItem(key: string, usePrefix: boolean = true): void {
  if (!isStorageAvailable()) return;

  try {
    const storageKey = usePrefix ? `${STORAGE_PREFIX}${key}` : key;
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error(`Failed to remove localStorage item "${key}":`, error);
  }
}

/**
 * Clear all TEEEM-prefixed items from localStorage
 * Useful for logout or reset operations
 *
 * @example
 * clearAllStorage(); // Removes all teeem_* keys
 */
export function clearAllStorage(): void {
  if (!isStorageAvailable()) return;

  try {
    const keys = Object.keys(localStorage);
    const teeemKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    teeemKeys.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}

/**
 * Get raw localStorage key with prefix applied
 * Useful when you need the actual key name for dynamic operations
 *
 * @param key - Base key name
 * @returns Prefixed key
 *
 * @example
 * const key = getStorageKey('custom_setting'); // 'teeem_custom_setting'
 */
export function getStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

/**
 * Check if a key exists in localStorage
 *
 * @param key - Storage key (use STORAGE_KEYS constants)
 * @param usePrefix - Whether to prepend STORAGE_PREFIX (default: true)
 * @returns true if key exists, false otherwise
 *
 * @example
 * if (hasStorageItem(STORAGE_KEYS.TOKEN)) {
 *   // User is logged in
 * }
 */
export function hasStorageItem(key: string, usePrefix: boolean = true): boolean {
  if (!isStorageAvailable()) return false;

  try {
    const storageKey = usePrefix ? `${STORAGE_PREFIX}${key}` : key;
    return localStorage.getItem(storageKey) !== null;
  } catch {
    return false;
  }
}
