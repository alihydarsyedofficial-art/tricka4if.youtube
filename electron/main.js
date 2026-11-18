const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Enable AdGuard DNS-over-HTTPS & uninterrupted background media playback
app.commandLine.appendSwitch('dns-over-https-mode', 'secure');
app.commandLine.appendSwitch('dns-over-https-templates', 'https://dns.adguard-dns.com/dns-query');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const AD_BLOCK_PATTERNS = [
  /doubleclick\.net/i,
  /googlesyndication\.com/i,
  /googleadservices\.com/i,
  /adservice\.google\./i,
  /imasdk\.googleapis\.com/i,
  /youtube\.com\/api\/stats\/ads/i,
  /youtube\.com\/pagead\//i,
  /youtube\.com\/ptracking/i,
  /youtube\.com\/get_midroll_info/i,
  /youtube\.com\/pcs\/activeview/i,
  /youtube\.com\/error_204\?.*ad/i,
  /s0\.2mdn\.net/i,
  /static\.doubleclick\.net/i
];

function isBlockedAdUrl(url) {
  return AD_BLOCK_PATTERNS.some((pattern) => pattern.test(url));
}

function attachAdBlockerToSession(targetSession) {
  if (!targetSession || targetSession.__venomAdBlockerAttached) return;
  targetSession.__venomAdBlockerAttached = true;

  targetSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    if (isBlockedAdUrl(details.url)) {
      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });
}

let mainWindow = null;

function createMainWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  const hasPreload = fs.existsSync(preloadPath);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 220,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    title: 'YT Pure Float — Venom YT Mod',
    webPreferences: {
      preload: hasPreload ? preloadPath : undefined,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      backgroundThrottling: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Safely handle Always-On-Top Floating Mini-Player Mode
ipcMain.on('set-float-mode', (_event, enabled) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const isFloating = Boolean(enabled);
    if (isFloating) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      mainWindow.setAlwaysOnTop(true, 'floating');
      mainWindow.setSize(440, 290, true);
    } else {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setSize(1280, 820, true);
      mainWindow.center();
    }
  } catch (_) {
    // Prevent window state exceptions on unsupported window managers
  }
});

app.whenReady().then(() => {
  attachAdBlockerToSession(session.defaultSession);
  attachAdBlockerToSession(session.fromPartition('persist:ytpure'));

  app.on('session-created', (newSession) => {
    attachAdBlockerToSession(newSession);
  });

  app.on('web-contents-created', (_event, contents) => {
    if (contents.session) {
      attachAdBlockerToSession(contents.session);
    }
    contents.setWindowOpenHandler(({ url }) => {
      if (isBlockedAdUrl(url)) {
        return { action: 'deny' };
      }
      if (contents.getType() === 'webview') {
        contents.loadURL(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
