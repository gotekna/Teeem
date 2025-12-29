/**
 * Email Sync Utilities
 *
 * Background sync strategies for offline-first email.
 * This module handles sync logic that's more complex than simple fetch.
 */

import { api } from "@/lib/api";
import { API_TIMEOUT_EMAIL_SYNC } from "@/lib/constants/timeout-constants";
import {
  emailCache,
  isIndexedDBAvailable,
  CachedEmail,
  CACHE_CONFIG,
} from "@/lib/email-cache";
import type { SplitInboxCategory } from "@/components/emails/SplitInboxTabs";

// =============================================================================
// Types
// =============================================================================

interface SplitInboxAPIResponse {
  success: boolean;
  data: {
    categories: {
      vip: { count: number; unread_count: number; emails: APIEmail[] };
      team: { count: number; unread_count: number; emails: APIEmail[] };
      newsletters: { count: number; unread_count: number; emails: APIEmail[] };
      other: { count: number; unread_count: number; emails: APIEmail[] };
    };
    team_domains: string[];
  };
}

interface APIEmail {
  id: number;
  subject: string;
  from_email: string;
  from_name: string | null;
  received_at: string;
  has_attachments: boolean;
  snippet: string;
  is_read: boolean;
  is_starred?: boolean;
  is_pinned?: boolean;
  is_archived?: boolean;
  job_id?: number | null;
  conversation_id?: string | null;
  thread_count?: number;
  is_latest_in_thread?: boolean;
}

export interface SyncResult {
  success: boolean;
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
  duration: number;
}

export type SyncStrategy = "full" | "incremental";

// =============================================================================
// Sync Functions
// =============================================================================

/**
 * Perform a full sync of split inbox data.
 * Fetches all categories and updates the cache.
 */
