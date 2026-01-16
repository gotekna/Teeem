/**
 * Document Offline Sync Hook
 *
 * Provides functionality for supervisors to sync all documents
 * for their assigned active jobs for offline access.
 *
 * SSoT Architecture:
 * - Document list: /api/v1/documents/job_all_files (WarehouseDocument/JobDocument)
 * - Download URL: Provided directly in job_all_files response (no separate API call)
 * - Storage: IndexedDB via document-cache.ts
 *
 * Works on all devices: phones, tablets, laptops via PWA
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { isOnlineAtom } from "./offline-atoms";
import { api } from "@/lib/api";
import {
  setDocumentInCache,
  getJobDocumentsFromCache,
  getSyncedJobInfo,
  updateSyncedJobInfo,
  getAllSyncedJobs,
  removeSyncedJob,
  getDocumentFromCache,
  getDocumentCacheStats,
  clearDocumentCache,
  MAX_DOCUMENT_SIZE_BYTES,
  type SyncedJobInfo,
  type CachedDocument,
} from "./document-cache";

// =============================================================================
// Types
// =============================================================================

export interface JobForSync {
  id: number;
  jobCode: string;
  name: string;
  /** Whether this job has been synced for offline */
  isSynced: boolean;
  /** Sync status if synced */
  syncInfo?: SyncedJobInfo;
}

export interface DocumentSyncProgress {
  jobId: number;
  jobName: string;
  total: number;
  completed: number;
  failed: number;
  currentDocument: string;
  status: "idle" | "syncing" | "completed" | "error";
  errorMessage?: string;
}

export interface UseDocumentOfflineSyncResult {
  /** Whether we're currently online */
  isOnline: boolean;
  /** List of supervisor's active jobs with sync status */
  jobs: JobForSync[];
  /** Loading state for jobs list */
  loadingJobs: boolean;
  /** Current sync progress (if syncing) */
  syncProgress: DocumentSyncProgress | null;
  /** Start syncing documents for a job */
  syncJob: (jobId: number) => Promise<void>;
  /** Remove synced data for a job */
  unsyncJob: (jobId: number) => Promise<void>;
  /** Sync all assigned jobs */
  syncAllJobs: () => Promise<void>;
  /** Get cached documents for a job */
  getCachedDocuments: (jobId: number) => Promise<CachedDocument[]>;
  /** Get a specific cached document */
  getCachedDocument: (jobId: number, documentId: number | string) => Promise<CachedDocument | null>;
  /** Cache statistics */
  cacheStats: {
    documentCount: number;
    jobCount: number;
    totalSizeDisplay: string;
  };
  /** Refresh jobs list */
  refreshJobs: () => Promise<void>;
  /** Clear all cached documents */
  clearAllCache: () => Promise<void>;
}

// =============================================================================
// API Types - Matches /api/v1/documents/job_all_files response (SSoT)
// =============================================================================

interface JobDocument {
  // IDs
  id: string;              // sharepoint_item_id
  document_id: number;     // JobDocument.id (database ID)
  // File info
  name: string;            // file_name
  original_name?: string;
  size?: number;           // file_size
  // URLs - SSoT: download_url is the one true way to download
  web_url?: string;
  download_url: string;    // Already includes auth, works for both SharePoint and S3
  thumbnail_url?: string;
  // Metadata
  folder_path?: string;
  document_type_name?: string;
  storage_provider?: string;
}

interface AssignedJob {
  id: number;
  job_code: string;
  name: string;
  title?: string;
}

// =============================================================================
// Hook
// =============================================================================

