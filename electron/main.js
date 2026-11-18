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

  session.defaultSession.webRequest.onBeforeRequest({ urls: AD_HOSTS }, (details, cb) => {
    cb({ cancel: true });
  });

  const url = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;
  win.loadURL(url);
}

ipcMain.on('set-float-mode', (_, floating) => {
  if (!win) return;
  win.setAlwaysOnTop(floating, 'screen-saver');
  if (floating) win.setSize(460, 270);
  else win.setSize(1200, 760);
});

app.whenReady().then(createWindow);
