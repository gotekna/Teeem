import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export timezone utilities for convenience
export { getTodayAsString, getNowInCompanyTimezone } from './timezone-utils';
