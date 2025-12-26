"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import {
  emailCache,
  isIndexedDBAvailable,
  CachedEmail,
  CachedEmailContent,
  CategoryMeta,
  OfflineAction,
  OfflineActionType,
  CACHE_CONFIG,
} from "@/lib/email-cache";
import type { SplitInboxCategory } from "@/components/emails/SplitInboxTabs";

interface UseEmailCacheResult {
  /**
   * Whether IndexedDB is available in this browser.
   */
  isAvailable: boolean;

  /**
   * Whether the cache is ready to use (database opened).
   */
  isReady: boolean;

  // Email operations
  getEmails: (category?: SplitInboxCategory) => Promise<CachedEmail[]>;
  getEmail: (id: number) => Promise<CachedEmail | null>;
  addEmail: (email: CachedEmail) => Promise<void>;
  addEmails: (emails: CachedEmail[]) => Promise<void>;
  updateEmail: (id: number, changes: Partial<CachedEmail>) => Promise<void>;
  deleteEmail: (id: number) => Promise<void>;

  // Email content
  getEmailContent: (id: number) => Promise<CachedEmailContent | null>;
  cacheEmailContent: (content: CachedEmailContent) => Promise<void>;

  // Category operations
  getCategoryMeta: (category: SplitInboxCategory) => Promise<CategoryMeta | null>;
  setCategoryMeta: (meta: CategoryMeta) => Promise<void>;
  getCounts: () => Promise<Record<SplitInboxCategory, number>>;
  getUnreadCounts: () => Promise<Record<SplitInboxCategory, number>>;
  isCategoryStale: (category: SplitInboxCategory) => Promise<boolean>;

  // Sync operations
  getLastSync: () => Promise<number | null>;
  setLastSync: (timestamp?: number) => Promise<void>;

  // Offline actions
  queueAction: (action: OfflineActionType, emailId: number, payload?: Record<string, unknown>) => Promise<string>;
  getPendingActions: () => Promise<OfflineAction[]>;
  getPendingCount: () => Promise<number>;
  removeAction: (id: string) => Promise<void>;

  // Utilities
  clearAll: () => Promise<void>;
}

/**
 * Hook for low-level email cache operations.
 *
 * Provides direct access to IndexedDB operations for emails.
 * For most use cases, prefer useOfflineEmails which builds on this.
 *
 * @example
 * ```tsx
 * const cache = useEmailCache();
 *
 * // Get cached emails
 * const emails = await cache.getEmails('vip');
 *
 * // Check if category is stale
 * const stale = await cache.isCategoryStale('vip');
 * ```
 */
