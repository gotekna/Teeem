'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { WorkingDaysCalendar, Holiday } from '@/lib/gantt/engine/WorkingDaysCalendar';
import { format } from 'date-fns';

/**
 * Hook to provide working day calculations with holidays loaded from API
 *
 * SSoT: Uses WorkingDaysCalendar from gantt/engine
 * Holidays loaded from: /api/v1/public_holidays/dates
 */
export function useWorkingDays() {
  const [calendar, setCalendar] = useState<WorkingDaysCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load holidays on mount
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const response = await api.get<{ dates: string[] }>(
          `/api/v1/public_holidays/dates?year_start=${currentYear - 1}&year_end=${currentYear + 2}&region=QLD`
        );

        const cal = new WorkingDaysCalendar();

        if (response?.dates) {
          const holidays: Holiday[] = response.dates.map(dateStr => ({
            date: new Date(dateStr),
            name: 'Public Holiday',
            type: 'public' as const,
          }));
          cal.addHolidays(holidays);
        }

        setCalendar(cal);
        setError(null);
      } catch (err) {
        console.error('Failed to load holidays:', err);
        // Fallback to calendar without holidays
        setCalendar(new WorkingDaysCalendar());
        setError('Failed to load holidays');
      } finally {
        setLoading(false);
      }
    };

    loadHolidays();
  }, []);

  /**
   * Add working days to a date (skips weekends and holidays)
   * Duration 1 = same day, Duration 2 = next working day, etc.
   */
  const addWorkingDays = useCallback((date: Date, durationDays: number): Date => {
    if (!calendar) {
      // Fallback: simple calendar days if not loaded yet
      const result = new Date(date);
      result.setDate(result.getDate() + durationDays - 1);
      return result;
    }

    // Duration 1 means start and end on same day
    // Duration 2 means add 1 working day, etc.
    if (durationDays <= 1) return new Date(date);
    return calendar.addWorkingDays(date, durationDays - 1);
  }, [calendar]);

  /**
   * Calculate duration in working days between two dates (inclusive)
   */
  const getWorkingDaysBetween = useCallback((startDate: Date, endDate: Date): number => {
    if (!calendar) {
      // Fallback: simple difference + 1
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays + 1;
    }

    return calendar.getWorkingDaysBetween(startDate, endDate);
  }, [calendar]);

  /**
   * Check if a date is a working day
   */
  const isWorkingDay = useCallback((date: Date): boolean => {
    if (!calendar) return true;
    return calendar.isWorkingDay(date);
  }, [calendar]);

  /**
   * Format end date based on start date and duration
   */
  const calculateEndDate = useCallback((startDate: Date | string, durationDays: number): string => {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const endDate = addWorkingDays(start, durationDays);
    return format(endDate, 'yyyy-MM-dd');
  }, [addWorkingDays]);

  /**
   * Calculate duration based on start and end dates
   */
  const calculateDuration = useCallback((startDate: Date | string, endDate: Date | string): number => {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    return getWorkingDaysBetween(start, end);
  }, [getWorkingDaysBetween]);

  return {
    loading,
    error,
    calendar,
    addWorkingDays,
    getWorkingDaysBetween,
    isWorkingDay,
    calculateEndDate,
    calculateDuration,
  };
}

export default useWorkingDays;