export function useDocumentOfflineSync(): UseDocumentOfflineSyncResult {
  const isOnline = useAtomValue(isOnlineAtom);

  const [jobs, setJobs] = useState<JobForSync[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [syncProgress, setSyncProgress] = useState<DocumentSyncProgress | null>(null);
  const [cacheStats, setCacheStats] = useState({
    documentCount: 0,
    jobCount: 0,
    totalSizeDisplay: "0 KB",
  });

  // Load supervisor's assigned jobs
  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      // Fetch supervisor's assigned active jobs
      const response = await api.get<{
        success: boolean;
        jobs?: AssignedJob[];
        records?: AssignedJob[];
      }>("/api/v1/jobs?filter[status]=active&filter[assigned_to_me]=true&per_page=50");

      const assignedJobs = response?.jobs || response?.records || [];

      // Get sync status for each job
      const syncedJobs = await getAllSyncedJobs();
      const syncedJobMap = new Map(syncedJobs.map(sj => [sj.jobId, sj]));

      const jobsWithStatus: JobForSync[] = assignedJobs.map(job => ({
        id: job.id,
        jobCode: job.job_code,
        name: job.name || job.title || `Job ${job.id}`,
        isSynced: syncedJobMap.has(job.id),
        syncInfo: syncedJobMap.get(job.id),
      }));

      setJobs(jobsWithStatus);
    } catch (error) {
      console.error("[DocumentSync] Failed to load jobs:", error);
      // Try to show cached jobs if offline
      if (!isOnline) {
        const syncedJobs = await getAllSyncedJobs();
        setJobs(syncedJobs.map(sj => ({
          id: sj.jobId,
          jobCode: sj.jobCode,
          name: sj.jobName,
          isSynced: true,
          syncInfo: sj,
        })));
      }
    } finally {
      setLoadingJobs(false);
    }
  }, [isOnline]);

  // Load cache stats
  const loadCacheStats = useCallback(async () => {
    const stats = await getDocumentCacheStats();
    setCacheStats({
      documentCount: stats.documentCount,
      jobCount: stats.jobCount,
      totalSizeDisplay: stats.totalSizeDisplay,
    });
  }, []);

  // Initial load
  useEffect(() => {
    loadJobs();
    loadCacheStats();
  }, [loadJobs, loadCacheStats]);

  // Sync documents for a single job
  const syncJob = useCallback(async (jobId: number) => {
    if (!isOnline) {
      console.warn("[DocumentSync] Cannot sync while offline");
      return;
    }

    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      console.error("[DocumentSync] Job not found:", jobId);
      return;
    }

    // Initialize progress
    setSyncProgress({
      jobId,
      jobName: job.name,
      total: 0,
      completed: 0,
      failed: 0,
      currentDocument: "Fetching document list...",
      status: "syncing",
    });

    // Update sync info to "syncing"
    const syncStartedAt = Date.now();
    await updateSyncedJobInfo({
      jobId,
      jobCode: job.jobCode,
      jobName: job.name,
      documentCount: 0,
      totalSizeBytes: 0,
      syncStartedAt,
      syncCompletedAt: null,
      status: "syncing",
      lastSyncedAt: syncStartedAt,
    });

    try {
      // Fetch documents for this job
      // SSoT: /api/v1/documents/job_all_files returns all document info including download_url
      const response = await api.get<{
        success: boolean;
        items?: JobDocument[];
      }>(`/api/v1/documents/job_all_files?job_id=${jobId}`);

      const documents = response?.items || [];

      // Filter to syncable documents (skip very large files)
      const syncableDocuments = documents.filter(doc => {
        const size = doc.size || 0;
        return size <= MAX_DOCUMENT_SIZE_BYTES;
      });

      setSyncProgress(prev => prev ? {
        ...prev,
        total: syncableDocuments.length,
        currentDocument: `Syncing ${syncableDocuments.length} documents...`,
      } : null);

      let completed = 0;
      let failed = 0;
      let totalSizeBytes = 0;

      // Download and cache each document
      // SSoT: Use download_url from job_all_files response - no separate API call needed
      for (const doc of syncableDocuments) {
        try {
          setSyncProgress(prev => prev ? {
            ...prev,
            currentDocument: doc.name,
          } : null);

          // SSoT: download_url is already provided by job_all_files endpoint
          // It handles auth and works for both SharePoint and S3 storage
          if (doc.download_url) {
            // Fetch the actual file blob
            const blobResponse = await fetch(doc.download_url);
            if (blobResponse.ok) {
              const blob = await blobResponse.blob();
              const contentType = blobResponse.headers.get("content-type") || blob.type || "application/octet-stream";

              // Store in cache using document_id (database ID) as the key
              await setDocumentInCache(
                jobId,
                doc.document_id,
                doc.name,
                doc.original_name || doc.name,
                contentType,
                blob,
                doc.folder_path,
                doc.document_type_name
              );

              totalSizeBytes += blob.size;
              completed++;
            } else {
              failed++;
              console.warn(`[DocumentSync] Failed to fetch ${doc.name}:`, blobResponse.status);
            }
          } else {
            failed++;
            console.warn(`[DocumentSync] No download URL for ${doc.name}`);
          }
        } catch (docError) {
          failed++;
          console.warn(`[DocumentSync] Error syncing ${doc.name}:`, docError);
        }

        // Update progress
        setSyncProgress(prev => prev ? {
          ...prev,
          completed,
          failed,
        } : null);
      }

      // Update sync info to completed
      const syncCompletedAt = Date.now();
      await updateSyncedJobInfo({
        jobId,
        jobCode: job.jobCode,
        jobName: job.name,
        documentCount: completed,
        totalSizeBytes,
        syncStartedAt,
        syncCompletedAt,
        status: failed > 0 && completed > 0 ? "partial" : failed > 0 ? "error" : "completed",
        lastSyncedAt: syncCompletedAt,
        errorMessage: failed > 0 ? `${failed} documents failed to sync` : undefined,
      });

      setSyncProgress(prev => prev ? {
        ...prev,
        status: "completed",
        currentDocument: `Synced ${completed} documents`,
      } : null);

      // Refresh jobs list and stats
      await loadJobs();
      await loadCacheStats();

    } catch (error) {
      console.error("[DocumentSync] Sync failed:", error);

      await updateSyncedJobInfo({
        jobId,
        jobCode: job.jobCode,
        jobName: job.name,
        documentCount: 0,
        totalSizeBytes: 0,
        syncStartedAt,
        syncCompletedAt: Date.now(),
        status: "error",
        lastSyncedAt: syncStartedAt,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      setSyncProgress(prev => prev ? {
        ...prev,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      } : null);
    }

    // Clear progress after a delay
    setTimeout(() => {
      setSyncProgress(null);
    }, 3000);
  }, [isOnline, jobs, loadJobs, loadCacheStats]);

  // Remove synced data for a job
  const unsyncJob = useCallback(async (jobId: number) => {
    await removeSyncedJob(jobId);
    await loadJobs();
    await loadCacheStats();
  }, [loadJobs, loadCacheStats]);

  // Sync all assigned jobs
  const syncAllJobs = useCallback(async () => {
    for (const job of jobs) {
      if (!job.isSynced) {
        await syncJob(job.id);
      }
    }
  }, [jobs, syncJob]);

  // Get cached documents for a job
  const getCachedDocuments = useCallback(async (jobId: number): Promise<CachedDocument[]> => {
    return getJobDocumentsFromCache(jobId);
  }, []);

  // Get a specific cached document
  const getCachedDocument = useCallback(async (
    jobId: number,
    documentId: number | string
  ): Promise<CachedDocument | null> => {
    return getDocumentFromCache(jobId, documentId);
  }, []);

  // Clear all cached documents
  const clearAllCache = useCallback(async () => {
    await clearDocumentCache();
    await loadJobs();
    await loadCacheStats();
  }, [loadJobs, loadCacheStats]);

  return {
    isOnline,
    jobs,
    loadingJobs,
    syncProgress,
    syncJob,
    unsyncJob,
    syncAllJobs,
    getCachedDocuments,
    getCachedDocument,
    cacheStats,
    refreshJobs: loadJobs,
    clearAllCache,
  };
}
