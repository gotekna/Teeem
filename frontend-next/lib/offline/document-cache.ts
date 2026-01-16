/**
 * Document Offline Cache
 *
 * IndexedDB storage for document blobs to enable offline viewing.
 * Supervisors can sync all documents for their assigned active jobs.
 *
 * Architecture:
 * - Stores document metadata + blob data
 * - Organized by job (sync all docs for a job at once)
 * - 7-day TTL for offline access
 * - Tracks sync progress per job
 *
 * SSoT: Documents fetched via /api/v1/documents/job_all_files
 * (which reads from WarehouseDocument/JobDocument - the data warehouse)
 *
 * Works on all devices: phones, tablets, laptops via PWA
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";

// =============================================================================
// Configuration
// =============================================================================

const DB_NAME = "teeem-document-cache";
const DB_VERSION = 1;
const DOCUMENTS_STORE = "documents";
const JOBS_STORE = "syncedJobs";

// TTL: 7 days for offline document access
export const DOCUMENT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Max size per document (10MB - larger files skip caching)
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

// =============================================================================
// Types
// =============================================================================

export interface CachedDocument {
  /** Unique key: "job-{jobId}-doc-{docId}" */
  cacheKey: string;
  /** Job this document belongs to */
  jobId: number;
  /** Document ID (from warehouse or job_documents) */
  documentId: number | string;
  /** Original filename */
  fileName: string;
  /** Display name (user-friendly) */
  displayName: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  fileSize: number;
  /** The actual file blob */
  blob: Blob;
  /** Folder/category */
  folder?: string;
  /** Document type */
  documentType?: string;
  /** Timestamp when cached */
  cachedAt: number;
  /** When cache expires */
  expiresAt: number;
}

export interface SyncedJobInfo {
  /** Job ID */
  jobId: number;
  /** Job code (e.g., "J-001") */
  jobCode: string;
  /** Job name */
  jobName: string;
  /** Number of documents synced */
  documentCount: number;
  /** Total size of synced documents */
  totalSizeBytes: number;
  /** When sync started */
  syncStartedAt: number;
  /** When sync completed (null if in progress) */
  syncCompletedAt: number | null;
  /** Sync status */
  status: "syncing" | "completed" | "error" | "partial";
  /** Error message if failed */
  errorMessage?: string;
  /** Last successful sync */
  lastSyncedAt: number;
}

interface DocumentCacheDB extends DBSchema {
  documents: {
    key: string;
    value: CachedDocument;
    indexes: {
      "by-jobId": number;
      "by-cachedAt": number;
    };
  };
  syncedJobs: {
    key: number; // jobId
    value: SyncedJobInfo;
    indexes: {
      "by-lastSynced": number;
    };
  };
}

// =============================================================================
// Database Singleton
// =============================================================================

let dbPromise: Promise<IDBPDatabase<DocumentCacheDB>> | null = null;

async function getDatabase(): Promise<IDBPDatabase<DocumentCacheDB>> {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is not available in server-side rendering");
  }

  if (!dbPromise) {
    dbPromise = openDB<DocumentCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        console.log(`[DocumentCache] Upgrading database from v${oldVersion} to v${DB_VERSION}`);

        if (oldVersion < 1) {
          // Documents store
          const docStore = db.createObjectStore(DOCUMENTS_STORE, { keyPath: "cacheKey" });
          docStore.createIndex("by-jobId", "jobId");
          docStore.createIndex("by-cachedAt", "cachedAt");

          // Synced jobs store
          const jobsStore = db.createObjectStore(JOBS_STORE, { keyPath: "jobId" });
          jobsStore.createIndex("by-lastSynced", "lastSyncedAt");

          console.log("[DocumentCache] Created documents and syncedJobs stores");
        }
      },
      blocked() {
        console.warn("[DocumentCache] Database blocked - another tab may be using an older version");
      },
      blocking() {
        console.warn("[DocumentCache] This tab is blocking a database upgrade in another tab");
      },
      terminated() {
        console.error("[DocumentCache] Database connection terminated unexpectedly");
        dbPromise = null;
      },
    });
  }

  return dbPromise;
}

export function isDocumentCacheAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.indexedDB;
  } catch {
    return false;
  }
}

// =============================================================================
// Cache Key Generation
// =============================================================================

export function getDocumentCacheKey(jobId: number, documentId: number | string): string {
  return `job-${jobId}-doc-${documentId}`;
}

// =============================================================================
// Document Cache Operations
// =============================================================================

