// Debounce utilities

import { setStorageItem } from '@/lib/storage-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Creates a debounced function that saves to localStorage using the SSoT storage-utils.
 *
 * @param key - Storage key (use STORAGE_KEYS constants from storage-utils.ts)
 * @param delay - Debounce delay in ms (default: 500)
 * @param usePrefix - Whether to prepend STORAGE_PREFIX (default: true)
 */
export function createDebouncedStorageSetter(key: string, delay = 500, usePrefix = true) {
  return debounce((value: unknown) => {
    // SSoT: Use setStorageItem for consistent localStorage handling
    setStorageItem(key, value, usePrefix);
  }, delay);
}
