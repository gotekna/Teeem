/**
 * Document Offline Sync Hook
 *
 * Provides functionality for supervisors to sync all documents
 * for their assigned active jobs for offline access.
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
// API Types
// =============================================================================

interface JobDocument {
  id: number;
  file_name: string;
  display_name?: string;
  file_size?: number;
  mime_type?: string;
  folder?: string;
  document_type?: string;
  storage_item_id?: string;
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
      const response = await api.get<{
        success: boolean;
        items?: JobDocument[];
        documents?: JobDocument[];
      }>(`/api/v1/documents/job_all_files?job_id=${jobId}`);

      const documents = response?.items || response?.documents || [];

      // Filter to syncable documents (skip very large files)
      const syncableDocuments = documents.filter(doc => {
        const size = doc.file_size || 0;
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
      for (const doc of syncableDocuments) {
        try {
          setSyncProgress(prev => prev ? {
            ...prev,
            currentDocument: doc.display_name || doc.file_name,
          } : null);

          // Fetch the document blob
          const previewResponse = await api.get<{
            success: boolean;
            preview_url?: string;
            download_url?: string;
          }>(`/api/v1/job_documents/${doc.id}/preview`);

          const downloadUrl = previewResponse?.preview_url || previewResponse?.download_url;

          if (downloadUrl) {
            // Fetch the actual file
            const blobResponse = await fetch(downloadUrl);
            if (blobResponse.ok) {
              const blob = await blobResponse.blob();

              // Store in cache
              await setDocumentInCache(
                jobId,
                doc.id,
                doc.file_name,
                doc.display_name || doc.file_name,
                doc.mime_type || blob.type || "application/octet-stream",
                blob,
                doc.folder,
                doc.document_type
              );

              totalSizeBytes += blob.size;
              completed++;
            } else {
              failed++;
              console.warn(`[DocumentSync] Failed to fetch ${doc.file_name}:`, blobResponse.status);
            }
          } else {
            failed++;
            console.warn(`[DocumentSync] No download URL for ${doc.file_name}`);
          }
        } catch (docError) {
          failed++;
          console.warn(`[DocumentSync] Error syncing ${doc.file_name}:`, docError);
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