/**
 * Get a cached document by job ID and document ID
 */
export async function getDocumentFromCache(
  jobId: number,
  documentId: number | string
): Promise<CachedDocument | null> {
  if (!isDocumentCacheAvailable()) return null;

  try {
    const db = await getDatabase();
    const cacheKey = getDocumentCacheKey(jobId, documentId);
    const data = await db.get(DOCUMENTS_STORE, cacheKey);

    if (!data) {
      return null;
    }

    // Check TTL
    if (Date.now() > data.expiresAt) {
      await db.delete(DOCUMENTS_STORE, cacheKey);
      console.log(`[DocumentCache] EXPIRED: ${cacheKey}`);
      return null;
    }

    console.log(`[DocumentCache] HIT: ${data.fileName} (${formatBytes(data.fileSize)})`);
    return data;
  } catch (error) {
    console.warn("[DocumentCache] Failed to read:", error);
    return null;
  }
}

/**
 * Store a document in cache
 */
export async function setDocumentInCache(
  jobId: number,
  documentId: number | string,
  fileName: string,
  displayName: string,
  mimeType: string,
  blob: Blob,
  folder?: string,
  documentType?: string
): Promise<void> {
  if (!isDocumentCacheAvailable()) return;

  // Skip large files
  if (blob.size > MAX_DOCUMENT_SIZE_BYTES) {
    console.log(`[DocumentCache] SKIP: ${fileName} too large (${formatBytes(blob.size)})`);
    return;
  }

  try {
    const db = await getDatabase();
    const cacheKey = getDocumentCacheKey(jobId, documentId);
    const now = Date.now();

    const data: CachedDocument = {
      cacheKey,
      jobId,
      documentId,
      fileName,
      displayName,
      mimeType,
      fileSize: blob.size,
      blob,
      folder,
      documentType,
      cachedAt: now,
      expiresAt: now + DOCUMENT_CACHE_TTL_MS,
    };

    await db.put(DOCUMENTS_STORE, data);
    console.log(`[DocumentCache] SET: ${fileName} (${formatBytes(blob.size)})`);
  } catch (error) {
    console.warn("[DocumentCache] Failed to write:", error);
  }
}

/**
 * Delete a cached document
 */
export async function deleteDocumentFromCache(
  jobId: number,
  documentId: number | string
): Promise<void> {
  if (!isDocumentCacheAvailable()) return;

  try {
    const db = await getDatabase();
    const cacheKey = getDocumentCacheKey(jobId, documentId);
    await db.delete(DOCUMENTS_STORE, cacheKey);
    console.log(`[DocumentCache] DELETED: ${cacheKey}`);
  } catch (error) {
    console.warn("[DocumentCache] Failed to delete:", error);
  }
}

/**
 * Get all cached documents for a job
 */
export async function getJobDocumentsFromCache(jobId: number): Promise<CachedDocument[]> {
  if (!isDocumentCacheAvailable()) return [];

  try {
    const db = await getDatabase();
    const all = await db.getAllFromIndex(DOCUMENTS_STORE, "by-jobId", jobId);
    const now = Date.now();

    // Filter out expired entries
    return all.filter(entry => now <= entry.expiresAt);
  } catch (error) {
    console.warn("[DocumentCache] Failed to get job documents:", error);
    return [];
  }
}

/**
 * Delete all cached documents for a job
 */
export async function clearJobDocumentsFromCache(jobId: number): Promise<number> {
  if (!isDocumentCacheAvailable()) return 0;

  try {
    const db = await getDatabase();
    const tx = db.transaction(DOCUMENTS_STORE, "readwrite");
    const index = tx.store.index("by-jobId");
    let cursor = await index.openCursor(jobId);
    let deletedCount = 0;

    while (cursor) {
      await cursor.delete();
      deletedCount++;
      cursor = await cursor.continue();
    }

    await tx.done;
    console.log(`[DocumentCache] Cleared ${deletedCount} documents for job ${jobId}`);
    return deletedCount;
  } catch (error) {
    console.warn("[DocumentCache] Failed to clear job documents:", error);
    return 0;
  }
}

// =============================================================================
// Synced Jobs Operations
// =============================================================================

/**
 * Get sync info for a job
 */
export async function getSyncedJobInfo(jobId: number): Promise<SyncedJobInfo | null> {
  if (!isDocumentCacheAvailable()) return null;

  try {
    const db = await getDatabase();
    return await db.get(JOBS_STORE, jobId) || null;
  } catch (error) {
    console.warn("[DocumentCache] Failed to get synced job info:", error);
    return null;
  }
}

