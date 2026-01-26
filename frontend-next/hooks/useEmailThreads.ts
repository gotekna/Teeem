"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { api } from "@/lib/api";

export type ThreadSortOption = "date_asc" | "date_desc" | "sender_asc" | "sender_desc";

export const THREAD_SORT_OPTIONS: { value: ThreadSortOption; label: string }[] = [
  { value: "date_asc", label: "Oldest first" },
  { value: "date_desc", label: "Newest first" },
  { value: "sender_asc", label: "Sender A-Z" },
  { value: "sender_desc", label: "Sender Z-A" },
];

export interface ThreadEmail {
  id: number;
  subject: string;
  from_email: string;
  from_name: string | null;
  from_address: string;
  received_at: string;
  snippet: string;
  body_preview: string | null;
  body_html: string | null;
  body_text: string | null;
  is_read: boolean;
  has_attachments: boolean;
  conversation_id?: string;
}

interface EmailWithThread {
  id: number;
  thread?: ThreadEmail[];
  conversation_id?: string;
}

export interface UseEmailThreadsReturn {
  /** Set of expanded conversation IDs */
  expandedThreads: Set<string>;
  /** Toggle thread expansion */
  toggleThread: (conversationId: string) => void;
  /** Expand a specific thread */
  expandThread: (conversationId: string) => void;
  /** Collapse a specific thread */
  collapseThread: (conversationId: string) => void;
  /** Collapse all expanded threads */
  collapseAll: () => void;
  /** Check if a thread is expanded */
  isExpanded: (conversationId: string) => boolean;

  /** Fetch full thread for an email */
  fetchThread: (emailId: number) => Promise<ThreadEmail[]>;
  /** Cache of fetched threads by conversation ID */
  threadCache: Map<string, ThreadEmail[]>;
  /** Set of conversation IDs currently loading */
  loadingThreads: Set<string>;
  /** Check if a thread is loading */
  isLoading: (conversationId: string) => boolean;
  /** Get cached thread emails */
  getThread: (conversationId: string) => ThreadEmail[] | undefined;

  /** Current thread sort option */
  sortOption: ThreadSortOption;
  /** Set thread sort option */
  setSortOption: (option: ThreadSortOption) => void;
}

/**
 * Hook for managing email thread expansion state and fetching
 *
 * Usage:
 * const { expandedThreads, toggleThread, fetchThread, getThread } = useEmailThreads();
 *
 * // Toggle thread expansion
 * const handleThreadClick = async (email: Email) => {
 *   if (email.thread_count > 1) {
 *     toggleThread(email.conversation_id);
 *     if (!getThread(email.conversation_id)) {
 *       await fetchThread(email.id);
 *     }
 *   }
 * };
 */
export function useEmailThreads(): UseEmailThreadsReturn {
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [threadCache, setThreadCache] = useState<Map<string, ThreadEmail[]>>(new Map());
  const [loadingThreads, setLoadingThreads] = useState<Set<string>>(new Set());
  const [sortOption, setSortOption] = useState<ThreadSortOption>("date_asc");

  // Sort function based on current option
  const sortThreadEmails = useCallback((emails: ThreadEmail[]): ThreadEmail[] => {
    return [...emails].sort((a, b) => {
      switch (sortOption) {
        case "date_asc":
          return new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
        case "date_desc":
          return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
        case "sender_asc":
          return (a.from_name || a.from_email).localeCompare(b.from_name || b.from_email);
        case "sender_desc":
          return (b.from_name || b.from_email).localeCompare(a.from_name || a.from_email);
        default:
          return 0;
      }
    });
  }, [sortOption]);

  // Re-sort cache when sort option changes
  useEffect(() => {
    if (threadCache.size > 0) {
      setThreadCache((prev) => {
        const next = new Map<string, ThreadEmail[]>();
        prev.forEach((emails, key) => {
          next.set(key, sortThreadEmails(emails));
        });
        return next;
      });
    }
  }, [sortOption, sortThreadEmails]);

  const toggleThread = useCallback((conversationId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  }, []);

  const expandThread = useCallback((conversationId: string) => {
    setExpandedThreads((prev) => {
      if (prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.add(conversationId);
      return next;
    });
  }, []);

  const collapseThread = useCallback((conversationId: string) => {
    setExpandedThreads((prev) => {
      if (!prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedThreads(new Set());
  }, []);

  const isExpanded = useCallback(
    (conversationId: string): boolean => expandedThreads.has(conversationId),
    [expandedThreads]
  );

  const isLoading = useCallback(
    (conversationId: string): boolean => loadingThreads.has(conversationId),
    [loadingThreads]
  );

  const getThread = useCallback(
    (conversationId: string): ThreadEmail[] | undefined => threadCache.get(conversationId),
    [threadCache]
  );

  const fetchThread = useCallback(async (emailId: number): Promise<ThreadEmail[]> => {
    try {
      // Performance: Use thread_summary=true to fetch lightweight thread data (~70% smaller payload)
      // This returns only summary fields (no body_html/body_text) for thread emails
      // Bodies are fetched on-demand when user clicks to view individual email
      const response = await api.get<EmailWithThread | { email: EmailWithThread; thread?: ThreadEmail[]; thread_count?: number }>(
        `/api/v1/synced_emails/${emailId}?include_thread=true&thread_summary=true`
      );

      // Handle both wrapped and unwrapped response formats
      // thread_summary mode returns { email, thread, thread_count }
      const wrappedResponse = response as { email?: EmailWithThread; thread?: ThreadEmail[]; thread_count?: number };
      const emailData = wrappedResponse.email || response as EmailWithThread;
      const conversationId = emailData.conversation_id;
      // Use top-level thread for summary mode, or emailData.thread for full mode
      const thread = wrappedResponse.thread || emailData.thread || [];

      if (conversationId) {
        // Mark as loading
        setLoadingThreads((prev) => {
          const next = new Set(prev);
          next.add(conversationId);
          return next;
        });

        // Sort according to current sort option
        const sortedThread = sortThreadEmails(thread);

        // Cache the thread
        setThreadCache((prev) => {
          const next = new Map(prev);
          next.set(conversationId, sortedThread);
          return next;
        });

        // Remove loading state
        setLoadingThreads((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });

        return sortedThread;
      }

      return [];
    } catch (error) {
      console.error("Failed to fetch email thread:", error);
      return [];
    }
  }, [sortThreadEmails]);

  return {
    expandedThreads,
    toggleThread,
    expandThread,
    collapseThread,
    collapseAll,
    isExpanded,
    fetchThread,
    threadCache,
    loadingThreads,
    isLoading,
    getThread,
    sortOption,
    setSortOption,
  };
}

export default useEmailThreads;
