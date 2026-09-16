import { app, BrowserWindow, screen, ipcMain, shell, safeStorage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

const isDev = !app.isPackaged;
const PROTOCOL = 'notesify';

// Ensure single instance for deep linking
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Register custom protocol
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Command line is an array of strings; the deep link is usually the last one
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      handleDeepLink(url);
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.whenReady().then(() => {
    setupIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

function handleDeepLink(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.hostname === 'callback' && url.searchParams.has('code')) {
      const code = url.searchParams.get('code');
      if (mainWindow) {
        mainWindow.webContents.send('oauth-callback', code);
      }
    }
  } catch (err) {
    console.error("Failed to parse deep link:", err);
  }
}

const THIN_SCROLLBAR_CSS = `
  ::-webkit-scrollbar { width: 4px !important; height: 4px !important; }
  ::-webkit-scrollbar-track { background: transparent !important; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15) !important; border-radius: 999px !important; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28) !important; }
  ::-webkit-scrollbar-corner { background: transparent !important; }
`;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width),
    height: Math.min(800, height),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    title: "Notesify - AI Powered Notes & Learning",
    backgroundColor: '#0f0f11',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#ffffff',
      height: 35
    },
  });

  mainWindow.setMenuBarVisibility(false);

  // Intercept window opens (e.g. Google Login) and open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'frontend', 'dist', 'index.html'));
  }

  // Inject thin scrollbars after every page load (dev + prod)
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(THIN_SCROLLBAR_CSS);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ----------------------------------------------------
// IPC Secure Storage Handlers for Refresh Token
// ----------------------------------------------------
function getStoragePath() {
  return path.join(app.getPath('userData'), 'secure-token.dat');
}

function setupIpcHandlers() {
  ipcMain.handle('set-refresh-token', async (event, token) => {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(token);
        fs.writeFileSync(getStoragePath(), encrypted);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to save refresh token:', e);
      return false;
    }
  });

  ipcMain.handle('get-refresh-token', async () => {
    try {
      const storagePath = getStoragePath();
      if (fs.existsSync(storagePath) && safeStorage.isEncryptionAvailable()) {
        const encrypted = fs.readFileSync(storagePath);
        return safeStorage.decryptString(encrypted);
      }
      return null;
    } catch (e) {
      console.error('Failed to read refresh token:', e);
      return null;
    }
  });

  ipcMain.handle('clear-refresh-token', async () => {
    try {
      const storagePath = getStoragePath();
      if (fs.existsSync(storagePath)) {
        fs.unlinkSync(storagePath);
      }
      return true;
    } catch (e) {
      console.error('Failed to clear refresh token:', e);
      return false;
    }
  });

  ipcMain.handle('open-external', async (event, url) => {
    shell.openExternal(url);
  });
}
