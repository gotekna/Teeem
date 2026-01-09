/**
 * Email Cache Database
 *
 * IndexedDB initialization and schema management for offline-first email.
 * Uses the 'idb' library for a Promise-based API.
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import {
  CachedEmail,
  CachedEmailContent,
  CategoryMeta,
  OfflineAction,
  SyncMeta,
  SyncMetaKey,
  CACHE_CONFIG,
} from "./types";
import type { SplitInboxCategory } from "@/components/emails/SplitInboxTabs";

// =============================================================================
// Database Schema Definition
// =============================================================================

interface EmailCacheDB extends DBSchema {
  emails: {
    key: number;
    value: CachedEmail;
    indexes: {
      "by-received-at": number;
      "by-category": SplitInboxCategory;
      "by-conversation-id": string;
    };
  };
  emailContent: {
    key: number;
    value: CachedEmailContent;
  };
  splitInboxMeta: {
    key: SplitInboxCategory;
    value: CategoryMeta;
  };
  offlineActions: {
    key: string;
    value: OfflineAction;
    indexes: {
      "by-created-at": number;
    };
  };
  syncMeta: {
    key: SyncMetaKey;
    value: SyncMeta;
  };
}

// =============================================================================
// Database Singleton
// =============================================================================

let dbPromise: Promise<IDBPDatabase<EmailCacheDB>> | null = null;

/**
 * Get or create the database connection.
 * Uses singleton pattern to avoid multiple connections.
 */
export async function getDatabase(): Promise<IDBPDatabase<EmailCacheDB>> {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is not available in server-side rendering");
  }

  if (!dbPromise) {
    dbPromise = openDB<EmailCacheDB>(CACHE_CONFIG.DB_NAME, CACHE_CONFIG.DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[EmailCache] Upgrading database from v${oldVersion} to v${newVersion}`);

        // Version 1: Initial schema
        if (oldVersion < 1) {
          // Store 1: emails - List view data (~1KB each)
          const emailsStore = db.createObjectStore("emails", { keyPath: "id" });
          emailsStore.createIndex("by-received-at", "_cachedAt");
          emailsStore.createIndex("by-category", "_category");
          emailsStore.createIndex("by-conversation-id", "conversation_id");

          // Store 2: emailContent - Detail view (~50-200KB each)
          db.createObjectStore("emailContent", { keyPath: "id" });

          // Store 3: splitInboxMeta - Category counts
          db.createObjectStore("splitInboxMeta", { keyPath: "category" });

          // Store 4: offlineActions - Mutation queue
          const actionsStore = db.createObjectStore("offlineActions", { keyPath: "id" });
          actionsStore.createIndex("by-created-at", "createdAt");

          // Store 5: syncMeta - Sync tracking
          db.createObjectStore("syncMeta", { keyPath: "key" });

          console.log("[EmailCache] Created all object stores");
        }

        // Future migrations would go here:
        // if (oldVersion < 2) { ... }
      },
      blocked() {
        console.warn("[EmailCache] Database blocked - another tab may be using an older version");
      },
      blocking() {
        console.warn("[EmailCache] This tab is blocking a database upgrade in another tab");
      },
      terminated() {
        console.error("[EmailCache] Database connection terminated unexpectedly");
        dbPromise = null; // Reset so next access tries to reconnect
      },
    });
  }

  return dbPromise;
}

/**
 * Close the database connection.
 * Useful for testing or when the user logs out.
 */
export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
    console.log("[EmailCache] Database closed");
  }
}

/**
 * Delete the entire database.
 * Use with caution - only for logout or testing.
 */
export async function deleteDatabase(): Promise<void> {
  if (typeof window === "undefined") return;

  // Close existing connection first
  await closeDatabase();

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(CACHE_CONFIG.DB_NAME);
    request.onsuccess = () => {
      console.log("[EmailCache] Database deleted");
      resolve();
    };
    request.onerror = () => {
      console.error("[EmailCache] Failed to delete database:", request.error);
      reject(request.error);
    };
    request.onblocked = () => {
      console.warn("[EmailCache] Database deletion blocked - close other tabs");
    };
  });
}

/**
 * Check if IndexedDB is available in this browser.
 */
export function isIndexedDBAvailable(): boolean {
  if (typeof window === "undefined") return false;

  try {
    // Check for IndexedDB support
    if (!window.indexedDB) return false;

    // Safari in private mode throws on indexedDB.open
    // Try a quick test
    const testRequest = window.indexedDB.open("__test__");
    testRequest.onerror = () => {
      // Private browsing mode
    };
    testRequest.onsuccess = () => {
      testRequest.result.close();
      window.indexedDB.deleteDatabase("__test__");
    };

    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Export database type for use in stores
// =============================================================================

export type { EmailCacheDB, IDBPDatabase };
