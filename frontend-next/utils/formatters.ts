// Formatting utilities

export function formatCurrency(value: number | string | null | undefined, currency = 'AUD'): string {
  if (value === null || value === undefined || value === '') return '';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';

  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';

  return new Intl.NumberFormat('en-AU').format(numValue);
}

export function formatPercentage(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';

  return `${numValue.toFixed(1)}%`;
}

export function formatPercentChange(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';

  const sign = numValue >= 0 ? '+' : '';
  return `${sign}${numValue.toFixed(1)}%`;
}

/**
 * Format percentage with custom fallback for null/undefined.
 * Use when "-" or "0%" is preferred over empty string.
 * @example formatPercentageWithFallback(null, "-") → "-"
 * @example formatPercentageWithFallback(75.5, "0%") → "75.5%"
 */
export function formatPercentageWithFallback(
  value: number | string | null | undefined,
  fallback: string,
  decimals = 1
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return fallback;

  return `${numValue.toFixed(decimals)}%`;
}

/**
 * Format percentage as rounded integer (no decimals).
 * Use for approximate values where precision isn't needed.
 * @example formatPercentageRounded(75.7) → "76%"
 */
export function formatPercentageRounded(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';

  return `${Math.round(numValue)}%`;
}

/**
 * Format percentage change with custom fallback for null/undefined.
 * Includes +/- sign prefix.
 * @example formatPercentChangeWithFallback(5.5, "-") → "+5.5%"
 * @example formatPercentChangeWithFallback(-3.2, "-") → "-3.2%"
 */
export function formatPercentChangeWithFallback(
  value: number | string | null | undefined,
  fallback: string,
  decimals = 1
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return fallback;

  const sign = numValue >= 0 ? '+' : '';
  return `${sign}${numValue.toFixed(decimals)}%`;
}

/**
 * Format file size in human-readable format.
 * @example formatFileSize(1024) → "1 KB"
 * @example formatFileSize(1048576) → "1 MB"
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Get initials from a name string.
 * @example getInitials("John Smith") → "JS"
 * @example getInitials("Alice") → "A"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format currency with 0 decimal places (whole dollars).
 * Use for large amounts where cents clutter the display.
 * @example formatCurrencyWhole(1234567) → "$1,234,567"
 */
export function formatCurrencyWhole(value: number | string | null | undefined, currency = 'AUD'): string {
  if (value === null || value === undefined || value === '') return '';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';

  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
}

/**
 * Format currency with compact notation (K/M/B).
 * Use for headers/summaries where space is limited.
 * @example formatCurrencyCompact(1500000) → "$1.5M"
 */
export function formatCurrencyCompact(value: number | string | null | undefined, currency = 'AUD'): string {
  if (value === null || value === undefined || value === '') return '';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';

  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(numValue);
}

/**
 * Format currency with custom fallback for null/undefined.
 * Use when "-" or "$0" is preferred over empty string.
 * @example formatCurrencyWithFallback(null, "-") → "-"
 */
export function formatCurrencyWithFallback(
  value: number | string | null | undefined,
  fallback: string,
  currency = 'AUD'
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return fallback;

  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

/**
 * Format date with custom fallback for null/undefined.
 * Use when "Never", "Not set", etc. is preferred over "-".
 * @example formatDateWithFallback(null, "Never") → "Never"
 */
export function formatDateWithFallback(
  dateString: string | null | undefined,
  fallback: string
): string {
  if (!dateString) return fallback;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return fallback;

  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format datetime with custom fallback for null/undefined.
 * Use when "Never", "Not set", etc. is preferred over "-".
 * @example formatDateTimeWithFallback(null, "Never") → "Never"
 */
export function formatDateTimeWithFallback(
  dateString: string | null | undefined,
  fallback: string
): string {
  if (!dateString) return fallback;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return fallback;

  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date without year (compact).
 * Use for recent dates where year context is obvious.
 * @example formatDateShort("2026-01-17") → "17 Jan"
 */
export function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Copy text to clipboard with fallback for older browsers.
 * @returns Promise that resolves when copy is complete
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}
