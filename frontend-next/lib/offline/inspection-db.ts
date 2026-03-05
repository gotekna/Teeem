/**
 * IndexedDB schema and CRUD operations for offline inspection support.
 *
 * Uses the `idb` library for a promise-based IndexedDB wrapper.
 * Stores inspections, rooms, items, photos (as blobs), and a sync queue.
 */

const DB_NAME = "teeem-inspections";
const DB_VERSION = 1;

export interface OfflineInspection {
  id: number;
  data: Record<string, unknown>;
  lastSynced: number;
  dirty: boolean;
}

export interface OfflineRoom {
  id: number;
  inspectionId: number;
  data: Record<string, unknown>;
  dirty: boolean;
}

export interface OfflineItem {
  id: number;
  roomId: number;
  data: Record<string, unknown>;
  dirty: boolean;
}

export interface OfflinePhoto {
  id: string; // Local ID for new photos (uuid), or server ID as string
  itemId: number;
  blob: Blob;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  synced: boolean;
  serverId: number | null;
}

export interface SyncQueueEntry {
  id: string;
  action: "create" | "update" | "delete";
  entity: "inspection" | "room" | "item" | "photo";
  entityId: number | string;
  parentId?: number;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

async function getDb() {
  const { openDB } = await import("idb");

  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Inspections store
      if (!db.objectStoreNames.contains("inspections")) {
        db.createObjectStore("inspections", { keyPath: "id" });
      }

      // Rooms store
      if (!db.objectStoreNames.contains("rooms")) {
        const roomStore = db.createObjectStore("rooms", { keyPath: "id" });
        roomStore.createIndex("by-inspection", "inspectionId");
      }

      // Items store
      if (!db.objectStoreNames.contains("items")) {
        const itemStore = db.createObjectStore("items", { keyPath: "id" });
        itemStore.createIndex("by-room", "roomId");
      }

      // Photos store (binary blobs)
      if (!db.objectStoreNames.contains("photos")) {
        const photoStore = db.createObjectStore("photos", { keyPath: "id" });
        photoStore.createIndex("by-item", "itemId");
        photoStore.createIndex("unsynced", "synced");
      }

      // Sync queue
      if (!db.objectStoreNames.contains("sync_queue")) {
        const syncStore = db.createObjectStore("sync_queue", { keyPath: "id" });
        syncStore.createIndex("by-timestamp", "timestamp");
      }
    },
  });
}

// ── Inspection CRUD ──

export async function saveInspection(inspection: OfflineInspection): Promise<void> {
  const db = await getDb();
  await db.put("inspections", inspection);
}

export async function getInspection(id: number): Promise<OfflineInspection | undefined> {
  const db = await getDb();
  return db.get("inspections", id);
}

export async function deleteInspection(id: number): Promise<void> {
  const db = await getDb();
  await db.delete("inspections", id);
}

// ── Room CRUD ──

export async function saveRoom(room: OfflineRoom): Promise<void> {
  const db = await getDb();
  await db.put("rooms", room);
}

export async function getRoomsByInspection(inspectionId: number): Promise<OfflineRoom[]> {
  const db = await getDb();
  return db.getAllFromIndex("rooms", "by-inspection", inspectionId);
}

// ── Item CRUD ──

export async function saveItem(item: OfflineItem): Promise<void> {
  const db = await getDb();
  await db.put("items", item);
}

export async function getItemsByRoom(roomId: number): Promise<OfflineItem[]> {
  const db = await getDb();
  return db.getAllFromIndex("items", "by-room", roomId);
}

// ── Photo CRUD ──

export async function savePhoto(photo: OfflinePhoto): Promise<void> {
  const db = await getDb();
  await db.put("photos", photo);
}

export async function getPhotosByItem(itemId: number): Promise<OfflinePhoto[]> {
  const db = await getDb();
  return db.getAllFromIndex("photos", "by-item", itemId);
}

export async function getUnsyncedPhotos(): Promise<OfflinePhoto[]> {
  const db = await getDb();
  return db.getAllFromIndex("photos", "unsynced", IDBKeyRange.only(0));
}

// ── Sync Queue ──

export async function addToSyncQueue(entry: SyncQueueEntry): Promise<void> {
  const db = await getDb();
  await db.put("sync_queue", entry);
}

export async function getSyncQueue(): Promise<SyncQueueEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex("sync_queue", "by-timestamp");
}

export async function removeSyncQueueEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("sync_queue", id);
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDb();
  await db.clear("sync_queue");
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await getDb();
  return db.count("sync_queue");
}

// ── Cache Management ──

export async function cacheInspectionData(inspectionId: number, fullData: Record<string, unknown>): Promise<void> {
  const inspection: OfflineInspection = {
    id: inspectionId,
    data: fullData,
    lastSynced: Date.now(),
    dirty: false,
  };
  await saveInspection(inspection);
}

export async function clearInspectionCache(inspectionId: number): Promise<void> {
  const db = await getDb();

  // Delete inspection
  await db.delete("inspections", inspectionId);

  // Delete rooms
  const rooms = await getRoomsByInspection(inspectionId);
  for (const room of rooms) {
    // Delete items for each room
    const items = await getItemsByRoom(room.id);
    for (const item of items) {
      // Delete photos for each item
      const photos = await getPhotosByItem(item.id);
      for (const photo of photos) {
        await db.delete("photos", photo.id);
      }
      await db.delete("items", item.id);
    }
    await db.delete("rooms", room.id);
  }
}
