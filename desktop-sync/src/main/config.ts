// API Configuration
// In development, use local backend. In production, use the Heroku backend.

const isDev = process.env.NODE_ENV === 'development';

export const API_BASE_URL = isDev
  ? 'http://localhost:3001'
  : 'https://teeemlive-ce8e2660a615.herokuapp.com';

// Sync configuration
export const SYNC_CONFIG = {
  // How often to check for changes (in milliseconds)
  pollInterval: 30 * 1000, // 30 seconds

  // Maximum concurrent downloads
  maxConcurrentDownloads: 3,

  // Maximum concurrent uploads
  maxConcurrentUploads: 2,

  // Chunk size for large file uploads (5MB)
  uploadChunkSize: 5 * 1024 * 1024,

  // Retry configuration
  maxRetries: 3,
  retryDelayMs: 1000,
  retryBackoffMultiplier: 2,
};

// File system configuration
export const FS_CONFIG = {
  // Default sync folder location
  defaultSyncFolder: {
    darwin: '~/TEEEM Sync',
    win32: '%USERPROFILE%\\TEEEM Sync',
    linux: '~/TEEEM Sync',
  } as Record<string, string>,

  // Files to always ignore
  ignoredFiles: [
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',
    '.teeem-sync',
  ],
};
