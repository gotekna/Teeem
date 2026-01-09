/**
 * Email Cache - Offline-First Email Architecture
 *
 * This module provides IndexedDB-based caching for emails to enable:
 * - Instant page loads (never blocks on network)
 * - Offline read access to cached emails
 * - Offline mutations (star, mark read, archive)
 * - Background sync with stale-while-revalidate pattern
 *
 * SSoT: This module is THE source for all email caching logic.
 *
 * @example
 * ```tsx
 * import { emailCache, isIndexedDBAvailable } from '@/lib/email-cache';
 *
 * // Check browser support
 * if (isIndexedDBAvailable()) {
 *   // Get cached emails for a category
 *   const emails = await emailCache.getEmailsByCategory('vip');
 *
 *   // Queue an offline action
 *   await emailCache.queueOfflineAction('star', emailId);
 * }
 * ```
 */

// =============================================================================
// Re-exports from types
// =============================================================================

export type {
  CachedEmail,
  CachedEmailContent,
  CategoryMeta,
  OfflineAction,
  OfflineActionType,
  SyncMeta,
  SyncMetaKey,
  EmailCacheOperations,
} from "./types";

export { CACHE_CONFIG } from "./types";

// =============================================================================
// Re-exports from database
// =============================================================================

export {
  getDatabase,
  closeDatabase,
  deleteDatabase,
  isIndexedDBAvailable,
} from "./database";

// =============================================================================
// Re-exports from stores
// =============================================================================

// Email operations
export {
  getEmailsByCategory,
  getAllEmails,
  getEmail,
  putEmail,
  putEmails,
  updateEmail,
  deleteEmail,
  deleteEmails,
  clearEmails,
  getEmailCountByCategory,
  getUnreadCountByCategory,
  getEmailContent,
  putEmailContent,
  clearEmailContent,
  isEmailStale,
  getOldestCacheTime,
  pruneEmailsByCategory,
} from "./stores/emails";

// Split inbox operations
export {
  getCategoryMeta,
  getAllCategoryMeta,
  setCategoryMeta,
  setAllCategoryMeta,
  isCategoryStale,
  isAnyCategoryStale,
  getCategoryCounts,
  getUnreadCounts,
  clearCategoryMeta,
  getSyncMeta,
  setSyncMeta,
  getLastSync,
  setLastSync,
  clearSyncMeta,
  queueOfflineAction,
  getPendingActions,
  getPendingActionCount,
  getOfflineAction,
  updateOfflineAction,
  removeOfflineAction,
  clearOfflineActions,
  hasPendingActionsForEmail,
  getPendingActionsForEmail,
} from "./stores/split-inbox";

// =============================================================================
// Convenience namespace export
// =============================================================================

import * as emails from "./stores/emails";
import * as splitInbox from "./stores/split-inbox";
import * as database from "./database";

/**
 * Unified email cache operations namespace.
 * Use this for cleaner imports when using multiple operations.
 *
 * @example
 * ```tsx
 * import { emailCache } from '@/lib/email-cache';
 *
 * const emails = await emailCache.getEmailsByCategory('vip');
 * await emailCache.queueOfflineAction('star', emailId);
 * ```
 */
export const emailCache = {
  // Database
  getDatabase: database.getDatabase,
  closeDatabase: database.closeDatabase,
  deleteDatabase: database.deleteDatabase,
  isIndexedDBAvailable: database.isIndexedDBAvailable,

  // Emails
  getEmailsByCategory: emails.getEmailsByCategory,
  getAllEmails: emails.getAllEmails,
  getEmail: emails.getEmail,
  putEmail: emails.putEmail,
  putEmails: emails.putEmails,
  updateEmail: emails.updateEmail,
  deleteEmail: emails.deleteEmail,
  deleteEmails: emails.deleteEmails,
  clearEmails: emails.clearEmails,
  getEmailCountByCategory: emails.getEmailCountByCategory,
  getUnreadCountByCategory: emails.getUnreadCountByCategory,
  getEmailContent: emails.getEmailContent,
  putEmailContent: emails.putEmailContent,
  clearEmailContent: emails.clearEmailContent,
  isEmailStale: emails.isEmailStale,
  getOldestCacheTime: emails.getOldestCacheTime,
  pruneEmailsByCategory: emails.pruneEmailsByCategory,

  // Split inbox
  getCategoryMeta: splitInbox.getCategoryMeta,
  getAllCategoryMeta: splitInbox.getAllCategoryMeta,
  setCategoryMeta: splitInbox.setCategoryMeta,
  setAllCategoryMeta: splitInbox.setAllCategoryMeta,
  isCategoryStale: splitInbox.isCategoryStale,
  isAnyCategoryStale: splitInbox.isAnyCategoryStale,
  getCategoryCounts: splitInbox.getCategoryCounts,
  getUnreadCounts: splitInbox.getUnreadCounts,
  clearCategoryMeta: splitInbox.clearCategoryMeta,

  // Sync
  getSyncMeta: splitInbox.getSyncMeta,
  setSyncMeta: splitInbox.setSyncMeta,
  getLastSync: splitInbox.getLastSync,
  setLastSync: splitInbox.setLastSync,
  clearSyncMeta: splitInbox.clearSyncMeta,

  // Offline actions
  queueOfflineAction: splitInbox.queueOfflineAction,
  getPendingActions: splitInbox.getPendingActions,
  getPendingActionCount: splitInbox.getPendingActionCount,
  getOfflineAction: splitInbox.getOfflineAction,
  updateOfflineAction: splitInbox.updateOfflineAction,
  removeOfflineAction: splitInbox.removeOfflineAction,
  clearOfflineActions: splitInbox.clearOfflineActions,
  hasPendingActionsForEmail: splitInbox.hasPendingActionsForEmail,
  getPendingActionsForEmail: splitInbox.getPendingActionsForEmail,

  /**
   * Clear all cached data (emails, content, metadata, actions).
   * Use on logout or when user requests cache clear.
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      emails.clearEmails(),
      emails.clearEmailContent(),
      splitInbox.clearCategoryMeta(),
      splitInbox.clearSyncMeta(),
      splitInbox.clearOfflineActions(),
    ]);
  },
};

export default emailCache;
