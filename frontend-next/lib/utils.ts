import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export timezone utilities for convenience
export { getTodayAsString, getNowInCompanyTimezone } from './timezone-utils';

/**
 * Safely format a number with toFixed, handling null/undefined/string values.
 * Prevents "Cannot read properties of null (reading 'toFixed')" errors.
 * Also handles string values from API responses by converting to number.
 *
 * @param value - The number to format (can be null/undefined/string)
 * @param decimals - Number of decimal places (default: 1)
 * @param fallback - Value to use when input is null/undefined/NaN (default: 0)
 * @returns Formatted string
 *
 * @example
 * safeToFixed(job.margin, 1)        // "25.3"
 * safeToFixed(null, 2)              // "0.00"
 * safeToFixed(claim.percent, 0)     // "75"
 * safeToFixed("25.3", 1)            // "25.3" (handles string from API)
 */
export function safeToFixed(
  value: number | string | null | undefined,
  decimals: number = 1,
  fallback: number = 0
): string {
  if (value === null || value === undefined) {
    return fallback.toFixed(decimals);
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return (isNaN(numValue) ? fallback : numValue).toFixed(decimals);
}

/**
 * Safely format a percentage with toFixed.
 *
 * @param value - The percentage value (can be null/undefined/string)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string with % suffix
 *
 * @example
 * safePercent(job.margin)          // "25.3%"
 * safePercent(null)                // "0.0%"
 * safePercent(claim.percent, 0)    // "75%"
 * safePercent("25.3")              // "25.3%" (handles string from API)
 */
export function safePercent(
  value: number | string | null | undefined,
  decimals: number = 1
): string {
  return `${safeToFixed(value, decimals)}%`;
}