export async function syncSplitInbox(): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: false,
    added: 0,
    updated: 0,
    deleted: 0,
    errors: [],
    duration: 0,
  };

  if (!isIndexedDBAvailable()) {
    result.errors.push("IndexedDB not available");
    result.duration = Date.now() - startTime;
    return result;
  }

  try {
    // Fetch from API
    // SSoT: Uses API_TIMEOUT_EMAIL_SYNC from timeout-constants.ts
    const response = await api.get<SplitInboxAPIResponse>(
      "/api/v1/email_warehouse?split_inbox=true&my_emails=true&latest_only=true",
      { timeout: API_TIMEOUT_EMAIL_SYNC }
    );

    const data = (response as SplitInboxAPIResponse).data;
    const now = Date.now();

    // Get existing cached email IDs to track what's new vs updated
    const existingEmails = await emailCache.getAllEmails();
    const existingIds = new Set(existingEmails.map((e) => e.id));

    // Transform and cache all emails
    const allEmails: CachedEmail[] = [];
    const categories: SplitInboxCategory[] = ["vip", "team", "newsletters", "other"];

    for (const category of categories) {
      const categoryData = data.categories[category];
      const categoryEmails = categoryData.emails.map((email): CachedEmail => ({
        ...email,
        _cachedAt: now,
        _category: category,
      }));
      allEmails.push(...categoryEmails);

      // Track new vs updated
      for (const email of categoryEmails) {
        if (existingIds.has(email.id)) {
          result.updated++;
        } else {
          result.added++;
        }
      }
    }

    // Store all emails
    await emailCache.putEmails(allEmails);

    // Update category metadata
    await emailCache.setAllCategoryMeta({
      vip: {
        count: data.categories.vip.count,
        unread_count: data.categories.vip.unread_count,
        emailIds: data.categories.vip.emails.map((e) => e.id),
      },
      team: {
        count: data.categories.team.count,
        unread_count: data.categories.team.unread_count,
        emailIds: data.categories.team.emails.map((e) => e.id),
      },
      newsletters: {
        count: data.categories.newsletters.count,
        unread_count: data.categories.newsletters.unread_count,
        emailIds: data.categories.newsletters.emails.map((e) => e.id),
      },
      other: {
        count: data.categories.other.count,
        unread_count: data.categories.other.unread_count,
        emailIds: data.categories.other.emails.map((e) => e.id),
      },
    });

    // Update sync timestamp
    await emailCache.setLastSync(now);

    result.success = true;
  } catch (err) {
    console.error("[EmailSync] Sync failed:", err);
    result.errors.push(err instanceof Error ? err.message : "Unknown error");
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Check if a sync is needed based on staleness.
 */
export async function isSyncNeeded(): Promise<boolean> {
  if (!isIndexedDBAvailable()) return true;

  try {
    return await emailCache.isAnyCategoryStale();
  } catch {
    return true;
  }
}

/**
 * Get time since last sync in milliseconds.
 */
export async function getTimeSinceLastSync(): Promise<number | null> {
  if (!isIndexedDBAvailable()) return null;

  try {
    const lastSync = await emailCache.getLastSync();
    if (!lastSync) return null;
    return Date.now() - lastSync;
  } catch {
    return null;
  }
}

/**
 * Check if data is considered stale.
 */
export async function isDataStale(): Promise<boolean> {
  const timeSinceSync = await getTimeSinceLastSync();
  if (timeSinceSync === null) return true;
  return timeSinceSync > CACHE_CONFIG.STALE_THRESHOLD_MS;
}

/**
 * Prune old cached data to stay within limits.
 */
export async function pruneCache(): Promise<{ emailsPruned: number }> {
  if (!isIndexedDBAvailable()) return { emailsPruned: 0 };

  let emailsPruned = 0;

  try {
    const categories: SplitInboxCategory[] = ["vip", "team", "newsletters", "other"];

    for (const category of categories) {
      const pruned = await emailCache.pruneEmailsByCategory(category);
      emailsPruned += pruned;
    }
  } catch (err) {
    console.error("[EmailSync] Prune failed:", err);
  }

  return { emailsPruned };
}

/**
 * Clear all cached data and sync fresh.
 * Use when cache may be corrupted or needs full refresh.
 */
export async function fullResync(): Promise<SyncResult> {
  if (!isIndexedDBAvailable()) {
    return {
      success: false,
      added: 0,
      updated: 0,
      deleted: 0,
      errors: ["IndexedDB not available"],
      duration: 0,
    };
  }

  try {
    // Clear existing cache
    await emailCache.clearAll();

    // Perform fresh sync
    return await syncSplitInbox();
  } catch (err) {
    console.error("[EmailSync] Full resync failed:", err);
    return {
      success: false,
      added: 0,
      updated: 0,
      deleted: 0,
      errors: [err instanceof Error ? err.message : "Unknown error"],
      duration: 0,
    };
  }
}

// =============================================================================
// Sync Scheduler (for future use)
// =============================================================================

let syncIntervalId: number | null = null;

/**
 * Start periodic background sync.
 * Syncs every interval if data is stale.
 */
export function startPeriodicSync(intervalMs: number = 60000): void {
  if (syncIntervalId !== null) return; // Already running

  syncIntervalId = window.setInterval(async () => {
    const shouldSync = await isSyncNeeded();
    if (shouldSync) {
      console.log("[EmailSync] Periodic sync triggered");
      await syncSplitInbox();
    }
  }, intervalMs);

  console.log(`[EmailSync] Periodic sync started (every ${intervalMs}ms)`);
}

/**
 * Stop periodic background sync.
 */
export function stopPeriodicSync(): void {
  if (syncIntervalId !== null) {
    window.clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log("[EmailSync] Periodic sync stopped");
  }
}

export default {
  syncSplitInbox,
  isSyncNeeded,
  getTimeSinceLastSync,
  isDataStale,
  pruneCache,
  fullResync,
  startPeriodicSync,
  stopPeriodicSync,
};
