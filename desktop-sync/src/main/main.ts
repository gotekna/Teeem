import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from 'electron';
import path from 'path';
import { SyncEngine } from './sync-engine';
import { AuthManager } from './auth-manager';
import { LocalDatabase } from './local-database';

// Keep references to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let syncEngine: SyncEngine | null = null;
let authManager: AuthManager | null = null;
let localDb: LocalDatabase | null = null;

const isDev = process.env.NODE_ENV === 'development';

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    minWidth: 400,
    minHeight: 500,
    show: false,
    frame: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', (event) => {
    // Minimize to tray instead of closing
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('ready-to-show', () => {
    // Only show on first launch or if not logged in
    if (!authManager?.isLoggedIn()) {
      mainWindow?.show();
    }
  });
}

function createTray(): void {
  // Create tray icon (use a placeholder for now)
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  // Fallback to empty icon if asset doesn't exist
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open TEEEM Sync',
      click: () => {
        mainWindow?.show();
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Sync Status',
      submenu: [
        {
          label: 'All files synced',
          enabled: false,
        },
      ],
    },
    {
      label: 'Sync Now',
      click: () => {
        syncEngine?.syncNow();
      },
    },
    {
      label: 'Pause Syncing',
      click: () => {
        syncEngine?.pause();
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Preferences...',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('navigate', '/settings');
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit TEEEM Sync',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('TEEEM Sync');
  tray.setContextMenu(contextMenu);

  // Double-click to open window
  tray.on('double-click', () => {
    mainWindow?.show();
  });
}

function setupIPC(): void {
  // Auth IPC handlers
  ipcMain.handle('auth:getDeviceCode', async () => {
    return authManager?.initiateDeviceAuth();
  });

  ipcMain.handle('auth:pollStatus', async () => {
    return authManager?.pollAuthStatus();
  });

  ipcMain.handle('auth:logout', async () => {
    return authManager?.logout();
  });

  ipcMain.handle('auth:isLoggedIn', () => {
    return authManager?.isLoggedIn() ?? false;
  });

  ipcMain.handle('auth:getUser', () => {
    return authManager?.getCurrentUser();
  });

  // Sync IPC handlers
  ipcMain.handle('sync:getFolders', async () => {
    return syncEngine?.getAvailableFolders();
  });

  ipcMain.handle('sync:getSubscriptions', async () => {
    return syncEngine?.getSubscriptions();
  });

  ipcMain.handle('sync:subscribe', async (_event, folderId: string, folderType: string) => {
    return syncEngine?.subscribe(folderId, folderType);
  });

  ipcMain.handle('sync:unsubscribe', async (_event, subscriptionId: string) => {
    return syncEngine?.unsubscribe(subscriptionId);
  });

  ipcMain.handle('sync:getExclusions', async () => {
    return syncEngine?.getExclusionRules();
  });

  ipcMain.handle('sync:updateExclusions', async (_event, rules: unknown[]) => {
    return syncEngine?.updateExclusionRules(rules);
  });

  ipcMain.handle('sync:getStatus', () => {
    return syncEngine?.getStatus();
  });

  ipcMain.handle('sync:syncNow', async () => {
    return syncEngine?.syncNow();
  });

  ipcMain.handle('sync:pause', () => {
    syncEngine?.pause();
  });

  ipcMain.handle('sync:resume', () => {
    syncEngine?.resume();
  });

  // File operations
  ipcMain.handle('files:getSyncFolder', () => {
    return localDb?.getSyncFolder();
  });

  ipcMain.handle('files:setSyncFolder', async (_event, folderPath: string) => {
    return localDb?.setSyncFolder(folderPath);
  });

  ipcMain.handle('files:getFileStates', async () => {
    return localDb?.getFileStates();
  });
}

async function initializeApp(): Promise<void> {
  // Initialize local database
  const userDataPath = app.getPath('userData');
  localDb = new LocalDatabase(path.join(userDataPath, 'teeem-sync.db'));
  await localDb.initialize();

  // Initialize auth manager
  authManager = new AuthManager(localDb);

  // Initialize sync engine
  syncEngine = new SyncEngine(authManager, localDb);

  // Set up IPC handlers
  setupIPC();

  // Create UI
  createWindow();
  createTray();

  // Start sync if logged in
  if (authManager.isLoggedIn()) {
    syncEngine.start();
  }
}

// App lifecycle
app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  // Don't quit on macOS - keep running in tray
  if (process.platform !== 'darwin') {
    // Still keep running in tray on Windows
  }
});

app.on('activate', () => {
  // On macOS, re-create window if dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

app.on('before-quit', () => {
  // Actually quit when user explicitly quits
  syncEngine?.stop();
  localDb?.close();
});
