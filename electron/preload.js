const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('venomElectron', {
  setFloatMode: (enabled) => ipcRenderer.send('set-float-mode', Boolean(enabled))
});