export function useEmailCache(): UseEmailCacheResult {
  const [isAvailable] = useState(() => isIndexedDBAvailable());
  const [isReady, setIsReady] = useState(false);
  const initRef = useRef(false);

  // Initialize database on mount
  useEffect(() => {
    if (!isAvailable || initRef.current) return;
    initRef.current = true;

    emailCache.getDatabase()
      .then(() => {
        setIsReady(true);
        console.log("[useEmailCache] Database ready");
      })
      .catch((err) => {
        console.error("[useEmailCache] Failed to initialize database:", err);
      });
  }, [isAvailable]);

  // Email operations
  const getEmails = useCallback(async (category?: SplitInboxCategory): Promise<CachedEmail[]> => {
    if (!isAvailable) return [];
    if (category) {
      return emailCache.getEmailsByCategory(category);
    }
    return emailCache.getAllEmails();
  }, [isAvailable]);

  const getEmail = useCallback(async (id: number): Promise<CachedEmail | null> => {
    if (!isAvailable) return null;
    return emailCache.getEmail(id);
  }, [isAvailable]);

  const addEmail = useCallback(async (email: CachedEmail): Promise<void> => {
    if (!isAvailable) return;
    await emailCache.putEmail(email);
  }, [isAvailable]);

  const addEmails = useCallback(async (emails: CachedEmail[]): Promise<void> => {
    if (!isAvailable) return;
    await emailCache.putEmails(emails);
  }, [isAvailable]);

  const updateEmail = useCallback(async (id: number, changes: Partial<CachedEmail>): Promise<void> => {
    if (!isAvailable) return;
    await emailCache.updateEmail(id, changes);
  }, [isAvailable]);

  const deleteEmail = useCallback(async (id: number): Promise<void> => {
    if (!isAvailable) return;
    await emailCache.deleteEmail(id);
  }, [isAvailable]);

  // Email content
  const getEmailContent = useCallback(async (id: number): Promise<CachedEmailContent | null> => {
    if (!isAvailable) return null;
    return emailCache.getEmailContent(id);
  }, [isAvailable]);

  const cacheEmailContent = useCallback(async (content: CachedEmailContent): Promise<void> => {
    if (!isAvailable) return;
    await emailCache.putEmailContent(content);
  }, [isAvailable]);

  // Category operations
  const getCategoryMeta = useCallback(async (category: SplitInboxCategory): Promise<CategoryMeta | null> => {
    if (!isAvailable) return null;
    return emailCache.getCategoryMeta(category);
  }, [isAvailable]);

  const setCategoryMeta = useCallback(async (meta: CategoryMeta): Promise<void> => {
    if (!isAvailable) return;
    await emailCache.setCategoryMeta(meta);
  }, [isAvailable]);

  const getCounts = useCallback(async (): Promise<Record<SplitInboxCategory, number>> => {
    if (!isAvailable) return { vip: 0, team: 0, newsletters: 0, other: 0 };
    return emailCache.getCategoryCounts();
  }, [isAvailable]);

  const getUnreadCounts = useCallback(async (): Promise<Record<SplitInboxCategory, number>> => {
    if (!isAvailable) return { vip: 0, team: 0, newsletters: 0, other: 0 };
    return emailCache.getUnreadCounts();
  }, [isAvailable]);

  const isCategoryStale = useCallback(async (category: SplitInboxCategory): Promise<boolean> => {
    if (!isAvailable) return true;
    return emailCache.isCategoryStale(category);
  }, [isAvailable]);

  // Sync operations
  const getLastSync = useCallback(async (): Promise<number | null> => {
    if (!isAvailable) return null;
    return emailCache.getLastSync();
  }, [isAvailable]);

  const setLastSync = useCallback(async (timestamp?: number): Promise<void> => {
    if (!isAvailable) return;
    await emailCache.setLastSync(timestamp || Date.now());
  }, [isAvailable]);

  // Offline actions
  const queueAction = useCallback(async (
    action: OfflineActionType,
    emailId: number,
    payload?: Record<string, unknown>
  ): Promise<string> => {
    if (!isAvailable) return "";
    return emailCache.queueOfflineAction(action, emailId, payload);
  }, [isAvailable]);

  const getPendingActions = useCallback(async (): Promise<OfflineAction[]> => {
    if (!isAvailable) return [];
    return emailCache.getPendingActions();
  }, [isAvailable]);

  const getPendingCount = useCallback(async (): Promise<number> => {
    if (!isAvailable) return 0;
    return emailCache.getPendingActionCount();
  }, [isAvailable]);

  const removeAction = useCallback(async (id: string): Promise<void> => {
    if (!isAvailable) return;
    await emailCache.removeOfflineAction(id);
  }, [isAvailable]);

  // Utilities
  const clearAll = useCallback(async (): Promise<void> => {
    if (!isAvailable) return;
    await emailCache.clearAll();
  }, [isAvailable]);

  return {
    isAvailable,
    isReady,
    getEmails,
    getEmail,
    addEmail,
    addEmails,
    updateEmail,
    deleteEmail,
    getEmailContent,
    cacheEmailContent,
    getCategoryMeta,
    setCategoryMeta,
    getCounts,
    getUnreadCounts,
    isCategoryStale,
    getLastSync,
    setLastSync,
    queueAction,
    getPendingActions,
    getPendingCount,
    removeAction,
    clearAll,
  };
}

export default useEmailCache;
