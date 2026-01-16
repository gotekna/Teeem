/**
 * Photo Offline Cache
 *
 * IndexedDB storage for photos taken offline.
 * Photos are stored immediately when captured and synced when back online.
 *
 * Architecture:
 * - Photos stored with metadata (job, task, timestamp, location)
 * - Sync queue tracks upload status
 * - Auto-compresses before storing (max 2MB)
 * - Syncs to backend when online via /api/v1/photos endpoint
 *
 * Works on all devices: phones, tablets, laptops via PWA
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";

// =============================================================================
// Configuration
// =============================================================================

const DB_NAME = "teeem-photo-cache";
const DB_VERSION = 1;
const PHOTOS_STORE = "photos";

// Max photo size after compression (2MB)
export const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

// Target dimensions for compression
const MAX_PHOTO_DIMENSION = 1920;

// JPEG quality for compression (0.8 = 80%)
const JPEG_QUALITY = 0.8;

// =============================================================================
// Types
// =============================================================================

export type PhotoSyncStatus = "pending" | "syncing" | "synced" | "error";

export interface PendingPhoto {
  /** Unique ID (UUID) */
  id: string;
  /** Job this photo belongs to */
  jobId: number;
  /** Task ID if associated with a task */
  taskId?: number;
  /** Task name for display */
  taskName?: string;
  /** Photo description/caption */
  caption?: string;
  /** MIME type (always image/jpeg after compression) */
  mimeType: string;
  /** File size in bytes */
  fileSize: number;
  /** The photo blob (compressed JPEG) */
  blob: Blob;
  /** Original filename */
  fileName: string;
  /** Timestamp when photo was taken */
  takenAt: number;
  /** GPS coordinates if available */
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  /** Sync status */
  syncStatus: PhotoSyncStatus;
  /** Number of sync attempts */
  syncAttempts: number;
  /** Last sync attempt timestamp */
  lastSyncAttempt?: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Server-side photo ID after successful sync */
  serverPhotoId?: number;
  /** Timestamp when synced */
  syncedAt?: number;
}

interface PhotoCacheDB extends DBSchema {
  photos: {
    key: string; // photo id
    value: PendingPhoto;
    indexes: {
      "by-jobId": number;
      "by-syncStatus": PhotoSyncStatus;
      "by-takenAt": number;
    };
  };
}

// =============================================================================
// Database
// =============================================================================

let dbInstance: IDBPDatabase<PhotoCacheDB> | null = null;

async function getDB(): Promise<IDBPDatabase<PhotoCacheDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PhotoCacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Photos store
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
        const store = db.createObjectStore(PHOTOS_STORE, { keyPath: "id" });
        store.createIndex("by-jobId", "jobId");
        store.createIndex("by-syncStatus", "syncStatus");
        store.createIndex("by-takenAt", "takenAt");
      }
    },
  });

  return dbInstance;
}

export function isPhotoCacheAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

// =============================================================================
// Photo Storage
// =============================================================================

/**
 * Generate unique photo ID
 */
function generatePhotoId(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate filename for photo
 */
function generateFileName(jobId: number, taskId?: number): string {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0];
  const timeStr = date.toTimeString().split(" ")[0].replace(/:/g, "-");
  const prefix = taskId ? `task-${taskId}` : `job-${jobId}`;
  return `${prefix}_${dateStr}_${timeStr}.jpg`;
}

/**
 * Compress image to JPEG with max dimensions
 */
