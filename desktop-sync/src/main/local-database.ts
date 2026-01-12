import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
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
  private db: SqlJsDatabase | null = null;
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

    // Initialize SQL.js
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
    this.save();
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Settings table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Subscriptions table (mirrors server sync_subscriptions)
    this.db.run(`
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
    this.db.run(`
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
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_file_states_subscription ON file_states(subscription_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_file_states_status ON file_states(sync_status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_file_states_placeholder ON file_states(is_placeholder)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_file_states_local_path ON file_states(local_path)`);

    // Sync queue for pending operations
    this.db.run(`
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

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority DESC, created_at ASC)`);
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }

  private runQuery<T>(sql: string, params: unknown[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as T;
      results.push(row);
    }
    stmt.free();
    return results;
  }

  private runExec(sql: string, params: unknown[] = []): void {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    this.save();
  }

  // Settings methods
  getSetting(key: string): string | null {
    const rows = this.runQuery<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return rows[0]?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.runExec(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `, [key, value]);
  }

  deleteSetting(key: string): void {
    this.runExec('DELETE FROM settings WHERE key = ?', [key]);
  }

  getSyncFolder(): string | null {
    return this.getSetting('sync_folder');
  }

  setSyncFolder(folderPath: string): void {
    this.setSetting('sync_folder', folderPath);
  }

  // Subscription methods
  getSubscriptions(): Subscription[] {
    return this.runQuery<Subscription>('SELECT * FROM subscriptions WHERE is_active = 1');
  }

  getSubscription(serverId: string): Subscription | null {
    const rows = this.runQuery<Subscription>('SELECT * FROM subscriptions WHERE server_id = ?', [serverId]);
    return rows[0] ?? null;
  }

  upsertSubscription(subscription: Partial<Subscription> & { server_id: string }): void {
    this.runExec(`
      INSERT OR REPLACE INTO subscriptions (server_id, folder_id, folder_type, folder_name, remote_path, include_subfolders, file_type_overrides, delta_token, last_sync_at, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      subscription.server_id,
      subscription.folder_id ?? '',
      subscription.folder_type ?? '',
      subscription.folder_name ?? '',
      subscription.remote_path ?? '',
      subscription.include_subfolders ? 1 : 0,
      subscription.file_type_overrides ?? '{}',
      subscription.delta_token ?? null,
      subscription.last_sync_at ?? null,
      subscription.is_active !== false ? 1 : 0,
    ]);
  }

  deactivateSubscription(serverId: string): void {
    this.runExec("UPDATE subscriptions SET is_active = 0, updated_at = datetime('now') WHERE server_id = ?", [serverId]);
  }

  // File state methods
  getFileStates(): FileState[] {
    return this.runQuery<FileState>('SELECT * FROM file_states WHERE is_deleted = 0');
  }

  getFileStatesBySubscription(subscriptionId: number): FileState[] {
    return this.runQuery<FileState>('SELECT * FROM file_states WHERE subscription_id = ? AND is_deleted = 0', [subscriptionId]);
  }

  getFileStateByPath(subscriptionId: number, remotePath: string): FileState | null {
    const rows = this.runQuery<FileState>('SELECT * FROM file_states WHERE subscription_id = ? AND remote_path = ?', [subscriptionId, remotePath]);
    return rows[0] ?? null;
  }

  getPendingDownloads(): FileState[] {
    return this.runQuery<FileState>("SELECT * FROM file_states WHERE sync_status = 'pending_download' AND is_deleted = 0");
  }

  getPendingUploads(): FileState[] {
    return this.runQuery<FileState>("SELECT * FROM file_states WHERE sync_status = 'pending_upload' AND is_deleted = 0");
  }

  getConflicts(): FileState[] {
    return this.runQuery<FileState>("SELECT * FROM file_states WHERE sync_status = 'conflict' AND is_deleted = 0");
  }

  upsertFileState(fileState: Partial<FileState> & { subscription_id: number; remote_path: string }): void {
    // Check if exists
    const existing = this.getFileStateByPath(fileState.subscription_id, fileState.remote_path);

    if (existing) {
      // Update
      this.runExec(`
        UPDATE file_states SET
          server_id = COALESCE(?, server_id),
          local_path = COALESCE(?, local_path),
          file_name = COALESCE(?, file_name),
          file_size = COALESCE(?, file_size),
          remote_etag = COALESCE(?, remote_etag),
          remote_content_hash = COALESCE(?, remote_content_hash),
          local_content_hash = COALESCE(?, local_content_hash),
          sync_status = COALESCE(?, sync_status),
          is_placeholder = COALESCE(?, is_placeholder),
          is_pinned = COALESCE(?, is_pinned),
          is_deleted = COALESCE(?, is_deleted),
          remote_modified_at = COALESCE(?, remote_modified_at),
          local_modified_at = COALESCE(?, local_modified_at),
          last_synced_at = COALESCE(?, last_synced_at),
          error_count = COALESCE(?, error_count),
          last_error = COALESCE(?, last_error),
          updated_at = datetime('now')
        WHERE subscription_id = ? AND remote_path = ?
      `, [
        fileState.server_id ?? null,
        fileState.local_path ?? null,
        fileState.file_name ?? null,
        fileState.file_size ?? null,
        fileState.remote_etag ?? null,
        fileState.remote_content_hash ?? null,
        fileState.local_content_hash ?? null,
        fileState.sync_status ?? null,
        fileState.is_placeholder !== undefined ? (fileState.is_placeholder ? 1 : 0) : null,
        fileState.is_pinned !== undefined ? (fileState.is_pinned ? 1 : 0) : null,
        fileState.is_deleted !== undefined ? (fileState.is_deleted ? 1 : 0) : null,
        fileState.remote_modified_at ?? null,
        fileState.local_modified_at ?? null,
        fileState.last_synced_at ?? null,
        fileState.error_count ?? null,
        fileState.last_error ?? null,
        fileState.subscription_id,
        fileState.remote_path,
      ]);
    } else {
      // Insert
      this.runExec(`
        INSERT INTO file_states (
          server_id, subscription_id, remote_path, local_path, file_name, file_size,
          remote_etag, remote_content_hash, local_content_hash, sync_status,
          is_placeholder, is_pinned, is_deleted, remote_modified_at, local_modified_at,
          last_synced_at, error_count, last_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        fileState.server_id ?? null,
        fileState.subscription_id,
        fileState.remote_path,
        fileState.local_path ?? null,
        fileState.file_name ?? path.basename(fileState.remote_path),
        fileState.file_size ?? null,
        fileState.remote_etag ?? null,
        fileState.remote_content_hash ?? null,
        fileState.local_content_hash ?? null,
        fileState.sync_status ?? 'pending_download',
        fileState.is_placeholder !== false ? 1 : 0,
        fileState.is_pinned ? 1 : 0,
        fileState.is_deleted ? 1 : 0,
        fileState.remote_modified_at ?? null,
        fileState.local_modified_at ?? null,
        fileState.last_synced_at ?? null,
        fileState.error_count ?? 0,
        fileState.last_error ?? null,
      ]);
    }
  }

  updateFileStatus(id: number, status: string, error?: string): void {
    if (error) {
      this.runExec(`
        UPDATE file_states
        SET sync_status = ?, error_count = error_count + 1, last_error = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [status, error, id]);
    } else {
      this.runExec(`
        UPDATE file_states
        SET sync_status = ?, error_count = 0, last_error = NULL, updated_at = datetime('now')
        WHERE id = ?
      `, [status, id]);
    }
  }

  markFileSynced(id: number, localHash: string): void {
    this.runExec(`
      UPDATE file_states
      SET sync_status = 'synced', is_placeholder = 0, local_content_hash = ?,
          last_synced_at = datetime('now'), error_count = 0, last_error = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `, [localHash, id]);
  }

  deleteFileState(id: number): void {
    this.runExec('DELETE FROM file_states WHERE id = ?', [id]);
  }

  // Sync queue methods
  addToSyncQueue(fileStateId: number, operation: 'download' | 'upload' | 'delete', priority: number = 0): void {
    this.runExec(`
      INSERT OR IGNORE INTO sync_queue (file_state_id, operation, priority)
      VALUES (?, ?, ?)
    `, [fileStateId, operation, priority]);
  }

  getNextQueueItem(): { id: number; file_state_id: number; operation: string } | null {
    const rows = this.runQuery<{ id: number; file_state_id: number; operation: string }>(`
      SELECT id, file_state_id, operation
      FROM sync_queue
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  removeFromQueue(id: number): void {
    this.runExec('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  clearQueue(): void {
    this.runExec('DELETE FROM sync_queue');
  }
}
