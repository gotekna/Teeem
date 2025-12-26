"use client";

import { useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";

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
      // Fetch email with include_thread=true
      const response = await api.get<EmailWithThread | { email: EmailWithThread }>(
        `/api/v1/email_warehouse/${emailId}?include_thread=true`
      );

      // Handle both wrapped and unwrapped response formats
      const emailData = (response as { email?: EmailWithThread }).email || response as EmailWithThread;
      const conversationId = emailData.conversation_id;
      const thread = emailData.thread || [];

      if (conversationId) {
        // Mark as loading
        setLoadingThreads((prev) => {
          const next = new Set(prev);
          next.add(conversationId);
          return next;
        });

        // Sort by received_at (oldest first)
        const sortedThread = [...thread].sort(
          (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
        );

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
  }, []);

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
  };
}

export default useEmailThreads;
