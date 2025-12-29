/**
 * Company Settings Store
 *
 * SSoT for company-wide settings including timezone.
 * Fetches from backend /api/v1/company_settings and caches.
 */

import { api } from '@/lib/api';
import { COMPANY_TIMEZONE } from '@/lib/timezone-utils';

interface CompanySettings {
  timezone: string;
  working_days: Record<string, boolean>;
  company_name: string | null;
}

// SSoT: Uses COMPANY_TIMEZONE from timezone-utils.ts
const DEFAULT_SETTINGS: CompanySettings = {
  timezone: COMPANY_TIMEZONE,
  working_days: {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  },
  company_name: 'TEEEM',
};

// Singleton store
let cachedSettings: CompanySettings | null = null;
let fetchPromise: Promise<CompanySettings> | null = null;

/**
 * Fetch company settings from backend API (with caching)
 */
export async function fetchCompanySettings(): Promise<CompanySettings> {
  // Return cached if available
  if (cachedSettings) {
    return cachedSettings;
  }

  // Return existing fetch if in progress
  if (fetchPromise) {
    return fetchPromise;
  }

  // Start new fetch via backend API
  fetchPromise = api.get<CompanySettings>('/api/v1/company_settings')
    .then(data => {
      cachedSettings = {
        timezone: data.timezone || DEFAULT_SETTINGS.timezone,
        working_days: data.working_days || DEFAULT_SETTINGS.working_days,
        company_name: data.company_name || DEFAULT_SETTINGS.company_name,
      };
      return cachedSettings;
    })
    .catch(err => {
      console.error('Failed to fetch company settings:', err);
      cachedSettings = DEFAULT_SETTINGS;
      return DEFAULT_SETTINGS;
    })
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

/**
 * Get cached settings (sync) - returns default if not yet loaded
 */
export function getCompanySettings(): CompanySettings {
  return cachedSettings || DEFAULT_SETTINGS;
}

/**
 * Get company timezone (sync) - returns default if not yet loaded
 */
export function getCompanyTimezone(): string {
  return cachedSettings?.timezone || DEFAULT_SETTINGS.timezone;
}

/**
 * Get today's date in company timezone (midnight)
 */
export function getTodayInCompanyTimezone(): Date {
  const tz = getCompanyTimezone();
  const now = new Date();

  // Get the date parts in the company timezone
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2025');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');

  // Create date at midnight (local time matches how tasks store their dates)
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Get current time in company timezone
 */
export function getNowInCompanyTimezone(): Date {
  const tz = getCompanyTimezone();
  const now = new Date();

  // Get date/time parts in the company timezone
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2025');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Clear cache (for when settings are updated)
 */
export function clearCompanySettingsCache(): void {
  cachedSettings = null;
}

/**
 * Initialize settings on app load
 */
export function initCompanySettings(): void {
  // Start fetch in background
  fetchCompanySettings();
}
