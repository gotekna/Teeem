/**
 * Photo Sync Service
 *
 * Handles uploading pending photos when back online.
 * Uses the existing sm_field photo upload endpoint as SSoT.
 *
 * SSoT: POST /api/v1/sm_field/tasks/:task_id/upload_photo
 * - Accepts base64 image_data
 * - Uploads to Cloudinary
 * - Auto-completes photo tasks
 *
 * Works on all devices: phones, tablets, laptops via PWA
 */

import { api } from "@/lib/api";
import {
  getPendingPhotos,
  getErrorPhotos,
  updatePhotoSyncStatus,
  deletePhoto,
  type PendingPhoto,
} from "./photo-cache";

// =============================================================================
// Configuration
// =============================================================================

// Max retry attempts before giving up
const MAX_SYNC_ATTEMPTS = 3;

// Delay between sync attempts (exponential backoff)
const SYNC_RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

// =============================================================================
// Types
// =============================================================================

export interface PhotoSyncResult {
  photoId: string;
  success: boolean;
  serverPhotoId?: number;
  error?: string;
  taskAutoCompleted?: boolean;
}

export interface PhotoSyncBatchResult {
  total: number;
  synced: number;
  failed: number;
  results: PhotoSyncResult[];
}

export interface PhotoSyncProgress {
  total: number;
  completed: number;
  failed: number;
  currentPhoto?: string;
  status: "idle" | "syncing" | "completed" | "error";
}

// =============================================================================
// Sync Functions
// =============================================================================

/**
 * Convert blob to base64 data URL
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Sync a single photo to the backend
 */
export async function syncPhoto(photo: PendingPhoto): Promise<PhotoSyncResult> {
  // If no task ID, we can't upload to the task endpoint
  // For now, photos must be associated with a task
  if (!photo.taskId) {
    return {
      photoId: photo.id,
      success: false,
      error: "Photo must be associated with a task to sync",
    };
  }

  try {
    // Mark as syncing
    await updatePhotoSyncStatus(photo.id, "syncing");

    // Convert blob to base64
    const base64Data = await blobToBase64(photo.blob);

    // Upload to backend using existing SSoT endpoint
    const response = await api.post<{
      success: boolean;
      photo?: { id: number };
      task_auto_completed?: boolean;
      errors?: string[];
    }>(`/api/v1/sm_field/tasks/${photo.taskId}/upload_photo`, {
      image_data: base64Data,
      caption: photo.caption,
      photo_type: "progress",
      // Include GPS if available
      ...(photo.location && {
        latitude: photo.location.latitude,
        longitude: photo.location.longitude,
      }),
    });

    if (response?.success) {
      // Mark as synced
      await updatePhotoSyncStatus(photo.id, "synced", {
        serverPhotoId: response.photo?.id,
        syncedAt: Date.now(),
      });

      console.log(`[PhotoSync] Synced photo ${photo.id} → server ID ${response.photo?.id}`);

      return {
        photoId: photo.id,
        success: true,
        serverPhotoId: response.photo?.id,
        taskAutoCompleted: response.task_auto_completed,
      };
    } else {
      const errorMsg = response?.errors?.join(", ") || "Upload failed";
      await updatePhotoSyncStatus(photo.id, "error", { errorMessage: errorMsg });

      return {
        photoId: photo.id,
        success: false,
        error: errorMsg,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await updatePhotoSyncStatus(photo.id, "error", { errorMessage: errorMsg });

    console.error(`[PhotoSync] Failed to sync photo ${photo.id}:`, error);

    return {
      photoId: photo.id,
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Sync all pending photos
 */
export async function syncAllPendingPhotos(
  onProgress?: (progress: PhotoSyncProgress) => void
): Promise<PhotoSyncBatchResult> {
  const pendingPhotos = await getPendingPhotos();

  const result: PhotoSyncBatchResult = {
    total: pendingPhotos.length,
    synced: 0,
    failed: 0,
    results: [],
  };

  if (pendingPhotos.length === 0) {
    onProgress?.({
      total: 0,
      completed: 0,
      failed: 0,
      status: "completed",
    });
    return result;
  }

  onProgress?.({
    total: pendingPhotos.length,
    completed: 0,
    failed: 0,
    status: "syncing",
  });

  for (const photo of pendingPhotos) {
    onProgress?.({
      total: pendingPhotos.length,
      completed: result.synced + result.failed,
      failed: result.failed,
      currentPhoto: photo.fileName,
      status: "syncing",
    });

    const syncResult = await syncPhoto(photo);
    result.results.push(syncResult);

    if (syncResult.success) {
      result.synced++;
    } else {
      result.failed++;
    }
  }

  onProgress?.({
    total: pendingPhotos.length,
    completed: result.synced + result.failed,
    failed: result.failed,
    status: "completed",
  });

  console.log(`[PhotoSync] Batch complete: ${result.synced} synced, ${result.failed} failed`);
  return result;
}

/**
 * Retry failed photos
 */
export async function retryFailedPhotos(
  onProgress?: (progress: PhotoSyncProgress) => void
): Promise<PhotoSyncBatchResult> {
  const errorPhotos = await getErrorPhotos();

  // Filter to photos that haven't exceeded max attempts
  const retryablePhotos = errorPhotos.filter(
    (photo) => photo.syncAttempts < MAX_SYNC_ATTEMPTS
  );

  const result: PhotoSyncBatchResult = {
    total: retryablePhotos.length,
    synced: 0,
    failed: 0,
    results: [],
  };

  if (retryablePhotos.length === 0) {
    return result;
  }

  onProgress?.({
    total: retryablePhotos.length,
    completed: 0,
    failed: 0,
    status: "syncing",
  });

  for (const photo of retryablePhotos) {
    // Wait with exponential backoff
    const delay = SYNC_RETRY_DELAYS[Math.min(photo.syncAttempts, SYNC_RETRY_DELAYS.length - 1)];
    await new Promise((resolve) => setTimeout(resolve, delay));

    onProgress?.({
      total: retryablePhotos.length,
      completed: result.synced + result.failed,
      failed: result.failed,
      currentPhoto: photo.fileName,
      status: "syncing",
    });

    const syncResult = await syncPhoto(photo);
    result.results.push(syncResult);

    if (syncResult.success) {
      result.synced++;
    } else {
      result.failed++;
    }
  }

  onProgress?.({
    total: retryablePhotos.length,
    completed: result.synced + result.failed,
    failed: result.failed,
    status: "completed",
  });

  return result;
}

/**
 * Delete synced photos to free up space
 */
export async function cleanupSyncedPhotos(): Promise<number> {
  const { deleteSyncedPhotos } = await import("./photo-cache");
  return deleteSyncedPhotos();
}

/**
 * Check if there are photos pending sync
 */
export async function hasPendingPhotos(): Promise<boolean> {
  const pending = await getPendingPhotos();
  return pending.length > 0;
}

/**
 * Get count of photos pending sync
 */
export async function getPendingPhotoCount(): Promise<number> {
  const pending = await getPendingPhotos();
  return pending.length;
}
