/**
 * Split Inbox Store Operations
 *
 * Category metadata and sync tracking for split inbox view.
 */

import { getDatabase } from "../database";
import {
  CategoryMeta,
  SyncMeta,
  SyncMetaKey,
  OfflineAction,
  OfflineActionType,
  CACHE_CONFIG,
} from "../types";
import type { SplitInboxCategory } from "@/components/emails/SplitInboxTabs";

// =============================================================================
// Category Metadata Operations
// =============================================================================

const ALL_CATEGORIES: SplitInboxCategory[] = ["vip", "team", "newsletters", "other"];

/**
 * Get metadata for a specific category.
 */
export async function getCategoryMeta(
  category: SplitInboxCategory
): Promise<CategoryMeta | null> {
  const db = await getDatabase();
  const meta = await db.get("splitInboxMeta", category);
  return meta ?? null;
}

/**
 * Get metadata for all categories.
 */
export async function getAllCategoryMeta(): Promise<Record<SplitInboxCategory, CategoryMeta | null>> {
  const db = await getDatabase();
  const allMeta = await db.getAll("splitInboxMeta");

  const result: Record<SplitInboxCategory, CategoryMeta | null> = {
    vip: null,
    team: null,
    newsletters: null,
    other: null,
  };

  for (const meta of allMeta) {
    result[meta.category] = meta;
  }

  return result;
}

/**
 * Update metadata for a category.
 */
export async function setCategoryMeta(meta: CategoryMeta): Promise<void> {
  const db = await getDatabase();
  await db.put("splitInboxMeta", {
    ...meta,
    lastFetched: meta.lastFetched || Date.now(),
  });
}

/**
 * Update all category metadata at once (from API response).
 */
export async function setAllCategoryMeta(
  categories: Record<SplitInboxCategory, { count: number; unread_count: number; emailIds?: number[] }>
): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction("splitInboxMeta", "readwrite");
  const now = Date.now();

  const ops = ALL_CATEGORIES.map((category) => {
    const data = categories[category];
    return tx.store.put({
      category,
      count: data?.count ?? 0,
      unread_count: data?.unread_count ?? 0,
      emailIds: data?.emailIds ?? [],
      lastFetched: now,
    });
  });

  await Promise.all([...ops, tx.done]);
}

/**
 * Check if a category's data is stale.
 */
export async function isCategoryStale(category: SplitInboxCategory): Promise<boolean> {
  const meta = await getCategoryMeta(category);
  if (!meta) return true;

  return Date.now() - meta.lastFetched > CACHE_CONFIG.STALE_THRESHOLD_MS;
}

/**
 * Check if any category is stale.
 */
export async function isAnyCategoryStale(): Promise<boolean> {
  const allMeta = await getAllCategoryMeta();

  for (const category of ALL_CATEGORIES) {
    const meta = allMeta[category];
    if (!meta || Date.now() - meta.lastFetched > CACHE_CONFIG.STALE_THRESHOLD_MS) {
      return true;
    }
  }

  return false;
}

/**
 * Get counts for all categories from cache.
 */
export async function getCategoryCounts(): Promise<Record<SplitInboxCategory, number>> {
  const allMeta = await getAllCategoryMeta();

  return {
    vip: allMeta.vip?.count ?? 0,
    team: allMeta.team?.count ?? 0,
    newsletters: allMeta.newsletters?.count ?? 0,
    other: allMeta.other?.count ?? 0,
  };
}

/**
 * Get unread counts for all categories from cache.
 */
export async function getUnreadCounts(): Promise<Record<SplitInboxCategory, number>> {
  const allMeta = await getAllCategoryMeta();

  return {
    vip: allMeta.vip?.unread_count ?? 0,
    team: allMeta.team?.unread_count ?? 0,
    newsletters: allMeta.newsletters?.unread_count ?? 0,
    other: allMeta.other?.unread_count ?? 0,
  };
}

/**
 * Clear all category metadata.
 */
export async function clearCategoryMeta(): Promise<void> {
  const db = await getDatabase();
  await db.clear("splitInboxMeta");
}

// =============================================================================
// Sync Metadata Operations
// =============================================================================

/**
 * Get a sync metadata value.
 */
export async function getSyncMeta(key: SyncMetaKey): Promise<SyncMeta | null> {
  const db = await getDatabase();
  const meta = await db.get("syncMeta", key);
  return meta ?? null;
}

/**
 * Set a sync metadata value.
 */
export async function setSyncMeta(key: SyncMetaKey, value: string | number): Promise<void> {
  const db = await getDatabase();
  await db.put("syncMeta", {
    key,
    value,
    updatedAt: Date.now(),
  });
}

/**
 * Get the last sync timestamp.
 */
export async function getLastSync(): Promise<number | null> {
  const meta = await getSyncMeta("lastSync");
  return meta?.value as number | null;
}

/**
 * Set the last sync timestamp.
 */
export async function setLastSync(timestamp: number = Date.now()): Promise<void> {
  await setSyncMeta("lastSync", timestamp);
}

/**
 * Clear sync metadata.
 */
export async function clearSyncMeta(): Promise<void> {
  const db = await getDatabase();
  await db.clear("syncMeta");
}

// =============================================================================
// Offline Actions Queue Operations
// =============================================================================

/**
 * Generate a UUID for offline actions.
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Queue an action for offline processing.
 */
export async function queueOfflineAction(
  action: OfflineActionType,
  emailId: number,
  payload?: Record<string, unknown>
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();

  const offlineAction: OfflineAction = {
    id,
    action,
    emailId,
    payload,
    createdAt: Date.now(),
    retries: 0,
  };

  await db.put("offlineActions", offlineAction);
  return id;
}

/**
 * Get all pending offline actions, ordered by creation time.
 */
export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await getDatabase();
  const actions = await db.getAllFromIndex("offlineActions", "by-created-at");
  return actions;
}

/**
 * Get count of pending offline actions.
 */
export async function getPendingActionCount(): Promise<number> {
  const db = await getDatabase();
  return db.count("offlineActions");
}

/**
 * Get a specific offline action.
 */
export async function getOfflineAction(id: string): Promise<OfflineAction | null> {
  const db = await getDatabase();
  const action = await db.get("offlineActions", id);
  return action ?? null;
}

/**
 * Update an offline action (e.g., increment retries).
 */
export async function updateOfflineAction(
  id: string,
  changes: Partial<OfflineAction>
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.get("offlineActions", id);

  if (existing) {
    await db.put("offlineActions", {
      ...existing,
      ...changes,
      id, // Preserve ID
    });
  }
}

/**
 * Remove a completed offline action.
 */
export async function removeOfflineAction(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("offlineActions", id);
}

/**
 * Remove all offline actions.
 */
export async function clearOfflineActions(): Promise<void> {
  const db = await getDatabase();
  await db.clear("offlineActions");
}

/**
 * Check if there are pending actions for a specific email.
 */
export async function hasPendingActionsForEmail(emailId: number): Promise<boolean> {
  const actions = await getPendingActions();
  return actions.some((a) => a.emailId === emailId);
}

/**
 * Get pending actions for a specific email.
 */
export async function getPendingActionsForEmail(emailId: number): Promise<OfflineAction[]> {
  const actions = await getPendingActions();
  return actions.filter((a) => a.emailId === emailId);
}