export async function compressPhoto(
  blob: Blob,
  maxDimension: number = MAX_PHOTO_DIMENSION,
  quality: number = JPEG_QUALITY
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG blob
      canvas.toBlob(
        (compressedBlob) => {
          if (compressedBlob) {
            resolve(compressedBlob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Store a new photo in the cache
 */
export async function storePhoto(
  jobId: number,
  blob: Blob,
  options: {
    taskId?: number;
    taskName?: string;
    caption?: string;
    location?: { latitude: number; longitude: number; accuracy?: number };
  } = {}
): Promise<PendingPhoto> {
  if (!isPhotoCacheAvailable()) {
    throw new Error("Photo cache not available");
  }

  // Compress the photo
  let compressedBlob = blob;
  if (blob.type !== "image/jpeg" || blob.size > MAX_PHOTO_SIZE_BYTES) {
    compressedBlob = await compressPhoto(blob);
  }

  const photo: PendingPhoto = {
    id: generatePhotoId(),
    jobId,
    taskId: options.taskId,
    taskName: options.taskName,
    caption: options.caption,
    mimeType: "image/jpeg",
    fileSize: compressedBlob.size,
    blob: compressedBlob,
    fileName: generateFileName(jobId, options.taskId),
    takenAt: Date.now(),
    location: options.location,
    syncStatus: "pending",
    syncAttempts: 0,
  };

  const db = await getDB();
  await db.put(PHOTOS_STORE, photo);

  console.log(`[PhotoCache] Stored photo: ${photo.fileName} (${formatBytes(photo.fileSize)})`);
  return photo;
}

/**
 * Get a photo by ID
 */
export async function getPhoto(photoId: string): Promise<PendingPhoto | null> {
  if (!isPhotoCacheAvailable()) return null;

  const db = await getDB();
  const photo = await db.get(PHOTOS_STORE, photoId);
  return photo || null;
}

/**
 * Get all photos for a job
 */
export async function getJobPhotos(jobId: number): Promise<PendingPhoto[]> {
  if (!isPhotoCacheAvailable()) return [];

  const db = await getDB();
  return db.getAllFromIndex(PHOTOS_STORE, "by-jobId", jobId);
}

/**
 * Get all pending (unsynced) photos
 */
export async function getPendingPhotos(): Promise<PendingPhoto[]> {
  if (!isPhotoCacheAvailable()) return [];

  const db = await getDB();
  return db.getAllFromIndex(PHOTOS_STORE, "by-syncStatus", "pending");
}

/**
 * Get all photos with error status (for retry)
 */
export async function getErrorPhotos(): Promise<PendingPhoto[]> {
  if (!isPhotoCacheAvailable()) return [];

  const db = await getDB();
  return db.getAllFromIndex(PHOTOS_STORE, "by-syncStatus", "error");
}

/**
 * Update photo sync status
 */
export async function updatePhotoSyncStatus(
  photoId: string,
  status: PhotoSyncStatus,
  options: {
    errorMessage?: string;
    serverPhotoId?: number;
    syncedAt?: number;
  } = {}
): Promise<void> {
  if (!isPhotoCacheAvailable()) return;

  const db = await getDB();
  const photo = await db.get(PHOTOS_STORE, photoId);

  if (photo) {
    photo.syncStatus = status;
    photo.lastSyncAttempt = Date.now();
    photo.syncAttempts += 1;

    if (options.errorMessage) {
      photo.errorMessage = options.errorMessage;
    }
    if (options.serverPhotoId) {
      photo.serverPhotoId = options.serverPhotoId;
    }
    if (options.syncedAt) {
      photo.syncedAt = options.syncedAt;
    }

    await db.put(PHOTOS_STORE, photo);
  }
}

/**
 * Delete a photo from cache
 */
export async function deletePhoto(photoId: string): Promise<void> {
  if (!isPhotoCacheAvailable()) return;

  const db = await getDB();
  await db.delete(PHOTOS_STORE, photoId);
}

/**
 * Delete all synced photos (cleanup)
 */
export async function deleteSyncedPhotos(): Promise<number> {
  if (!isPhotoCacheAvailable()) return 0;

  const db = await getDB();
  const syncedPhotos = await db.getAllFromIndex(PHOTOS_STORE, "by-syncStatus", "synced");

  for (const photo of syncedPhotos) {
    await db.delete(PHOTOS_STORE, photo.id);
  }

  return syncedPhotos.length;
}

/**
 * Clear all photos from cache
 */
export async function clearPhotoCache(): Promise<void> {
  if (!isPhotoCacheAvailable()) return;

  const db = await getDB();
  await db.clear(PHOTOS_STORE);
}

// =============================================================================
// Statistics
// =============================================================================

export interface PhotoCacheStats {
  totalCount: number;
  pendingCount: number;
  syncingCount: number;
  syncedCount: number;
  errorCount: number;
  totalSizeBytes: number;
  totalSizeDisplay: string;
}

export async function getPhotoCacheStats(): Promise<PhotoCacheStats> {
  if (!isPhotoCacheAvailable()) {
    return {
      totalCount: 0,
      pendingCount: 0,
      syncingCount: 0,
      syncedCount: 0,
      errorCount: 0,
      totalSizeBytes: 0,
      totalSizeDisplay: "0 KB",
    };
  }

  const db = await getDB();
  const allPhotos = await db.getAll(PHOTOS_STORE);

  const stats = {
    totalCount: allPhotos.length,
    pendingCount: 0,
    syncingCount: 0,
    syncedCount: 0,
    errorCount: 0,
    totalSizeBytes: 0,
    totalSizeDisplay: "0 KB",
  };

  for (const photo of allPhotos) {
    stats.totalSizeBytes += photo.fileSize;

    switch (photo.syncStatus) {
      case "pending":
        stats.pendingCount++;
        break;
      case "syncing":
        stats.syncingCount++;
        break;
      case "synced":
        stats.syncedCount++;
        break;
      case "error":
        stats.errorCount++;
        break;
    }
  }

  stats.totalSizeDisplay = formatBytes(stats.totalSizeBytes);
  return stats;
}

// =============================================================================
// Utilities
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Create a blob URL for displaying a photo
 */
export function createPhotoBlobUrl(photo: PendingPhoto): string {
  return URL.createObjectURL(photo.blob);
}

/**
 * Revoke a blob URL when done
 */
export function revokePhotoBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}
