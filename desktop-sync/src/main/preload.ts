import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication
  auth: {
    getDeviceCode: () => ipcRenderer.invoke('auth:getDeviceCode'),
    pollStatus: () => ipcRenderer.invoke('auth:pollStatus'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    isLoggedIn: () => ipcRenderer.invoke('auth:isLoggedIn'),
    getUser: () => ipcRenderer.invoke('auth:getUser'),
  },

  // Sync operations
  sync: {
    getFolders: () => ipcRenderer.invoke('sync:getFolders'),
    getSubscriptions: () => ipcRenderer.invoke('sync:getSubscriptions'),
    subscribe: (folderId: string, folderType: string) =>
      ipcRenderer.invoke('sync:subscribe', folderId, folderType),
    unsubscribe: (subscriptionId: string) =>
      ipcRenderer.invoke('sync:unsubscribe', subscriptionId),
    getExclusions: () => ipcRenderer.invoke('sync:getExclusions'),
    updateExclusions: (rules: unknown[]) =>
      ipcRenderer.invoke('sync:updateExclusions', rules),
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    syncNow: () => ipcRenderer.invoke('sync:syncNow'),
    pause: () => ipcRenderer.invoke('sync:pause'),
    resume: () => ipcRenderer.invoke('sync:resume'),
  },

  // File operations
  files: {
    getSyncFolder: () => ipcRenderer.invoke('files:getSyncFolder'),
    setSyncFolder: (folderPath: string) =>
      ipcRenderer.invoke('files:setSyncFolder', folderPath),
    getFileStates: () => ipcRenderer.invoke('files:getFileStates'),
  },

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const allowedChannels = ['navigate', 'sync:status', 'sync:progress', 'sync:error'];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

// Type definitions for the exposed API
export interface ElectronAPI {
  auth: {
    getDeviceCode: () => Promise<DeviceCodeResponse>;
    pollStatus: () => Promise<AuthPollResponse>;
    logout: () => Promise<void>;
    isLoggedIn: () => Promise<boolean>;
    getUser: () => Promise<UserInfo | null>;
  };
  sync: {
    getFolders: () => Promise<SyncFolder[]>;
    getSubscriptions: () => Promise<SyncSubscription[]>;
    subscribe: (folderId: string, folderType: string) => Promise<SyncSubscription>;
    unsubscribe: (subscriptionId: string) => Promise<void>;
    getExclusions: () => Promise<ExclusionRule[]>;
    updateExclusions: (rules: unknown[]) => Promise<void>;
    getStatus: () => Promise<SyncStatus>;
    syncNow: () => Promise<void>;
    pause: () => void;
    resume: () => void;
  };
  files: {
    getSyncFolder: () => Promise<string | null>;
    setSyncFolder: (folderPath: string) => Promise<void>;
    getFileStates: () => Promise<FileState[]>;
  };
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

interface AuthPollResponse {
  status: 'pending' | 'authorized' | 'expired' | 'error';
  access_token?: string;
  refresh_token?: string;
  user?: UserInfo;
}

interface UserInfo {
  id: number;
  email: string;
  name: string;
  organization: {
    id: number;
    name: string;
  };
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

interface SyncStatus {
  state: 'idle' | 'syncing' | 'paused' | 'error';
  pending_downloads: number;
  pending_uploads: number;
  last_sync_at?: string;
  current_file?: string;
  progress?: number;
  error?: string;
}

interface FileState {
  id: string;
  remote_path: string;
  file_name: string;
  file_size: number;
  sync_status: 'synced' | 'pending_download' | 'pending_upload' | 'conflict' | 'placeholder' | 'error';
  is_placeholder: boolean;
  is_pinned: boolean;
  last_synced_at?: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
