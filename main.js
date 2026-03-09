const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronChromeExtensions } = require('electron-chrome-extensions');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('no-zygote');
  app.disableHardwareAcceleration();
}

let extensions;
const windowViews = new Map();

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
    const extensionsPath = path.join(app.getPath('userData'), 'extensions');
    const targetPath = path.join(extensionsPath, extensionId);
    
    if (fs.existsSync(targetPath)) {
      console.log(`Extension ${extensionId} already installed.`);
      return true;
    }

    console.log(`Downloading extension from store: ${extensionId}...`);
    const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=114.0.5735.198&x=id%3D${extensionId}%26installsource%3Dondemand%26uc`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

    const buffer = await response.buffer();
    const pkIndex = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (pkIndex === -1) throw new Error('Could not find ZIP start in CRX file');
    
    const zipBuffer = buffer.slice(pkIndex);
    const zip = new AdmZip(zipBuffer);
    
    fs.mkdirSync(targetPath, { recursive: true });
    zip.extractAllTo(targetPath, true);
    
    console.log(`Successfully installed extension: ${extensionId}`);
    await session.defaultSession.loadExtension(targetPath);
    return true;
  } catch (err) {
    console.error('Installation failed:', err);
    return false;
  }
}

function createWindow(url = 'https://www.google.com') {
  console.log(`Creating window for ${url}...`);
  
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
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile('index.html');

  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.setBrowserView(view);
  windowViews.set(win.id, { view, isInternalNavigation: false });
  
  const updateBounds = () => {
    const [width, height] = win.getContentSize();
    view.setBounds({ x: 0, y: 50, width, height: height - 50 });
  };

  win.on('resize', updateBounds);
  updateBounds();

  view.webContents.loadURL(url);

  const updateUrlBar = () => {
    if (win.isDestroyed()) return;
    const currentUrl = view.webContents.getURL();
    console.log(`URL updated for win ${win.id}: ${currentUrl}`);
    win.webContents.send('url-changed', currentUrl);
  };

  view.webContents.on('did-start-navigation', updateUrlBar);
  view.webContents.on('did-navigate', updateUrlBar);
  view.webContents.on('did-finish-load', updateUrlBar);

  view.webContents.setWindowOpenHandler(({ url }) => {
    createWindow(url);
    return { action: 'deny' };
  });

  view.webContents.on('will-navigate', (event, url) => {
    const state = windowViews.get(win.id);
    if (state && state.isInternalNavigation) {
      state.isInternalNavigation = false;
      return;
    }
    event.preventDefault();
    createWindow(url);
  });

  extensions.addTab(view.webContents, win);

  win.on('closed', () => {
    windowViews.delete(win.id);
  });

  return win;
}

ipcMain.on('navigate', async (event, targetUrl) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const state = windowViews.get(win.id);
  if (state) {
    if (targetUrl.startsWith('/install ')) {
      const id = targetUrl.replace('/install ', '').trim();
      await installFromStore(id);
      state.view.webContents.reload();
      return;
    }
    state.isInternalNavigation = true;
    state.view.webContents.loadURL(targetUrl);
  }
});

ipcMain.on('go-back', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const state = windowViews.get(win.id);
  if (state && state.view.webContents.canGoBack()) {
    state.view.webContents.goBack();
  }
});

ipcMain.on('go-forward', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const state = windowViews.get(win.id);
  if (state && state.view.webContents.canGoForward()) {
    state.view.webContents.goForward();
  }
});

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
