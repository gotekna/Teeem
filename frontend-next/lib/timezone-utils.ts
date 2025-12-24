// Timezone utilities - Brisbane timezone
const BRISBANE_TZ = 'Australia/Brisbane';

export function getCompanyTimezone(): string {
  return BRISBANE_TZ;
}

export function getTodayAsString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: BRISBANE_TZ }); // YYYY-MM-DD format
}

// Alias for getTodayAsString
export function getTodayInCompanyTimezone(): string {
  return getTodayAsString();
}

export function getNowInCompanyTimezone(): Date {
  // Get current time in Brisbane
  const now = new Date();
  const brisbaneTime = new Date(now.toLocaleString('en-US', { timeZone: BRISBANE_TZ }));
  return brisbaneTime;
}

export function formatDateForDisplay(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-AU', { timeZone: BRISBANE_TZ });
}

export function formatDateTimeForDisplay(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-AU', { timeZone: BRISBANE_TZ });
}

/**
 * Format a Date as YYYY-MM-DD string using company timezone (Brisbane)
 * Use this for API calls that expect date strings
 */
export function formatDateForAPI(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  // Use en-CA locale which produces YYYY-MM-DD format, with Brisbane timezone
  return d.toLocaleDateString('en-CA', { timeZone: BRISBANE_TZ });
}
