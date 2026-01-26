/**
 * Cached Document Hook
 *
 * Provides a document URL from cache when offline, or falls back to
 * the network URL when online.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { isOnlineAtom } from "./offline-atoms";
import {
  getDocumentFromCache,
  createBlobUrl,
  revokeBlobUrl,
  type CachedDocument,
} from "./document-cache";

export interface UseCachedDocumentOptions {
  /** Job ID the document belongs to */
  jobId: number;
  /** Document ID */
  documentId: number | string;
  /** Network URL to use when online */
  networkUrl?: string;
  /** Whether to prefer cache even when online */
  preferCache?: boolean;
}

export interface UseCachedDocumentResult {
  /** URL to use for viewing (blob URL when offline, network URL when online) */
  url: string | null;
  /** Whether the document is being served from cache */
  isFromCache: boolean;
  /** Whether we're currently online */
  isOnline: boolean;
  /** Whether the document is available offline */
  isAvailableOffline: boolean;
  /** Loading state */
  loading: boolean;
  /** Error message if failed to load */
  error: string | null;
  /** The cached document metadata (if available) */
  cachedDocument: CachedDocument | null;
  /** Manually refresh/reload the document */
  refresh: () => Promise<void>;
}

/**
 * Hook to get a viewable URL for a document, using cache when offline
 */
export function useCachedDocument(options: UseCachedDocumentOptions): UseCachedDocumentResult {
  const { jobId, documentId, networkUrl, preferCache = false } = options;
  const isOnline = useAtomValue(isOnlineAtom);

  const [url, setUrl] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isAvailableOffline, setIsAvailableOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedDocument, setCachedDocument] = useState<CachedDocument | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Load document URL
  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if document is in cache
      const cached = await getDocumentFromCache(jobId, documentId);
      setIsAvailableOffline(!!cached);
      setCachedDocument(cached);

      // Determine which URL to use
      if (!isOnline || (preferCache && cached)) {
        // Offline or preferring cache - use cached blob
        if (cached) {
          // Clean up previous blob URL
          if (blobUrl) {
            revokeBlobUrl(blobUrl);
          }

          const newBlobUrl = createBlobUrl(cached);
          setBlobUrl(newBlobUrl);
          setUrl(newBlobUrl);
          setIsFromCache(true);
        } else if (!isOnline) {
          // Offline but not cached
          setUrl(null);
          setIsFromCache(false);
          setError("Document not available offline");
        }
      } else {
        // Online - use network URL
        setUrl(networkUrl || null);
        setIsFromCache(false);
      }
    } catch (err) {
      console.error("[CachedDocument] Failed to load:", err);
      setError(err instanceof Error ? err.message : "Failed to load document");
      setUrl(null);
    } finally {
      setLoading(false);
    }
  }, [jobId, documentId, networkUrl, isOnline, preferCache, blobUrl]);

  // Load on mount and when dependencies change
  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        revokeBlobUrl(blobUrl);
      }
    };
  }, [blobUrl]);

  return {
    url,
    isFromCache,
    isOnline,
    isAvailableOffline,
    loading,
    error,
    cachedDocument,
    refresh: loadDocument,
  };
}

/**
 * Hook to check if a document is available offline (without loading the blob)
 */
export function useIsDocumentOffline(jobId: number, documentId: number | string): {
  isAvailableOffline: boolean;
  loading: boolean;
} {
  const [isAvailableOffline, setIsAvailableOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCache = async () => {
      setLoading(true);
      try {
        const cached = await getDocumentFromCache(jobId, documentId);
        setIsAvailableOffline(!!cached);
      } catch {
        setIsAvailableOffline(false);
      } finally {
        setLoading(false);
      }
    };

    checkCache();
  }, [jobId, documentId]);

  return { isAvailableOffline, loading };
}

/**
 * Open a cached document in a new tab
 * Returns true if successful, false if not available
 */
export async function openCachedDocument(
  jobId: number,
  documentId: number | string
): Promise<boolean> {
  try {
    const cached = await getDocumentFromCache(jobId, documentId);
    if (!cached) {
      console.warn("[CachedDocument] Document not in cache:", documentId);
      return false;
    }

    const blobUrl = createBlobUrl(cached);

    // Open in new tab
    const newWindow = window.open(blobUrl, "_blank");

    if (newWindow) {
      // Revoke blob URL after a delay (give browser time to load)
      setTimeout(() => {
        revokeBlobUrl(blobUrl);
      }, 60000); // 1 minute
      return true;
    } else {
      revokeBlobUrl(blobUrl);
      console.warn("[CachedDocument] Popup blocked");
      return false;
    }
  } catch (error) {
    console.error("[CachedDocument] Failed to open:", error);
    return false;
  }
}