/**
 * Update sync info for a job
 */
export async function updateSyncedJobInfo(info: SyncedJobInfo): Promise<void> {
  if (!isDocumentCacheAvailable()) return;

  try {
    const db = await getDatabase();
    await db.put(JOBS_STORE, info);
  } catch (error) {
    console.warn("[DocumentCache] Failed to update synced job info:", error);
  }
}

/**
 * Get all synced jobs
 */
export async function getAllSyncedJobs(): Promise<SyncedJobInfo[]> {
  if (!isDocumentCacheAvailable()) return [];

  try {
    const db = await getDatabase();
    return await db.getAll(JOBS_STORE);
  } catch (error) {
    console.warn("[DocumentCache] Failed to get all synced jobs:", error);
    return [];
  }
}

/**
 * Remove a job from synced jobs (and its documents)
 */
export async function removeSyncedJob(jobId: number): Promise<void> {
  if (!isDocumentCacheAvailable()) return;

  try {
    const db = await getDatabase();

    // Delete job info
    await db.delete(JOBS_STORE, jobId);

    // Delete all documents for this job
    await clearJobDocumentsFromCache(jobId);

    console.log(`[DocumentCache] Removed synced job ${jobId}`);
  } catch (error) {
    console.warn("[DocumentCache] Failed to remove synced job:", error);
  }
}

// =============================================================================
// Cleanup & Stats
// =============================================================================

/**
 * Clean up expired cache entries
 */
export async function cleanupDocumentCache(): Promise<number> {
  if (!isDocumentCacheAvailable()) return 0;

  try {
    const db = await getDatabase();
    const now = Date.now();
    let deletedCount = 0;

    const tx = db.transaction(DOCUMENTS_STORE, "readwrite");
    let cursor = await tx.store.openCursor();

    while (cursor) {
      if (now > cursor.value.expiresAt) {
        await cursor.delete();
        deletedCount++;
      }
      cursor = await cursor.continue();
    }

    await tx.done;

    if (deletedCount > 0) {
      console.log(`[DocumentCache] Cleaned up ${deletedCount} expired documents`);
    }

    return deletedCount;
  } catch (error) {
    console.warn("[DocumentCache] Failed to cleanup:", error);
    return 0;
  }
}

/**
 * Clear all document cache data
 */
export async function clearDocumentCache(): Promise<void> {
  if (!isDocumentCacheAvailable()) return;

  try {
    const db = await getDatabase();
    await db.clear(DOCUMENTS_STORE);
    await db.clear(JOBS_STORE);
    console.log("[DocumentCache] ALL CLEARED");
  } catch (error) {
    console.warn("[DocumentCache] Failed to clear:", error);
  }
}

/**
 * Get cache statistics
 */
export async function getDocumentCacheStats(): Promise<{
  documentCount: number;
  jobCount: number;
  totalSizeBytes: number;
  totalSizeDisplay: string;
  oldestAge: number | null;
}> {
  if (!isDocumentCacheAvailable()) {
    return {
      documentCount: 0,
      jobCount: 0,
      totalSizeBytes: 0,
      totalSizeDisplay: "0 KB",
      oldestAge: null,
    };
  }

  try {
    const db = await getDatabase();
    const allDocs = await db.getAll(DOCUMENTS_STORE);
    const allJobs = await db.getAll(JOBS_STORE);

    const totalSizeBytes = allDocs.reduce((sum, doc) => sum + doc.fileSize, 0);
    const oldestTimestamp = allDocs.length > 0
      ? Math.min(...allDocs.map(d => d.cachedAt))
      : null;

    return {
      documentCount: allDocs.length,
      jobCount: allJobs.length,
      totalSizeBytes,
      totalSizeDisplay: formatBytes(totalSizeBytes),
      oldestAge: oldestTimestamp ? Date.now() - oldestTimestamp : null,
    };
  } catch (error) {
    console.warn("[DocumentCache] Failed to get stats:", error);
    return {
      documentCount: 0,
      jobCount: 0,
      totalSizeBytes: 0,
      totalSizeDisplay: "0 KB",
      oldestAge: null,
    };
  }
}

// =============================================================================
// Utilities
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Create a blob URL for a cached document (for viewing)
 */
export function createBlobUrl(doc: CachedDocument): string {
  return URL.createObjectURL(doc.blob);
}

/**
 * Revoke a blob URL when done viewing
 */
export function revokeBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}
