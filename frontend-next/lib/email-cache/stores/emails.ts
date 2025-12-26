/**
 * Email Store Operations
 *
 * CRUD operations for cached emails in IndexedDB.
 */

import { getDatabase } from "../database";
import { CachedEmail, CachedEmailContent, CACHE_CONFIG } from "../types";
import type { SplitInboxCategory } from "@/components/emails/SplitInboxTabs";

// =============================================================================
// Email List Operations
// =============================================================================

/**
 * Get all emails for a category, ordered by received_at descending.
 */
export async function getEmailsByCategory(
  category: SplitInboxCategory
): Promise<CachedEmail[]> {
  const db = await getDatabase();
  const emails = await db.getAllFromIndex("emails", "by-category", category);

  // Sort by received_at descending (newest first)
  return emails.sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  );
}

/**
 * Get all cached emails, regardless of category.
 */
export async function getAllEmails(): Promise<CachedEmail[]> {
  const db = await getDatabase();
  const emails = await db.getAll("emails");

  return emails.sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  );
}

/**
 * Get a single email by ID.
 */
export async function getEmail(id: number): Promise<CachedEmail | null> {
  const db = await getDatabase();
  const email = await db.get("emails", id);
  return email ?? null;
}

/**
 * Add or update a single email.
 */
export async function putEmail(email: CachedEmail): Promise<void> {
  const db = await getDatabase();
  await db.put("emails", {
    ...email,
    _cachedAt: email._cachedAt || Date.now(),
  });
}

/**
 * Add or update multiple emails in a transaction.
 * More efficient than individual puts.
 */
export async function putEmails(emails: CachedEmail[]): Promise<void> {
  if (emails.length === 0) return;

  const db = await getDatabase();
  const tx = db.transaction("emails", "readwrite");
  const store = tx.objectStore("emails");
  const now = Date.now();

  await Promise.all([
    ...emails.map((email) =>
      store.put({
        ...email,
        _cachedAt: email._cachedAt || now,
      })
    ),
    tx.done,
  ]);
}

/**
 * Update an existing email (partial update).
 */
export async function updateEmail(
  id: number,
  changes: Partial<CachedEmail>
): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction("emails", "readwrite");
  const store = tx.objectStore("emails");

  const existing = await store.get(id);
  if (existing) {
    await store.put({
      ...existing,
      ...changes,
      id, // Ensure ID is preserved
      _cachedAt: Date.now(),
    });
  }

  await tx.done;
}

/**
 * Delete a single email.
 */
export async function deleteEmail(id: number): Promise<void> {
  const db = await getDatabase();
  await db.delete("emails", id);
}

/**
 * Delete multiple emails.
 */
export async function deleteEmails(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  const db = await getDatabase();
  const tx = db.transaction("emails", "readwrite");

  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

/**
 * Clear all emails from the cache.
 */
export async function clearEmails(): Promise<void> {
  const db = await getDatabase();
  await db.clear("emails");
}

/**
 * Get count of cached emails by category.
 */
export async function getEmailCountByCategory(
  category: SplitInboxCategory
): Promise<number> {
  const db = await getDatabase();
  return db.countFromIndex("emails", "by-category", category);
}

/**
 * Get unread count for a category.
 */
export async function getUnreadCountByCategory(
  category: SplitInboxCategory
): Promise<number> {
  const emails = await getEmailsByCategory(category);
  return emails.filter((e) => !e.is_read).length;
}

// =============================================================================
// Email Content Operations (Detail View)
// =============================================================================

/**
 * Get cached email content (body, attachments).
 */
export async function getEmailContent(
  id: number
): Promise<CachedEmailContent | null> {
  const db = await getDatabase();
  const content = await db.get("emailContent", id);
  return content ?? null;
}

/**
 * Cache email content.
 */
export async function putEmailContent(content: CachedEmailContent): Promise<void> {
  const db = await getDatabase();

  // Enforce max cached content limit
  const allContent = await db.getAll("emailContent");
  if (allContent.length >= CACHE_CONFIG.MAX_EMAIL_CONTENT) {
    // Remove oldest content to make room
    const sorted = allContent.sort((a, b) => a._fetchedAt - b._fetchedAt);
    const toRemove = sorted.slice(0, allContent.length - CACHE_CONFIG.MAX_EMAIL_CONTENT + 1);

    const tx = db.transaction("emailContent", "readwrite");
    await Promise.all([
      ...toRemove.map((c) => tx.store.delete(c.id)),
      tx.store.put({
        ...content,
        _fetchedAt: content._fetchedAt || Date.now(),
      }),
      tx.done,
    ]);
  } else {
    await db.put("emailContent", {
      ...content,
      _fetchedAt: content._fetchedAt || Date.now(),
    });
  }
}

/**
 * Clear all email content from cache.
 */
export async function clearEmailContent(): Promise<void> {
  const db = await getDatabase();
  await db.clear("emailContent");
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if an email is stale (older than STALE_THRESHOLD_MS).
 */
export function isEmailStale(email: CachedEmail): boolean {
  if (!email._cachedAt) return true;
  return Date.now() - email._cachedAt > CACHE_CONFIG.STALE_THRESHOLD_MS;
}

/**
 * Get the oldest cached email timestamp for a category.
 */
export async function getOldestCacheTime(
  category: SplitInboxCategory
): Promise<number | null> {
  const emails = await getEmailsByCategory(category);
  if (emails.length === 0) return null;

  const times = emails.map((e) => e._cachedAt).filter((t): t is number => !!t);
  return times.length > 0 ? Math.min(...times) : null;
}

/**
 * Prune old emails to stay under the limit per category.
 */
export async function pruneEmailsByCategory(
  category: SplitInboxCategory
): Promise<number> {
  const emails = await getEmailsByCategory(category);

  if (emails.length <= CACHE_CONFIG.MAX_EMAILS_PER_CATEGORY) {
    return 0;
  }

  // Keep newest emails, remove oldest
  const toKeep = emails.slice(0, CACHE_CONFIG.MAX_EMAILS_PER_CATEGORY);
  const toRemove = emails.slice(CACHE_CONFIG.MAX_EMAILS_PER_CATEGORY);

  await deleteEmails(toRemove.map((e) => e.id));

  return toRemove.length;
}
