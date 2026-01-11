import React, { useState, useEffect } from 'react';

interface MainPageProps {
  onSettings: () => void;
  onLogout: () => void;
}

interface UserInfo {
  name: string;
  email: string;
  organization: { name: string };
}

interface SyncStatus {
  state: 'idle' | 'syncing' | 'paused' | 'error';
  pending_downloads: number;
  pending_uploads: number;
  last_sync_at?: string;
  current_file?: string;
  error?: string;
}

interface SyncSubscription {
  id: string;
  folder_name: string;
  folder_type: string;
  last_sync_at?: string;
}

interface SyncFolder {
  id: string;
  name: string;
  type: string;
  file_count?: number;
}

export default function MainPage({ onSettings, onLogout }: MainPageProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [status, setStatus] = useState<SyncStatus>({
    state: 'idle',
    pending_downloads: 0,
    pending_uploads: 0,
  });
  const [subscriptions, setSubscriptions] = useState<SyncSubscription[]>([]);
  const [availableFolders, setAvailableFolders] = useState<SyncFolder[]>([]);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Listen for status updates
    window.electronAPI.on('sync:status', (newStatus: unknown) => {
      setStatus(newStatus as SyncStatus);
    });
  }, []);

  const loadData = async () => {
    try {
      const [userInfo, syncStatus, subs] = await Promise.all([
        window.electronAPI.auth.getUser(),
        window.electronAPI.sync.getStatus(),
        window.electronAPI.sync.getSubscriptions(),
      ]);

      setUser(userInfo);
      setStatus(syncStatus);
      setSubscriptions(subs);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableFolders = async () => {
    try {
      const folders = await window.electronAPI.sync.getFolders();
      setAvailableFolders(folders);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const handleAddFolder = async () => {
    await loadAvailableFolders();
    setShowFolderPicker(true);
  };

  const handleSelectFolder = async (folder: SyncFolder) => {
    try {
      await window.electronAPI.sync.subscribe(folder.id, folder.type);
      await loadData();
      setShowFolderPicker(false);
    } catch (error) {
      console.error('Failed to subscribe:', error);
    }
  };

  const handleRemoveFolder = async (subscriptionId: string) => {
    try {
      await window.electronAPI.sync.unsubscribe(subscriptionId);
      await loadData();
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    }
  };

  const handleSyncNow = async () => {
    await window.electronAPI.sync.syncNow();
  };

  const handlePauseResume = () => {
    if (status.state === 'paused') {
      window.electronAPI.sync.resume();
    } else {
      window.electronAPI.sync.pause();
    }
  };

  const getStatusIcon = () => {
    switch (status.state) {
      case 'syncing':
        return (
          <svg
            className="animate-spin h-5 w-5 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        );
      case 'paused':
        return (
          <svg
            className="h-5 w-5 text-yellow-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            className="h-5 w-5 text-red-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="h-5 w-5 text-green-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const getStatusText = () => {
    switch (status.state) {
      case 'syncing':
        return status.current_file
          ? `Syncing: ${status.current_file}`
          : 'Syncing...';
      case 'paused':
        return 'Sync paused';
      case 'error':
        return status.error || 'Sync error';
      default:
        const pending = status.pending_downloads + status.pending_uploads;
        if (pending > 0) {
          return `${pending} file${pending > 1 ? 's' : ''} pending`;
        }
        return 'All files synced';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {getStatusText()}
              </p>
              {status.last_sync_at && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last sync: {new Date(status.last_sync_at).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={status.state === 'syncing'}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
              title="Sync now"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={handlePauseResume}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title={status.state === 'paused' ? 'Resume' : 'Pause'}
            >
              {status.state === 'paused' ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
            <button
              onClick={onSettings}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Settings"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* User info */}
      {user && (
        <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800/50">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {user.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {user.organization.name}
          </p>
        </div>
      )}

      {/* Synced folders */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">
              Synced Folders
            </h2>
            <button
              onClick={handleAddFolder}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              + Add Folder
            </button>
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No folders synced yet
            </p>
            <button
              onClick={handleAddFolder}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              Add your first folder
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {subscriptions.map((sub) => (
              <li
                key={sub.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="h-5 w-5 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {sub.folder_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {sub.folder_type.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFolder(sub.id)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  title="Remove"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Folder picker modal */}
      {showFolderPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm max-h-96 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Select Folder to Sync
              </h3>
              <button
                onClick={() => setShowFolderPicker(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {availableFolders.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Loading folders...
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {availableFolders.map((folder) => (
                    <li key={folder.id}>
                      <button
                        onClick={() => handleSelectFolder(folder)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                      >
                        <svg
                          className="h-5 w-5 text-blue-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {folder.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {folder.type.replace('_', ' ')}
                            {folder.file_count !== undefined && ` • ${folder.file_count} files`}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
