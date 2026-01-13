"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { API_TIMEOUT_EMAIL_OFFLINE } from "@/lib/constants/timeout-constants";
import {
  emailCache,
  isIndexedDBAvailable,
  CachedEmail,
  CACHE_CONFIG,
} from "@/lib/email-cache";
import { useNetworkStatus } from "./useNetworkStatus";
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
  from_name: string;
  received_at: string;
  has_attachments: boolean;
  snippet: string;
  is_read: boolean;
  is_starred?: boolean;
  is_pinned?: boolean;
  is_archived?: boolean;
  job_id?: number;
  conversation_id?: string;
  thread_count?: number;
  is_latest_in_thread?: boolean;
}

interface UseOfflineEmailsOptions {
  /**
   * Whether to enable background fetching.
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to fetch immediately on mount (if stale).
   * @default true
   */
  fetchOnMount?: boolean;

  /**
   * Whether to fetch when window gains focus (if stale).
   * @default true
   */
  fetchOnFocus?: boolean;

  /**
   * Optional account ID to filter emails by.
   * If provided, only emails from this account are shown.
   */
  accountId?: string;
}

interface UseOfflineEmailsResult {
  /**
   * Emails for the selected category.
   */
  emails: CachedEmail[];

  /**
   * Counts for each category.
   */
  counts: Record<SplitInboxCategory, number>;

  /**
   * Unread counts for each category.
   */
  unreadCounts: Record<SplitInboxCategory, number>;

  /**
   * Currently selected category.
   */
  selectedCategory: SplitInboxCategory;

  /**
   * Change the selected category.
   */
  setSelectedCategory: (category: SplitInboxCategory) => void;

  /**
   * True during initial load from cache (very fast).
   */
  isLoading: boolean;

  /**
   * True during background API fetch.
   */
  isFetching: boolean;

  /**
   * True if showing cached data that may be outdated.
   */
  isStale: boolean;

  /**
   * When the data was last fetched from API.
   */
  lastFetched: Date | null;

  /**
   * Error from last fetch attempt (null if successful or no attempt).
   */
  error: Error | null;

  /**
   * Whether the browser is offline.
   */
  isOffline: boolean;

  /**
   * Whether IndexedDB caching is available.
   */
  isCacheAvailable: boolean;

  /**
   * Manually trigger a refresh (always fetches from API).
   */
  refresh: () => Promise<void>;

