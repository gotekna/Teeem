import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

interface FileState {
  id: number;
  subscription_id: number;
  remote_path: string;
  file_name: string;
  file_size: number | null;
  remote_etag: string | null;
  remote_content_hash: string | null;
  local_content_hash: string | null;
  sync_status: string;
  is_placeholder: boolean;
  is_pinned: boolean;
  is_deleted: boolean;
  remote_modified_at: string | null;
  local_modified_at: string | null;
  last_synced_at: string | null;
  error_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface Subscription {
  id: number;
  server_id: string;
  folder_id: string;
  folder_type: string;
  folder_name: string;
  remote_path: string;
  include_subfolders: boolean;
  file_type_overrides: string; // JSON
  delta_token: string | null;
  last_sync_at: string | null;
  is_active: boolean;
}

export class LocalDatabase {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.createTables();
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Subscriptions table (mirrors server sync_subscriptions)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT UNIQUE NOT NULL,
        folder_id TEXT NOT NULL,
        folder_type TEXT NOT NULL,
        folder_name TEXT NOT NULL,
        remote_path TEXT NOT NULL,
        include_subfolders INTEGER DEFAULT 1,
        file_type_overrides TEXT DEFAULT '{}',
        delta_token TEXT,
        last_sync_at TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // File states table (mirrors server sync_file_states, plus local tracking)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT UNIQUE,
        subscription_id INTEGER NOT NULL,
        remote_path TEXT NOT NULL,
        local_path TEXT,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        remote_etag TEXT,
        remote_content_hash TEXT,
        local_content_hash TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending_download',
        is_placeholder INTEGER DEFAULT 1,
        is_pinned INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        remote_modified_at TEXT,
        local_modified_at TEXT,
        last_synced_at TEXT,
        error_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
        UNIQUE(subscription_id, remote_path)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_states_subscription ON file_states(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_file_states_status ON file_states(sync_status);
      CREATE INDEX IF NOT EXISTS idx_file_states_placeholder ON file_states(is_placeholder);
      CREATE INDEX IF NOT EXISTS idx_file_states_local_path ON file_states(local_path);
    `);

    // Sync queue for pending operations
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_state_id INTEGER NOT NULL,
        operation TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        last_attempt_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_state_id) REFERENCES file_states(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority DESC, created_at ASC);
    `);
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  // Settings methods
  getSetting(key: string): string | null {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `).run(key, value, value);
  }

  deleteSetting(key: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  getSyncFolder(): string | null {
    return this.getSetting('sync_folder');
  }

  setSyncFolder(folderPath: string): void {
    this.setSetting('sync_folder', folderPath);
  }

  // Subscription methods
  getSubscriptions(): Subscription[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare('SELECT * FROM subscriptions WHERE is_active = 1').all() as Subscription[];
  }

  getSubscription(serverId: string): Subscription | null {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare('SELECT * FROM subscriptions WHERE server_id = ?').get(serverId) as Subscription | null;
  }

  upsertSubscription(subscription: Partial<Subscription> & { server_id: string }): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(`
      INSERT INTO subscriptions (server_id, folder_id, folder_type, folder_name, remote_path, include_subfolders, file_type_overrides, delta_token, last_sync_at, is_active)
      VALUES (@server_id, @folder_id, @folder_type, @folder_name, @remote_path, @include_subfolders, @file_type_overrides, @delta_token, @last_sync_at, @is_active)
      ON CONFLICT(server_id) DO UPDATE SET
        folder_id = @folder_id,
        folder_type = @folder_type,
        folder_name = @folder_name,
        remote_path = @remote_path,
        include_subfolders = @include_subfolders,
        file_type_overrides = @file_type_overrides,
        delta_token = @delta_token,
        last_sync_at = @last_sync_at,
        is_active = @is_active,
        updated_at = CURRENT_TIMESTAMP
    `).run({
      server_id: subscription.server_id,
      folder_id: subscription.folder_id ?? '',
      folder_type: subscription.folder_type ?? '',
      folder_name: subscription.folder_name ?? '',
      remote_path: subscription.remote_path ?? '',
      include_subfolders: subscription.include_subfolders ? 1 : 0,
      file_type_overrides: subscription.file_type_overrides ?? '{}',
      delta_token: subscription.delta_token ?? null,
      last_sync_at: subscription.last_sync_at ?? null,
      is_active: subscription.is_active !== false ? 1 : 0,
    });
  }

  deactivateSubscription(serverId: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('UPDATE subscriptions SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE server_id = ?').run(serverId);
  }

  // File state methods
  getFileStates(): FileState[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare('SELECT * FROM file_states WHERE is_deleted = 0').all() as FileState[];
  }

  getFileStatesBySubscription(subscriptionId: number): FileState[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare('SELECT * FROM file_states WHERE subscription_id = ? AND is_deleted = 0').all(subscriptionId) as FileState[];
  }

  getFileStateByPath(subscriptionId: number, remotePath: string): FileState | null {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare('SELECT * FROM file_states WHERE subscription_id = ? AND remote_path = ?').get(subscriptionId, remotePath) as FileState | null;
  }

  getPendingDownloads(): FileState[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare("SELECT * FROM file_states WHERE sync_status = 'pending_download' AND is_deleted = 0").all() as FileState[];
  }

  getPendingUploads(): FileState[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare("SELECT * FROM file_states WHERE sync_status = 'pending_upload' AND is_deleted = 0").all() as FileState[];
  }

  getConflicts(): FileState[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare("SELECT * FROM file_states WHERE sync_status = 'conflict' AND is_deleted = 0").all() as FileState[];
  }

  upsertFileState(fileState: Partial<FileState> & { subscription_id: number; remote_path: string }): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(`
      INSERT INTO file_states (
        server_id, subscription_id, remote_path, local_path, file_name, file_size,
        remote_etag, remote_content_hash, local_content_hash, sync_status,
        is_placeholder, is_pinned, is_deleted, remote_modified_at, local_modified_at,
        last_synced_at, error_count, last_error
      ) VALUES (
        @server_id, @subscription_id, @remote_path, @local_path, @file_name, @file_size,
        @remote_etag, @remote_content_hash, @local_content_hash, @sync_status,
        @is_placeholder, @is_pinned, @is_deleted, @remote_modified_at, @local_modified_at,
        @last_synced_at, @error_count, @last_error
      )
      ON CONFLICT(subscription_id, remote_path) DO UPDATE SET
        server_id = COALESCE(@server_id, server_id),
        local_path = COALESCE(@local_path, local_path),
        file_name = COALESCE(@file_name, file_name),
        file_size = COALESCE(@file_size, file_size),
        remote_etag = COALESCE(@remote_etag, remote_etag),
        remote_content_hash = COALESCE(@remote_content_hash, remote_content_hash),
        local_content_hash = COALESCE(@local_content_hash, local_content_hash),
        sync_status = COALESCE(@sync_status, sync_status),
        is_placeholder = COALESCE(@is_placeholder, is_placeholder),
        is_pinned = COALESCE(@is_pinned, is_pinned),
        is_deleted = COALESCE(@is_deleted, is_deleted),
        remote_modified_at = COALESCE(@remote_modified_at, remote_modified_at),
        local_modified_at = COALESCE(@local_modified_at, local_modified_at),
        last_synced_at = COALESCE(@last_synced_at, last_synced_at),
        error_count = COALESCE(@error_count, error_count),
        last_error = COALESCE(@last_error, last_error),
        updated_at = CURRENT_TIMESTAMP
    `).run({
      server_id: fileState.server_id ?? null,
      subscription_id: fileState.subscription_id,
      remote_path: fileState.remote_path,
      local_path: fileState.local_path ?? null,
      file_name: fileState.file_name ?? path.basename(fileState.remote_path),
      file_size: fileState.file_size ?? null,
      remote_etag: fileState.remote_etag ?? null,
      remote_content_hash: fileState.remote_content_hash ?? null,
      local_content_hash: fileState.local_content_hash ?? null,
      sync_status: fileState.sync_status ?? 'pending_download',
      is_placeholder: fileState.is_placeholder !== false ? 1 : 0,
      is_pinned: fileState.is_pinned ? 1 : 0,
      is_deleted: fileState.is_deleted ? 1 : 0,
      remote_modified_at: fileState.remote_modified_at ?? null,
      local_modified_at: fileState.local_modified_at ?? null,
      last_synced_at: fileState.last_synced_at ?? null,
      error_count: fileState.error_count ?? 0,
      last_error: fileState.last_error ?? null,
    });
  }

  updateFileStatus(id: number, status: string, error?: string): void {
    if (!this.db) throw new Error('Database not initialized');
    if (error) {
      this.db.prepare(`
        UPDATE file_states
        SET sync_status = ?, error_count = error_count + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, error, id);
    } else {
      this.db.prepare(`
        UPDATE file_states
        SET sync_status = ?, error_count = 0, last_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, id);
    }
  }

  markFileSynced(id: number, localHash: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(`
      UPDATE file_states
      SET sync_status = 'synced', is_placeholder = 0, local_content_hash = ?,
          last_synced_at = CURRENT_TIMESTAMP, error_count = 0, last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(localHash, id);
  }

  deleteFileState(id: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM file_states WHERE id = ?').run(id);
  }

  // Sync queue methods
  addToSyncQueue(fileStateId: number, operation: 'download' | 'upload' | 'delete', priority: number = 0): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(`
      INSERT INTO sync_queue (file_state_id, operation, priority)
      VALUES (?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(fileStateId, operation, priority);
  }

  getNextQueueItem(): { id: number; file_state_id: number; operation: string } | null {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare(`
      SELECT id, file_state_id, operation
      FROM sync_queue
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `).get() as { id: number; file_state_id: number; operation: string } | null;
  }

  removeFromQueue(id: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM sync_queue WHERE id = ?').run(id);
  }

  clearQueue(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM sync_queue').run();
  }
}
