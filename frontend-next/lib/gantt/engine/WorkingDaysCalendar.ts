/**
 * WorkingDaysCalendar - Working Days and Holiday Management
 *
 * Handles:
 * - Company working days configuration (Mon-Sun toggles)
 * - Public holidays
 * - Non-working day detection
 * - Date calculations (add/subtract working days)
 */

// ============================================================================
// Types
// ============================================================================

import { COMPANY_TIMEZONE } from '@/lib/timezone-utils';

export interface Holiday {
  date: Date;
  name: string;
  type: 'public' | 'company' | 'regional';
}

export interface WorkingDaysConfig {
  /** Array of working day indices: 0=Sunday, 1=Monday, ..., 6=Saturday */
  workingDays: number[];
  /** List of holidays to exclude */
  holidays: Holiday[];
  /** Timezone for date calculations */
  timezone?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

// SSoT: Uses COMPANY_TIMEZONE from timezone-utils.ts
const DEFAULT_CONFIG: WorkingDaysConfig = {
  // Default: Monday to Friday
  workingDays: [1, 2, 3, 4, 5],
  holidays: [],
  timezone: COMPANY_TIMEZONE,
};

// ============================================================================
// WorkingDaysCalendar Class
// ============================================================================

export class WorkingDaysCalendar {
  private config: WorkingDaysConfig;
  private holidayCache: Map<string, Holiday> = new Map();

  constructor(config?: Partial<WorkingDaysConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.buildHolidayCache();
  }

  /**
   * Build a cache of holidays for fast lookup
   */
  private buildHolidayCache(): void {
    this.holidayCache.clear();
    for (const holiday of this.config.holidays) {
      const key = this.dateToKey(holiday.date);
      this.holidayCache.set(key, holiday);
    }
  }

  /**
   * Convert date to string key for cache lookup
   */
  private dateToKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<WorkingDaysConfig>): void {
    this.config = { ...this.config, ...config };
    this.buildHolidayCache();
  }

  /**
   * Add holidays to the calendar
   */
  addHolidays(holidays: Holiday[]): void {
    this.config.holidays = [...this.config.holidays, ...holidays];
    this.buildHolidayCache();
  }

  /**
   * Clear all holidays
   */
  clearHolidays(): void {
    this.config.holidays = [];
    this.holidayCache.clear();
  }

  /**
   * Set working days (array of day indices: 0=Sun, 1=Mon, ..., 6=Sat)
   */
  setWorkingDays(days: number[]): void {
    this.config.workingDays = days;
  }

  /**
   * Check if a date is a working day
   */
  isWorkingDay(date: Date): boolean {
    const dayOfWeek = date.getDay();

    // Check if it's a configured working day
    if (!this.config.workingDays.includes(dayOfWeek)) {
      return false;
    }

    // Check if it's a holiday
    const key = this.dateToKey(date);
    if (this.holidayCache.has(key)) {
      return false;
    }

    return true;
  }

  /**
   * Check if a date is a weekend (based on configured working days)
   */
  isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return !this.config.workingDays.includes(dayOfWeek);
  }

  /**
   * Check if a date is a holiday
   */
  isHoliday(date: Date): boolean {
    const key = this.dateToKey(date);
    return this.holidayCache.has(key);
  }

  /**
   * Get holiday info for a date (if any)
   */
  getHoliday(date: Date): Holiday | null {
    const key = this.dateToKey(date);
    return this.holidayCache.get(key) || null;
  }

  /**
   * Get the next working day from a date
   * If the date is already a working day, returns that date
   */
  getNextWorkingDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);

    // Maximum 14 days to prevent infinite loops
    for (let i = 0; i < 14; i++) {
      if (this.isWorkingDay(result)) {
        return result;
      }
      result.setDate(result.getDate() + 1);
    }

    // Fallback: return the original date
    return new Date(date);
  }

  /**
   * Get the previous working day from a date
   * If the date is already a working day, returns that date
   */
  getPreviousWorkingDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);

    // Maximum 14 days to prevent infinite loops
    for (let i = 0; i < 14; i++) {
      if (this.isWorkingDay(result)) {
        return result;
      }
      result.setDate(result.getDate() - 1);
    }

    // Fallback: return the original date
    return new Date(date);
  }

  /**
   * Snap a date to the nearest working day
   * @param date - The date to snap
   * @param forward - If true, snap forward; if false, snap backward
   */
  snapToWorkingDay(date: Date, forward: boolean = true): Date {
    if (this.isWorkingDay(date)) {
      return date;
    }
    return forward ? this.getNextWorkingDay(date) : this.getPreviousWorkingDay(date);
  }

  /**
   * Add working days to a date (skipping non-working days)
   */
  addWorkingDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);

    if (days === 0) return result;

    const direction = days > 0 ? 1 : -1;
    let remainingDays = Math.abs(days);

    while (remainingDays > 0) {
      result.setDate(result.getDate() + direction);
      if (this.isWorkingDay(result)) {
        remainingDays--;
      }
    }

    return result;
  }

  /**
   * Calculate the number of working days between two dates
   */
  getWorkingDaysBetween(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    if (start > end) {
      return -this.getWorkingDaysBetween(endDate, startDate);
    }

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      if (this.isWorkingDay(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Get all holidays within a date range
   */
  getHolidaysInRange(startDate: Date, endDate: Date): Holiday[] {
    const holidays: Holiday[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      const holiday = this.getHoliday(current);
      if (holiday) {
        holidays.push(holiday);
      }
      current.setDate(current.getDate() + 1);
    }

    return holidays;
  }

  /**
   * Get all non-working dates within a range (weekends + holidays)
   */
  getNonWorkingDatesInRange(startDate: Date, endDate: Date): Date[] {
    const nonWorking: Date[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      if (!this.isWorkingDay(current)) {
        nonWorking.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return nonWorking;
  }

  /**
   * Get configuration for debugging/display
   */
  getConfig(): WorkingDaysConfig {
    return { ...this.config };
  }

  /**
   * Get working days as day names
   */
  getWorkingDayNames(): string[] {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return this.config.workingDays.map(d => dayNames[d]);
  }
}

// SSoT: Holidays come from database via /api/v1/public_holidays/dates
// NO hardcoded holidays - use addHolidays() method to set holidays from API

export default WorkingDaysCalendar;
