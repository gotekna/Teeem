/**
 * Calendar Atoms - Jotai state management for calendar views
 *
 * SSoT for calendar state across the application.
 * Uses SmTask data as the source - calendar is a view layer.
 */

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// Types
export type CalendarViewType = "month" | "week" | "day" | "schedule";
export type CalendarModeType = "personal" | "team" | "resource";

export interface CalendarEvent {
  id: number;
  task_number: number;
  name: string;
  start_date: string;
  end_date: string;
  required_by: string | null;
  all_day: boolean;
  status: "not_started" | "started" | "completed";
  progress_percentage: number;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assigned_role: number | null;
  job_id: number | null;
  job_name: string | null;
  job_code: string | null;
  is_overdue: boolean;
  days_overdue: number | null;
  color: string;
  is_hold: boolean;
  hold_reason: string | null;
  lock_type: string | null;
  description: string | null;
}

export interface CalendarFilters {
  userIds: number[];
  roleIds: number[];
  jobId: number | null;
  statuses: string[];
  includeUnassigned: boolean;
}

export interface CapacityData {
  available_hours: number;
  allocated_hours: number;
  utilization_percent: number;
  task_ids: number[];
  is_absent: boolean;
  absence_type: string | null;
  is_overbooked: boolean;
}

export interface UserCapacity {
  user_id: number;
  user_name: string;
  capacity_by_date: Record<string, CapacityData>;
}

export interface CalendarSummary {
  overdue: number;
  due_today: number;
  due_this_week: number;
  in_progress: number;
  not_started: number;
  completed_this_week: number;
}

// ============================================================================
// VIEW STATE ATOMS
// ============================================================================

/**
 * Current calendar view type (month/week/day/schedule)
 * Persisted to localStorage for user preference
 */
export const calendarViewAtom = atomWithStorage<CalendarViewType>(
  "teeem-calendar-view",
  "month"
);

/**
 * Current calendar mode (personal/team/resource)
 * Persisted to localStorage for user preference
 */
export const calendarModeAtom = atomWithStorage<CalendarModeType>(
  "teeem-calendar-mode",
  "personal"
);

/**
 * Currently selected date (for navigation)
 */
export const selectedDateAtom = atom<Date>(new Date());

/**
 * Computed date range based on view type and selected date
 */
export const dateRangeAtom = atom((get) => {
  const view = get(calendarViewAtom);
  const selected = get(selectedDateAtom);

  const start = new Date(selected);
  const end = new Date(selected);

  switch (view) {
    case "month":
      // Start of month, but go back to start of week
      start.setDate(1);
      start.setDate(start.getDate() - start.getDay()); // Start of week containing 1st
      // End of month, but go forward to end of week
      end.setMonth(end.getMonth() + 1, 0); // Last day of month
      end.setDate(end.getDate() + (6 - end.getDay())); // End of week
      break;
    case "week":
      // Start of week (Sunday)
      start.setDate(start.getDate() - start.getDay());
      // End of week (Saturday)
      end.setDate(start.getDate() + 6);
      break;
    case "day":
      // Just the selected day
      break;
    case "schedule":
      // 30 days from selected date
      end.setDate(end.getDate() + 30);
      break;
  }

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
});

// ============================================================================
// FILTER ATOMS
// ============================================================================

/**
 * Calendar filters
 */
export const calendarFiltersAtom = atom<CalendarFilters>({
  userIds: [],
  roleIds: [],
  jobId: null,
  statuses: ["not_started", "started"],
  includeUnassigned: true,
});

/**
 * Whether the filter sidebar is open
 */
export const calendarFiltersSidebarOpenAtom = atom<boolean>(false);

// ============================================================================
// DATA ATOMS
// ============================================================================

/**
 * Calendar events (tasks)
 */
export const calendarEventsAtom = atom<CalendarEvent[]>([]);

/**
 * Events grouped by date for efficient rendering
 */
export const eventsByDateAtom = atom<Record<string, CalendarEvent[]>>({});

/**
 * Loading state
 */
export const calendarLoadingAtom = atom<boolean>(false);

/**
 * Error state
 */
export const calendarErrorAtom = atom<string | null>(null);

/**
 * Capacity data for resource view
 */
export const capacityDataAtom = atom<UserCapacity[]>([]);

/**
 * Summary stats
 */
export const calendarSummaryAtom = atom<CalendarSummary | null>(null);

// ============================================================================
// SELECTION ATOMS
// ============================================================================

/**
 * Currently selected event (for detail panel)
 */
export const selectedEventAtom = atom<CalendarEvent | null>(null);

/**
 * Whether the event detail panel is open
 */
export const eventDetailOpenAtom = atom<boolean>(false);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date for display
 */
export function formatCalendarDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Get month name for header
 */
export function getMonthName(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string): boolean {
  return isSameDay(date, new Date());
}

/**
 * Get status color class
 */
export function getStatusColorClass(
  status: string,
  isOverdue: boolean
): string {
  if (isOverdue) return "bg-red-500";
  switch (status) {
    case "completed":
      return "bg-green-500";
    case "started":
      return "bg-blue-500";
    default:
      return "bg-gray-400";
  }
}
