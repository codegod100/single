const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronChromeExtensions } = require('electron-chrome-extensions');
const ECx = require('electron-chrome-extension');

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('no-zygote');
  app.disableHardwareAcceleration();
}

let extensions;

async function loadExtensions() {
  const extensionsPath = path.join(app.getPath('userData'), 'extensions');
  console.log(`Extensions folder: ${extensionsPath}`);
  if (!fs.existsSync(extensionsPath)) {
    fs.mkdirSync(extensionsPath, { recursive: true });
  }

  const extensionFolders = fs.readdirSync(extensionsPath);
  for (const folder of extensionFolders) {
    const fullPath = path.join(extensionsPath, folder);
    if (fs.statSync(fullPath).isDirectory()) {
      try {
        await session.defaultSession.loadExtension(fullPath);
        console.log(`Loaded extension: ${folder}`);
      } catch (e) {
        console.error(`Failed to load extension ${folder}:`, e);
      }
    }
  }
}

async function installFromStore(extensionId) {
  try {
    console.log(`Installing extension from store: ${extensionId}...`);
    const extension = await ECx.load(extensionId);
    console.log(`Successfully installed extension: ${extension.name}`);
    return true;
  } catch (err) {
    console.error('Installation failed:', err);
    return false;
  }
}

function createWindow(url = 'https://www.google.com') {
  console.log(`Creating window for ${url}...`);
  
  // Extension support needs to be initialized before window creation if possible, 
  // or at least before we add tabs.
  if (!extensions) {
    extensions = new ElectronChromeExtensions({
      license: 'GPL-3.0',
      modulePath: path.join(__dirname, 'node_modules/electron-chrome-extensions'),
    });
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true, // Need this for injectBrowserAction in some versions
      contextIsolation: false, // Easier for the custom elements to work
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the "browser chrome" (URL bar, etc.)
  win.loadFile('index.html');

  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.setBrowserView(view);
  
  // Set bounds for the view (below the URL bar)
  const updateBounds = () => {
    const [width, height] = win.getContentSize();
    view.setBounds({ x: 0, y: 50, width, height: height - 50 });
  };

  win.on('resize', updateBounds);
  updateBounds();

  view.webContents.loadURL(url);

  let isInternalNavigation = false;

  // Open all links in a new window
  view.webContents.setWindowOpenHandler(({ url }) => {
    createWindow(url);
    return { action: 'deny' };
  });

  view.webContents.on('will-navigate', (event, url) => {
    if (isInternalNavigation) {
      isInternalNavigation = false;
      return;
    }
    event.preventDefault();
    createWindow(url);
  });

  // Update URL bar when navigation occurs
  view.webContents.on('did-finish-load', () => {
    console.log(`Loaded ${view.webContents.getURL()}`);
    win.webContents.send('url-changed', view.webContents.getURL());
  });

  // Extension support - add the view's webContents to the extension handler
  extensions.addTab(view.webContents, win);

  ipcMain.on('navigate', async (event, targetUrl) => {
    const targetWin = BrowserWindow.fromWebContents(event.sender);
    if (targetWin === win) {
      if (targetUrl.startsWith('/install ')) {
        const id = targetUrl.replace('/install ', '').trim();
        await installFromStore(id);
        // Refresh to show the new extension icons if they don't auto-appear
        win.webContents.reload();
        return;
      }
      isInternalNavigation = true;
      view.webContents.loadURL(targetUrl);
    }
  });

  ipcMain.on('go-back', (event) => {
    if (BrowserWindow.fromWebContents(event.sender) === win) {
      if (view.webContents.canGoBack()) view.webContents.goBack();
    }
  });

  ipcMain.on('go-forward', (event) => {
    if (BrowserWindow.fromWebContents(event.sender) === win) {
      if (view.webContents.canGoForward()) view.webContents.goForward();
    }
  });

  return win;
}

app.whenReady().then(async () => {
  await loadExtensions();
  createWindow();
  console.log('App ready and initial window created.');

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
