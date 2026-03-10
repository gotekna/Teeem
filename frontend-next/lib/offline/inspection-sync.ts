/**
 * Sync engine for offline inspection data.
 *
 * Replays queued operations against the API when connection is restored.
 * Uses server-wins conflict resolution (latest timestamp wins).
 */

import {
  getSyncQueue,
  removeSyncQueueEntry,
  getUnsyncedPhotos,
  savePhoto,
  type SyncQueueEntry,
} from "./inspection-db";
import { api } from "@/lib/api";

const MAX_RETRIES = 3;

export interface SyncResult {
  success: number;
  failed: number;
  remaining: number;
}

/**
 * Process the entire sync queue in order.
 * Called when connection is restored.
 */
export async function processSyncQueue(): Promise<SyncResult> {
  const queue = await getSyncQueue();
  let success = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      await processEntry(entry);
      await removeSyncQueueEntry(entry.id);
      success++;
    } catch (error) {
      console.error(`Sync failed for ${entry.entity} ${entry.entityId}:`, error);

      if (entry.retryCount >= MAX_RETRIES) {
        // Give up on this entry after max retries
        await removeSyncQueueEntry(entry.id);
        failed++;
      } else {
        // Will retry next sync cycle
        failed++;
      }
    }
  }

  // Also sync any unsynced photos
  await syncPhotos();

  const remaining = (await getSyncQueue()).length;

  return { success, failed, remaining };
}

async function processEntry(entry: SyncQueueEntry): Promise<void> {
  switch (entry.action) {
    case "update":
      await processUpdate(entry);
      break;
    case "create":
      await processCreate(entry);
      break;
    case "delete":
      await processDelete(entry);
      break;
  }
}

async function processUpdate(entry: SyncQueueEntry): Promise<void> {
  switch (entry.entity) {
    case "item":
      await api.patch(
        `/api/v1/inspection_rooms/${entry.parentId}/inspection_items/${entry.entityId}`,
        { inspection_item: entry.data }
      );
      break;
    case "room":
      // Room updates use the inspection ID as parent
      await api.patch(
        `/api/v1/property_inspections/${entry.parentId}/inspection_rooms/${entry.entityId}`,
        { inspection_room: entry.data }
      );
      break;
    case "inspection":
      await api.patch(
        `/api/v1/property_inspections/${entry.entityId}`,
        { property_inspection: entry.data }
      );
      break;
  }
}

async function processCreate(entry: SyncQueueEntry): Promise<void> {
  switch (entry.entity) {
    case "item":
      await api.post(
        `/api/v1/inspection_rooms/${entry.parentId}/inspection_items`,
        { inspection_item: entry.data }
      );
      break;
    case "room":
      await api.post(
        `/api/v1/property_inspections/${entry.parentId}/inspection_rooms`,
        { inspection_room: entry.data }
      );
      break;
  }
}

async function processDelete(entry: SyncQueueEntry): Promise<void> {
  switch (entry.entity) {
    case "item":
      await api.delete(
        `/api/v1/inspection_rooms/${entry.parentId}/inspection_items/${entry.entityId}`
      );
      break;
    case "room":
      await api.delete(
        `/api/v1/property_inspections/${entry.parentId}/inspection_rooms/${entry.entityId}`
      );
      break;
    case "photo":
      await api.delete(
        `/api/v1/inspection_items/${entry.parentId}/inspection_photos/${entry.entityId}`
      );
      break;
  }
}

/**
 * Upload any photos that were captured offline.
 */
async function syncPhotos(): Promise<void> {
  const unsyncedPhotos = await getUnsyncedPhotos();

  for (const photo of unsyncedPhotos) {
    try {
      const formData = new FormData();
      formData.append("file", photo.blob, "inspection_photo.jpg");
      if (photo.caption) formData.append("caption", photo.caption);
      if (photo.latitude) formData.append("latitude", String(photo.latitude));
      if (photo.longitude) formData.append("longitude", String(photo.longitude));

      const result = await api.postFormData(
        `/api/v1/inspection_items/${photo.itemId}/inspection_photos`,
        formData
      );

      // Mark as synced and store server ID
      await savePhoto({
        ...photo,
        synced: true,
        serverId: (result as { data?: { id?: number } })?.data?.id || null,
      });
    } catch (error) {
      console.error(`Failed to sync photo ${photo.id}:`, error);
    }
  }
}

/**
 * Set up automatic sync when connection is restored.
 * Call this once on app initialization.
 */
export function setupAutoSync(): () => void {
  const handleOnline = () => {
    console.log("[InspectionSync] Connection restored, processing queue...");
    processSyncQueue().then(result => {
      console.log(`[InspectionSync] Sync complete: ${result.success} synced, ${result.failed} failed, ${result.remaining} remaining`);
    });
  };

  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
