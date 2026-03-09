const { contextBridge, ipcRenderer } = require('electron');
const { injectBrowserAction } = require('electron-chrome-extensions/browser-action');

// Inject the custom <browser-action-list> element
injectBrowserAction();

contextBridge.exposeInMainWorld('electronAPI', {
  navigate: (url) => ipcRenderer.send('navigate', url),
  goBack: () => ipcRenderer.send('go-back'),
  goForward: () => ipcRenderer.send('go-forward'),
  onUrlChanged: (callback) => ipcRenderer.on('url-changed', (event, url) => callback(url)),
});
