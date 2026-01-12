import { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { AuthManager } from './auth-manager';
import { LocalDatabase } from './local-database';
import { API_BASE_URL, SYNC_CONFIG } from './config';

interface SyncStatus {
  state: 'idle' | 'syncing' | 'paused' | 'error';
  pending_downloads: number;
  pending_uploads: number;
  last_sync_at?: string;
  current_file?: string;
  progress?: number;
  error?: string;
}

interface SyncFolder {
  id: string;
  name: string;
  type: 'job' | 'corporate_company' | 'contact';
  path: string;
  file_count?: number;
}

interface SyncSubscription {
  id: string;
  folder_id: string;
  folder_type: string;
  folder_name: string;
  include_subfolders: boolean;
  file_type_overrides: Record<string, boolean>;
  last_sync_at?: string;
}

interface ExclusionRule {
  id: string;
  rule_type: 'extension' | 'size' | 'pattern';
  value: string;
  action: 'skip' | 'include';
  description: string;
  is_default: boolean;
  priority: number;
}

interface DeltaChange {
  path: string;
  type: 'file' | 'folder';
  action: 'created' | 'modified' | 'deleted';
  item_id?: string;
  etag?: string;
  content_hash?: string;
  size?: number;
  modified_at?: string;
}

export class SyncEngine {
  private authManager: AuthManager;
  private db: LocalDatabase;
  private status: SyncStatus;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPaused: boolean = false;
  private isSyncing: boolean = false;

  constructor(authManager: AuthManager, db: LocalDatabase) {
    this.authManager = authManager;
    this.db = db;
    this.status = {
      state: 'idle',
      pending_downloads: 0,
      pending_uploads: 0,
    };
  }

  start(): void {
    if (this.pollTimer) return;

    // Start polling for changes
    this.pollTimer = setInterval(() => {
      if (!this.isPaused && !this.isSyncing) {
        this.syncNow();
      }
    }, SYNC_CONFIG.pollInterval);

    // Run initial sync
    this.syncNow();
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  pause(): void {
    this.isPaused = true;
    this.updateStatus({ state: 'paused' });
  }

  resume(): void {
    this.isPaused = false;
    this.updateStatus({ state: 'idle' });
    this.syncNow();
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  private updateStatus(updates: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...updates };
    this.notifyRenderer('sync:status', this.status);
  }

  private notifyRenderer(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send(channel, data);
    });
  }

  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.authManager.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Device-Id': this.authManager.getDeviceId(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data ?? data;
  }

  // Folder and subscription management
  async getAvailableFolders(): Promise<SyncFolder[]> {
    return this.apiRequest<SyncFolder[]>('/api/v1/sync/folders');
  }

  async getSubscriptions(): Promise<SyncSubscription[]> {
    const subscriptions = await this.apiRequest<SyncSubscription[]>('/api/v1/sync/subscriptions');

    // Update local database
    for (const sub of subscriptions) {
      this.db.upsertSubscription({
        server_id: sub.id,
        folder_id: sub.folder_id,
        folder_type: sub.folder_type,
        folder_name: sub.folder_name,
        remote_path: '', // Will be set from delta sync
        include_subfolders: sub.include_subfolders,
        file_type_overrides: JSON.stringify(sub.file_type_overrides),
        last_sync_at: sub.last_sync_at ?? null,
        is_active: true,
      });
    }

    return subscriptions;
  }

  async subscribe(folderId: string, folderType: string): Promise<SyncSubscription> {
    const subscription = await this.apiRequest<SyncSubscription>('/api/v1/sync/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        syncable_id: folderId,
        syncable_type: folderType,
        include_subfolders: true,
      }),
    });

    // Add to local database
    this.db.upsertSubscription({
      server_id: subscription.id,
      folder_id: subscription.folder_id,
      folder_type: subscription.folder_type,
      folder_name: subscription.folder_name,
      remote_path: '',
      include_subfolders: subscription.include_subfolders,
      file_type_overrides: JSON.stringify(subscription.file_type_overrides),
      is_active: true,
    });

    // Trigger sync for new subscription
    this.syncNow();

    return subscription;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    await this.apiRequest<void>(`/api/v1/sync/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });

    // Deactivate in local database
    this.db.deactivateSubscription(subscriptionId);

    // TODO: Optionally remove local files
  }

  // Exclusion rules
  async getExclusionRules(): Promise<ExclusionRule[]> {
    return this.apiRequest<ExclusionRule[]>('/api/v1/sync/exclusions');
  }

  async updateExclusionRules(rules: unknown[]): Promise<void> {
    await this.apiRequest<void>('/api/v1/sync/exclusions', {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    });
  }

  // Main sync logic
  async syncNow(): Promise<void> {
    if (this.isSyncing || this.isPaused) return;

    try {
      this.isSyncing = true;
      this.updateStatus({ state: 'syncing' });

      const subscriptions = this.db.getSubscriptions();

      for (const subscription of subscriptions) {
        await this.syncSubscription(subscription);
      }

      // Process queued operations
      await this.processQueue();

      this.updateStatus({
        state: 'idle',
        last_sync_at: new Date().toISOString(),
        pending_downloads: this.db.getPendingDownloads().length,
        pending_uploads: this.db.getPendingUploads().length,
      });
    } catch (error) {
      console.error('Sync error:', error);
      this.updateStatus({
        state: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncSubscription(subscription: {
    id: number;
    server_id: string;
    delta_token: string | null;
  }): Promise<void> {
    try {
      // Get delta changes from server
      const deltaUrl = subscription.delta_token
        ? `/api/v1/sync/delta?subscription_id=${subscription.server_id}&delta_token=${subscription.delta_token}`
        : `/api/v1/sync/delta?subscription_id=${subscription.server_id}`;

      const response = await this.apiRequest<{
        changes: DeltaChange[];
        delta_token: string;
      }>(deltaUrl);

      // Process each change
      for (const change of response.changes) {
        await this.processChange(subscription.id, change);
      }

      // Update delta token
      this.db.upsertSubscription({
        server_id: subscription.server_id,
        delta_token: response.delta_token,
        last_sync_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Error syncing subscription ${subscription.server_id}:`, error);
    }
  }

  private async processChange(subscriptionId: number, change: DeltaChange): Promise<void> {
    if (change.type === 'folder') {
      // Handle folder changes (create local directory)
      const syncFolder = this.db.getSyncFolder();
      if (syncFolder) {
        const localPath = path.join(syncFolder, change.path);
        if (change.action === 'deleted') {
          // Don't delete folders, just files
        } else {
          fs.mkdirSync(localPath, { recursive: true });
        }
      }
      return;
    }

    // Handle file changes
    const existingState = this.db.getFileStateByPath(subscriptionId, change.path);

    if (change.action === 'deleted') {
      if (existingState) {
        this.db.upsertFileState({
          subscription_id: subscriptionId,
          remote_path: change.path,
          is_deleted: true,
          sync_status: 'pending_download', // Will remove local file
        });
        this.db.addToSyncQueue(existingState.id, 'delete');
      }
      return;
    }

    // Created or modified
    if (!existingState) {
      // New file - add as placeholder
      this.db.upsertFileState({
        subscription_id: subscriptionId,
        remote_path: change.path,
        file_name: path.basename(change.path),
        file_size: change.size ?? null,
        remote_etag: change.etag ?? null,
        remote_content_hash: change.content_hash ?? null,
        remote_modified_at: change.modified_at ?? null,
        sync_status: 'pending_download',
        is_placeholder: true,
      });
    } else {
      // Existing file - check for changes
      if (existingState.remote_content_hash !== change.content_hash) {
        // Remote changed
        if (existingState.local_content_hash &&
            existingState.local_content_hash !== existingState.remote_content_hash) {
          // Local also changed - conflict!
          this.db.updateFileStatus(existingState.id, 'conflict');
        } else {
          // Only remote changed
          this.db.upsertFileState({
            subscription_id: subscriptionId,
            remote_path: change.path,
            remote_etag: change.etag ?? null,
            remote_content_hash: change.content_hash ?? null,
            remote_modified_at: change.modified_at ?? null,
            sync_status: existingState.is_placeholder ? 'placeholder' : 'pending_download',
          });

          if (!existingState.is_placeholder) {
            this.db.addToSyncQueue(existingState.id, 'download');
          }
        }
      }
    }
  }

  private async processQueue(): Promise<void> {
    let processed = 0;
    const maxItems = 10; // Process up to 10 items per cycle

    while (processed < maxItems) {
      const item = this.db.getNextQueueItem();
      if (!item) break;

      try {
        switch (item.operation) {
          case 'download':
            await this.downloadFile(item.file_state_id);
            break;
          case 'upload':
            await this.uploadFile(item.file_state_id);
            break;
          case 'delete':
            await this.deleteLocalFile(item.file_state_id);
            break;
        }
        this.db.removeFromQueue(item.id);
      } catch (error) {
        console.error(`Queue item ${item.id} failed:`, error);
        // Leave in queue for retry
      }

      processed++;
    }
  }

  private async downloadFile(fileStateId: number): Promise<void> {
    const syncFolder = this.db.getSyncFolder();
    if (!syncFolder) {
      throw new Error('Sync folder not configured');
    }

    // Get file state from local db - we need the remote_path
    const fileStates = this.db.getFileStates();
    const fileState = fileStates.find(f => f.id === fileStateId);
    if (!fileState) {
      throw new Error('File state not found');
    }

    this.updateStatus({ current_file: fileState.file_name });

    // Get download URL from server
    const { url } = await this.apiRequest<{ url: string }>('/api/v1/sync/download_url', {
      method: 'POST',
      body: JSON.stringify({ remote_path: fileState.remote_path }),
    });

    // Download file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Download failed');
    }

    const localPath = path.join(syncFolder, fileState.remote_path);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(localPath), { recursive: true });

    // Write file
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(localPath, buffer);

    // Calculate hash and mark as synced
    const hash = await this.hashFile(localPath);
    this.db.markFileSynced(fileStateId, hash);

    this.updateStatus({ current_file: undefined });
  }

  private async uploadFile(fileStateId: number): Promise<void> {
    const syncFolder = this.db.getSyncFolder();
    if (!syncFolder) {
      throw new Error('Sync folder not configured');
    }

    const fileStates = this.db.getFileStates();
    const fileState = fileStates.find(f => f.id === fileStateId);
    if (!fileState) {
      throw new Error('File state not found');
    }

    const localPath = path.join(syncFolder, fileState.remote_path);
    if (!fs.existsSync(localPath)) {
      throw new Error('Local file not found');
    }

    this.updateStatus({ current_file: fileState.file_name });

    // Get upload URL from server
    const { url, fields } = await this.apiRequest<{ url: string; fields?: Record<string, string> }>(
      '/api/v1/sync/upload',
      {
        method: 'POST',
        body: JSON.stringify({
          remote_path: fileState.remote_path,
          file_size: fs.statSync(localPath).size,
        }),
      }
    );

    // Upload file
    const fileContent = fs.readFileSync(localPath);
    const formData = new FormData();

    if (fields) {
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    formData.append('file', new Blob([fileContent]));

    const uploadResponse = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error('Upload failed');
    }

    // Notify server upload is complete
    await this.apiRequest('/api/v1/sync/upload_complete', {
      method: 'POST',
      body: JSON.stringify({ remote_path: fileState.remote_path }),
    });

    // Calculate hash and mark as synced
    const hash = await this.hashFile(localPath);
    this.db.markFileSynced(fileStateId, hash);

    this.updateStatus({ current_file: undefined });
  }

  private async deleteLocalFile(fileStateId: number): Promise<void> {
    const syncFolder = this.db.getSyncFolder();
    if (!syncFolder) return;

    const fileStates = this.db.getFileStates();
    const fileState = fileStates.find(f => f.id === fileStateId);
    if (!fileState) return;

    const localPath = path.join(syncFolder, fileState.remote_path);

    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    this.db.deleteFileState(fileStateId);
  }

  private async hashFile(filePath: string): Promise<string> {
    // Use Node.js crypto for hashing (fast enough for our purposes)
    const crypto = await import('crypto');
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
}
