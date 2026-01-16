/**
 * Offline State Atoms
 *
 * Jotai atoms for managing offline state and sync status.
 * SSoT for all offline-related state in the application.
 */

import { atom } from "jotai";

// ═══════════════════════════════════════════════════════════════════════════
// Core Online/Offline State
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Whether the browser currently has network connectivity.
 * Automatically updated by the useOfflineDetection hook.
 */
export const isOnlineAtom = atom<boolean>(
  typeof navigator !== "undefined" ? navigator.onLine : true
);

/**
 * Whether we're running in PWA/standalone mode (installed on device).
 */
export const isPWAInstalledAtom = atom<boolean>(false);

// ═══════════════════════════════════════════════════════════════════════════
// Sync Queue State
// ═══════════════════════════════════════════════════════════════════════════

export interface PendingSyncItem {
  id: string;
  type: "photo" | "task_update" | "note";
  createdAt: Date;
  data: Record<string, unknown>;
  retryCount: number;
  lastError?: string;
}

/**
 * Items waiting to be synced when connection returns.
 */
export const pendingSyncQueueAtom = atom<PendingSyncItem[]>([]);

/**
 * Count of pending items (derived atom for easy access).
 */
export const pendingSyncCountAtom = atom((get) => get(pendingSyncQueueAtom).length);

/**
 * Whether a sync is currently in progress.
 */
export const isSyncingAtom = atom<boolean>(false);

/**
 * Last successful sync timestamp.
 */
export const lastSyncTimeAtom = atom<Date | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// Cached Data State
// ═══════════════════════════════════════════════════════════════════════════

export interface CachedJobData {
  jobId: string;
  jobCode: string;
  jobName: string;
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * Jobs that have been cached for offline access.
 */
export const cachedJobsAtom = atom<CachedJobData[]>([]);

/**
 * Documents marked as available offline.
 */
export interface OfflineDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  cachedAt: Date;
  jobId?: string;
}

export const offlineDocumentsAtom = atom<OfflineDocument[]>([]);

// ═══════════════════════════════════════════════════════════════════════════
// UI State
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Whether to show the offline banner.
 * Can be dismissed by user but will reappear on page navigation.
 */
export const showOfflineBannerAtom = atom<boolean>(true);

/**
 * User notification preferences for offline mode.
 */
export interface OfflineNotificationPrefs {
  showBanner: boolean;
  showSyncStatus: boolean;
  vibrateOnSync: boolean;
}

export const offlineNotificationPrefsAtom = atom<OfflineNotificationPrefs>({
  showBanner: true,
  showSyncStatus: true,
  vibrateOnSync: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// Derived/Computed Atoms
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Whether the app is currently working offline with cached data.
 */
export const isWorkingOfflineAtom = atom((get) => !get(isOnlineAtom));

/**
 * Human-readable sync status message.
 */
export const syncStatusMessageAtom = atom((get) => {
  const isOnline = get(isOnlineAtom);
  const isSyncing = get(isSyncingAtom);
  const pendingCount = get(pendingSyncCountAtom);
  const lastSync = get(lastSyncTimeAtom);

  if (!isOnline) {
    if (pendingCount > 0) {
      return `Offline - ${pendingCount} item${pendingCount === 1 ? "" : "s"} pending sync`;
    }
    return "Offline - Changes will sync when connected";
  }

  if (isSyncing) {
    return "Syncing...";
  }

  if (lastSync) {
    const mins = Math.floor((Date.now() - lastSync.getTime()) / 60000);
    if (mins < 1) return "Synced just now";
    if (mins === 1) return "Synced 1 min ago";
    if (mins < 60) return `Synced ${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    return `Synced ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  return "Online";
});

/**
 * Total storage used by offline documents (in bytes).
 */
export const offlineStorageUsedAtom = atom((get) => {
  const docs = get(offlineDocumentsAtom);
  return docs.reduce((total, doc) => total + doc.size, 0);
});

/**
 * Formatted storage usage string.
 */
export const offlineStorageDisplayAtom = atom((get) => {
  const bytes = get(offlineStorageUsedAtom);
  if (bytes === 0) return "No offline documents";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
});
