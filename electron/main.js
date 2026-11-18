const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');

// ব্যাকগ্রাউন্ডে ডিফল্ট AdGuard DNS-over-HTTPS
app.commandLine.appendSwitch('enable-features', 'DnsOverHttps');
app.commandLine.appendSwitch('dns-over-https-mode', 'secure');
app.commandLine.appendSwitch('dns-over-https-templates', 'https://dns.adguard-dns.com/dns-query');

const AD_HOSTS = [
  '*://*.doubleclick.net/*',
  '*://*.googleadservices.com/*',
  '*://*.googlesyndication.com/*',
  '*://*.youtube.com/api/stats/ads*',
  '*://*.youtube.com/pagead/*',
  '*://*.youtube.com/ptracking*'
];

function attachAdBlockerToSession(targetSession) {
  if (!targetSession || !targetSession.webRequest) return;
  targetSession.webRequest.onBeforeRequest({ urls: AD_HOSTS }, (details, cb) => {
    cb({ cancel: true });
  });
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 340,
    minHeight: 200,
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  });

  attachAdBlockerToSession(session.defaultSession);

  const url =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, '../dist/index.html')}`;
  win.loadURL(url);

  win.on('closed', () => {
    win = null;
  });
}

// webview সহ যেকোনো নতুন webContents-এ অ্যাড ব্লক সক্রিয় রাখা
app.on('web-contents-created', (_, contents) => {
  attachAdBlockerToSession(contents.session);
});

ipcMain.on('set-float-mode', (_, floating) => {
  if (!win || win.isDestroyed()) return;
  const isFloat = Boolean(floating);
  win.setAlwaysOnTop(isFloat, 'floating');
  if (isFloat) {
    win.setSize(460, 270);
  } else {
    win.setSize(1200, 760);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