  /**
   * Team email domains from API.
   */
  teamDomains: string[];
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Main hook for offline-first email access.
 *
 * Features:
 * - Loads cached emails instantly (never blocks on network)
 * - Background fetches if data is stale (> 2 minutes)
 * - Shows stale indicator instead of errors on timeout
 * - Works offline (read cached emails)
 * - Syncs when back online
 *
 * @example
 * ```tsx
 * const {
 *   emails,
 *   counts,
 *   isStale,
 *   isOffline,
 *   refresh
 * } = useOfflineEmails();
 *
 * // Show stale indicator
 * {isStale && <StaleIndicator />}
 *
 * // Render emails (always available from cache)
 * {emails.map(email => <EmailRow key={email.id} email={email} />)}
 * ```
 */
export function useOfflineEmails(
  options: UseOfflineEmailsOptions = {}
): UseOfflineEmailsResult {
  const {
    enabled = true,
    fetchOnMount = true,
    fetchOnFocus = true,
    accountId,
  } = options;

  // State
  const [emails, setEmails] = useState<CachedEmail[]>([]);
  const [counts, setCounts] = useState<Record<SplitInboxCategory, number>>({
    vip: 0,
    team: 0,
    newsletters: 0,
    other: 0,
  });
  const [unreadCounts, setUnreadCounts] = useState<Record<SplitInboxCategory, number>>({
    vip: 0,
    team: 0,
    newsletters: 0,
    other: 0,
  });
  const [selectedCategory, setSelectedCategory] = useState<SplitInboxCategory>("vip");
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [teamDomains, setTeamDomains] = useState<string[]>([]);

  const isCacheAvailable = isIndexedDBAvailable();
  const { isOnline, wasOffline } = useNetworkStatus();
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load from cache
  const loadFromCache = useCallback(async () => {
    if (!isCacheAvailable) {
      setIsLoading(false);
      return;
    }

    try {
      // Load category meta for counts
      const allMeta = await emailCache.getAllCategoryMeta();

      const newCounts: Record<SplitInboxCategory, number> = {
        vip: allMeta.vip?.count ?? 0,
        team: allMeta.team?.count ?? 0,
        newsletters: allMeta.newsletters?.count ?? 0,
        other: allMeta.other?.count ?? 0,
      };

      const newUnreadCounts: Record<SplitInboxCategory, number> = {
        vip: allMeta.vip?.unread_count ?? 0,
        team: allMeta.team?.unread_count ?? 0,
        newsletters: allMeta.newsletters?.unread_count ?? 0,
        other: allMeta.other?.unread_count ?? 0,
      };

      // Load emails for selected category
      const cachedEmails = await emailCache.getEmailsByCategory(selectedCategory);

      // Check staleness
      const categoryMeta = allMeta[selectedCategory];
      const isDataStale = !categoryMeta ||
        Date.now() - categoryMeta.lastFetched > CACHE_CONFIG.STALE_THRESHOLD_MS;

      // Get last sync time
      const lastSync = await emailCache.getLastSync();

      if (mountedRef.current) {
        setCounts(newCounts);
        setUnreadCounts(newUnreadCounts);
        setEmails(cachedEmails);
        setIsStale(isDataStale);
        setLastFetched(lastSync ? new Date(lastSync) : null);
        setIsLoading(false);
      }

      return isDataStale;
    } catch (err) {
      console.error("[useOfflineEmails] Failed to load from cache:", err);
      setIsLoading(false);
      return true; // Treat as stale if cache fails
    }
  }, [isCacheAvailable, selectedCategory]);

  // Fetch from API and update cache
  const fetchFromAPI = useCallback(async () => {
    if (!enabled || fetchingRef.current) return;

    // Performance: Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    fetchingRef.current = true;
    setIsFetching(true);
    setError(null);

    try {
      // Build URL with optional account filter
      let url = "/api/v1/email_warehouse?split_inbox=true&my_emails=true&latest_only=true";

      // Add account filter if provided
      if (accountId) {
        if (accountId === "outlook") {
          url += "&source_type=outlook";
        } else if (accountId.startsWith("ms365_")) {
          // MS365 org accounts: extract microsoft_credential_id from "ms365_X_hash" format
          const parts = accountId.split("_");
          url += `&microsoft_credential_id=${parts[1]}`;
        } else {
          url += `&imap_credential_id=${accountId}`;
        }
      }

      // SSoT: Uses API_TIMEOUT_EMAIL_OFFLINE from timeout-constants.ts
      const response = await api.get<SplitInboxAPIResponse>(
        url,
        { timeout: API_TIMEOUT_EMAIL_OFFLINE }
      );

      // Check if request was aborted or component unmounted
      if (!mountedRef.current || abortControllerRef.current?.signal.aborted) return;

      const data = (response as SplitInboxAPIResponse).data;

      // Transform API emails to cached emails
      const now = Date.now();
      const allEmails: CachedEmail[] = [];

      for (const category of ["vip", "team", "newsletters", "other"] as SplitInboxCategory[]) {
        const categoryData = data.categories[category];
        const categoryEmails = categoryData.emails.map((email): CachedEmail => ({
          ...email,
          _cachedAt: now,
          _category: category,
        }));
        allEmails.push(...categoryEmails);
      }

      // Update cache
      if (isCacheAvailable) {
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

        // Update sync time
        await emailCache.setLastSync(now);
      }

      // Update state
      setCounts({
        vip: data.categories.vip.count,
        team: data.categories.team.count,
        newsletters: data.categories.newsletters.count,
        other: data.categories.other.count,
      });

      setUnreadCounts({
        vip: data.categories.vip.unread_count,
        team: data.categories.team.unread_count,
        newsletters: data.categories.newsletters.unread_count,
        other: data.categories.other.unread_count,
      });

      // Get emails for selected category
      const selectedEmails = data.categories[selectedCategory].emails.map((email): CachedEmail => ({
        ...email,
        _cachedAt: now,
        _category: selectedCategory,
      }));

      setEmails(selectedEmails);
      setTeamDomains(data.team_domains);
      setLastFetched(new Date(now));
      setIsStale(false);
      setError(null);

      console.log("[useOfflineEmails] Fetched and cached split inbox data");
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("[useOfflineEmails] API fetch failed:", err);

      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error("Failed to fetch emails"));
        // Don't clear existing data - show stale indicator instead
        setIsStale(true);
      }
    } finally {
      if (mountedRef.current) {
        setIsFetching(false);
      }
      fetchingRef.current = false;
    }
  }, [enabled, isCacheAvailable, selectedCategory, accountId]);

  // Manual refresh (always fetches)
  const refresh = useCallback(async () => {
    if (!isOnline) {
      console.log("[useOfflineEmails] Cannot refresh while offline");
      return;
    }
    await fetchFromAPI();
  }, [isOnline, fetchFromAPI]);

  // Refetch when account changes
  useEffect(() => {
    if (accountId && enabled && isOnline) {
      fetchFromAPI();
    }
  }, [accountId, enabled, isOnline, fetchFromAPI]);

  // Initial load from cache on mount
  useEffect(() => {
    mountedRef.current = true;

    loadFromCache().then((isDataStale) => {
      // If stale and online, fetch in background
      if (isDataStale && fetchOnMount && isOnline) {
        fetchFromAPI();
      }
    });

    return () => {
      mountedRef.current = false;
      // Cleanup: abort pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadFromCache, fetchOnMount, isOnline, fetchFromAPI]);

  // Reload emails when category changes
  useEffect(() => {
    if (!isCacheAvailable) return;

    emailCache.getEmailsByCategory(selectedCategory).then((cachedEmails) => {
      if (mountedRef.current) {
        setEmails(cachedEmails);
      }
    });
  }, [selectedCategory, isCacheAvailable]);

  // Fetch on window focus if stale
  useEffect(() => {
    if (!fetchOnFocus || !enabled) return;

    const handleFocus = async () => {
      if (!isOnline) return;

      const isDataStale = await emailCache.isAnyCategoryStale();
      if (isDataStale) {
        console.log("[useOfflineEmails] Window focused, data stale - refreshing");
        fetchFromAPI();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchOnFocus, enabled, isOnline, fetchFromAPI]);

  // Sync when coming back online
  useEffect(() => {
    if (wasOffline && enabled) {
      console.log("[useOfflineEmails] Back online - refreshing");
      fetchFromAPI();
    }
  }, [wasOffline, enabled, fetchFromAPI]);

  return {
    emails,
    counts,
    unreadCounts,
    selectedCategory,
    setSelectedCategory,
    isLoading,
    isFetching,
    isStale,
    lastFetched,
    error,
    isOffline: !isOnline,
    isCacheAvailable,
    refresh,
    teamDomains,
  };
}

export default useOfflineEmails;
