/**
 * Breadcrumb Trail State Management
 *
 * Session-only navigation history tracking.
 * Trail resets when:
 * - User clicks sidebar navigation (new flow)
 * - Page refreshes (session storage)
 */

import { atom } from 'jotai';

/**
 * Single item in the breadcrumb trail
 */
export interface BreadcrumbItem {
  /** Unique ID for React key */
  id: string;
  /** URL pathname (e.g., "/jobs/123") */
  pathname: string;
  /** Query string without leading ? (e.g., "tab=overview") */
  searchParams?: string;
  /** Human-readable display name (e.g., "Lot 513 Hickory Street") */
  displayName: string;
  /** Optional icon name from lucide-react */
  icon?: string;
  /** Timestamp when this item was added */
  timestamp: number;
}

/**
 * Maximum number of items in the trail
 * Prevents unbounded growth during long sessions
 */
export const MAX_TRAIL_LENGTH = 10;

/**
 * The navigation trail - session only (not persisted)
 * Starts empty, builds as user navigates
 */
export const breadcrumbTrailAtom = atom<BreadcrumbItem[]>([]);

/**
 * Helper to generate unique breadcrumb item IDs
 */
export function generateBreadcrumbId(pathname: string): string {
  return `${pathname}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
