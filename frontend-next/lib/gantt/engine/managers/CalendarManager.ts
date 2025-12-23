/**
 * CalendarManager - Handles working days, holidays, and resource calendars
 *
 * Responsibilities:
 * - Working days configuration
 * - Holiday management
 * - Non-working day detection
 * - Date calculations respecting calendar
 * - Resource-specific calendars
 *
 * Note: Wraps the core WorkingDaysCalendar functionality
 *
 * @example
 * ```typescript
 * const calendarManager = new CalendarManager();
 *
 * // Configure working days
 * calendarManager.setWorkingDays([1, 2, 3, 4, 5]); // Mon-Fri
 *
 * // Add holidays
 * calendarManager.addHoliday({ date: new Date('2024-12-25'), name: 'Christmas' });
 *
 * // Calculate working days
 * const endDate = calendarManager.addWorkingDays(startDate, 5);
 * ```
 */

import { WorkingDaysCalendar, type Holiday, type WorkingDaysConfig } from '../WorkingDaysCalendar';

// ============================================================================
// Types
// ============================================================================

export interface CalendarChangeEvent {
  type: 'workingDays' | 'holiday' | 'config';
}

type CalendarChangeCallback = (event: CalendarChangeEvent) => void;

export interface ResourceCalendar {
  resourceId: string;
  resourceName: string;
  workingDays: number[];
  holidays: Holiday[];
}

// ============================================================================
// CalendarManager Class
// ============================================================================

export class CalendarManager {
  // Default calendar
  private defaultCalendar: WorkingDaysCalendar;

  // Resource-specific calendars
  private resourceCalendars: Map<string, WorkingDaysCalendar> = new Map();

  // Holidays (shared or per-calendar)
  private holidays: Holiday[] = [];

  // Configuration
  private workingDays: number[] = [1, 2, 3, 4, 5]; // Monday = 1, Sunday = 0

  // Callbacks
  private callbacks: Set<CalendarChangeCallback> = new Set();

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor(config?: WorkingDaysConfig) {
    this.defaultCalendar = new WorkingDaysCalendar(config);
  }

  // ============================================================================
  // Working Days Configuration
  // ============================================================================

  /**
   * Set which days of the week are working days
   * @param days Array of day numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
   */
  setWorkingDays(days: number[]): void {
    this.workingDays = [...days];
    this.notifyChange({ type: 'workingDays' });
  }

  /**
   * Get current working days configuration
   */
  getWorkingDays(): number[] {
    return [...this.workingDays];
  }

  /**
   * Check if a specific day of week is a working day
   */
  isWorkingDayOfWeek(dayOfWeek: number): boolean {
    return this.workingDays.includes(dayOfWeek);
  }

  // ============================================================================
  // Holiday Management
  // ============================================================================

  /**
   * Add a holiday
   */
  addHoliday(holiday: Holiday): void {
    this.holidays.push(holiday);
    this.defaultCalendar.addHolidays([holiday]);
    this.notifyChange({ type: 'holiday' });
  }

  /**
   * Remove a holiday by date
   */
  removeHoliday(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0];
    const index = this.holidays.findIndex(h =>
      h.date.toISOString().split('T')[0] === dateStr
    );

    if (index >= 0) {
      this.holidays.splice(index, 1);
      // WorkingDaysCalendar doesn't have removeHoliday, so rebuild with updated list
      this.defaultCalendar.clearHolidays();
      this.defaultCalendar.addHolidays(this.holidays);
      this.notifyChange({ type: 'holiday' });
      return true;
    }
    return false;
  }

  /**
   * Get all holidays
   */
  getHolidays(): Holiday[] {
    return [...this.holidays];
  }

  /**
   * Get holidays within a date range
   */
  getHolidaysInRange(start: Date, end: Date): Holiday[] {
    return this.holidays.filter(h => h.date >= start && h.date <= end);
  }

  /**
   * Check if a date is a holiday
   */
  isHoliday(date: Date): boolean {
    return this.defaultCalendar.isHoliday(date);
  }

  /**
   * Set holidays from array (replaces existing)
   */
  setHolidays(holidays: Holiday[]): void {
    this.holidays = [...holidays];
    this.defaultCalendar.clearHolidays();
    this.defaultCalendar.addHolidays(holidays);
    this.notifyChange({ type: 'holiday' });
  }

  // ============================================================================
  // Date Calculations
  // ============================================================================

  /**
   * Check if a date is a working day
   */
  isWorkingDay(date: Date): boolean {
    return this.defaultCalendar.isWorkingDay(date);
  }

  /**
   * Add working days to a date
   */
  addWorkingDays(date: Date, days: number): Date {
    return this.defaultCalendar.addWorkingDays(date, days);
  }

  /**
   * Subtract working days from a date
   */
  subtractWorkingDays(date: Date, days: number): Date {
    return this.addWorkingDays(date, -days);
  }

  /**
   * Calculate working days between two dates
   */
  getWorkingDaysBetween(start: Date, end: Date): number {
    return this.defaultCalendar.getWorkingDaysBetween(start, end);
  }

  /**
   * Snap a date to a working day
   */
  snapToWorkingDay(date: Date, forward: boolean = true): Date {
    return this.defaultCalendar.snapToWorkingDay(date, forward);
  }

  /**
   * Get the next working day after a date
   */
  getNextWorkingDay(date: Date): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return this.snapToWorkingDay(next, true);
  }

  /**
   * Get the previous working day before a date
   */
  getPreviousWorkingDay(date: Date): Date {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    return this.snapToWorkingDay(prev, false);
  }

  // ============================================================================
  // Resource Calendars
  // ============================================================================

  /**
   * Create a resource-specific calendar
   */
  createResourceCalendar(resourceId: string, config?: WorkingDaysConfig): WorkingDaysCalendar {
    const calendar = new WorkingDaysCalendar(config);
    this.resourceCalendars.set(resourceId, calendar);
    return calendar;
  }

  /**
   * Get a resource calendar (falls back to default)
   */
  getResourceCalendar(resourceId: string): WorkingDaysCalendar {
    return this.resourceCalendars.get(resourceId) || this.defaultCalendar;
  }

  /**
   * Remove a resource calendar
   */
  removeResourceCalendar(resourceId: string): boolean {
    return this.resourceCalendars.delete(resourceId);
  }

  /**
   * Check if a date is a working day for a specific resource
   */
  isResourceWorkingDay(resourceId: string, date: Date): boolean {
    const calendar = this.getResourceCalendar(resourceId);
    return calendar.isWorkingDay(date);
  }

  // ============================================================================
  // Week Utilities
  // ============================================================================

  /**
   * Get all dates in a week that are working days
   */
  getWorkingDaysInWeek(date: Date): Date[] {
    const result: Date[] = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Move to Sunday

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      if (this.isWorkingDay(day)) {
        result.push(day);
      }
    }

    return result;
  }

  /**
   * Get the number of working days in a month
   */
  getWorkingDaysInMonth(year: number, month: number): number {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // Last day of month
    return this.getWorkingDaysBetween(start, end);
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  onChange(callback: CalendarChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyChange(event: CalendarChangeEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[CalendarManager] Callback error:', e);
      }
    }
  }

  // ============================================================================
  // Default Calendar Access
  // ============================================================================

  /**
   * Get the default calendar instance
   */
  getDefaultCalendar(): WorkingDaysCalendar {
    return this.defaultCalendar;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.callbacks.clear();
    this.resourceCalendars.clear();
    this.holidays = [];
  }
}

export default CalendarManager;
