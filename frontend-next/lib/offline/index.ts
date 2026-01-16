/**
 * Offline Module
 *
 * SSoT for all offline functionality in TEEEM.
 * Provides state management, hooks, and utilities for offline support.
 */

// State atoms
export * from "./offline-atoms";

// Hooks
export { useOfflineDetection, useIsOnline } from "./use-offline-detection";
export {
  useGanttOfflineCache,
  useAutoGanttCache,
  type UseGanttOfflineCacheOptions,
  type UseGanttOfflineCacheResult,
} from "./use-gantt-offline-cache";

// Gantt cache operations
export {
  getGanttFromCache,
  setGanttInCache,
  deleteGanttFromCache,
  getAllCachedGantt,
  deserializeGanttData,
  getJobsListFromCache,
  setJobsListInCache,
  cleanupGanttCache,
  clearGanttCache,
  getGanttCacheStats,
  getGanttCacheKey,
  GANTT_CACHE_TTL_MS,
  type CachedGanttData,
  type CachedJobInfo,
} from "./gantt-cache";

// Document cache operations
export {
  getDocumentFromCache,
  setDocumentInCache,
  deleteDocumentFromCache,
  getJobDocumentsFromCache,
  clearJobDocumentsFromCache,
  getSyncedJobInfo,
  updateSyncedJobInfo,
  getAllSyncedJobs,
  removeSyncedJob,
  cleanupDocumentCache,
  clearDocumentCache,
  getDocumentCacheStats,
  createBlobUrl,
  revokeBlobUrl,
  getDocumentCacheKey,
  DOCUMENT_CACHE_TTL_MS,
  MAX_DOCUMENT_SIZE_BYTES,
  type CachedDocument,
  type SyncedJobInfo,
} from "./document-cache";

// Document sync hook
export {
  useDocumentOfflineSync,
  type JobForSync,
  type DocumentSyncProgress,
  type UseDocumentOfflineSyncResult,
} from "./use-document-offline-sync";

// Cached document viewing
export {
  useCachedDocument,
  useIsDocumentOffline,
  openCachedDocument,
  type UseCachedDocumentOptions,
  type UseCachedDocumentResult,
} from "./use-cached-document";

// Photo cache operations
export {
  storePhoto,
  getPhoto,
  getJobPhotos,
  getPendingPhotos,
  getErrorPhotos,
  updatePhotoSyncStatus,
  deletePhoto,
  deleteSyncedPhotos,
  clearPhotoCache,
  getPhotoCacheStats,
  compressPhoto,
  createPhotoBlobUrl,
  revokePhotoBlobUrl,
  MAX_PHOTO_SIZE_BYTES,
  type PendingPhoto,
  type PhotoSyncStatus,
  type PhotoCacheStats,
} from "./photo-cache";

// Photo sync operations
export {
  syncPhoto,
  syncAllPendingPhotos,
  retryFailedPhotos,
  cleanupSyncedPhotos,
  hasPendingPhotos,
  getPendingPhotoCount,
  type PhotoSyncResult,
  type PhotoSyncBatchResult,
  type PhotoSyncProgress,
} from "./photo-sync";

// Photo capture hook
export {
  usePhotoCapture,
  type UsePhotoCaptureOptions,
  type UsePhotoCaptureResult,
} from "./use-photo-capture";
