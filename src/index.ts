import { app, BrowserWindow, utilityProcess, dialog, Menu, autoUpdater, session, MenuItem, ipcMain } from 'electron';
import log from 'electron-log/main'
import Store from "electron-store"
import path from "node:path";
import fs from "node:fs"
import { name, version } from "../package.json";
import * as sqlite3 from "sqlite3";

import { setupDbIpc, setupMiscIpc, setupPatchingIpc, setUpStoreIpc } from './ipc';
import { CallGetExpressUriChannel, OnFirstStartChannel, OnOpenChannel, OnSaveChannel } from './ipc/channels';
import { AppDataStore, ArmorSubclass, InventoryType, ItemRarity } from './models';
import { sleep } from './utils';

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const EXPRESS_APP_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null;

let firstTimeStart = false;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// this should be placed at top of main.js to handle setup events quickly
if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
} else {
  log.initialize();
  log.transports.console.format = '{h}:{i}:{s}.{ms} > [{processType}] {text}';
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{processType}] {text}'

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', function () {
    setUpMenu();
    createWindow();
    setupIpc();
    log.info(`Application is ready, running version: ${version}!`);
  });

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  if (!firstTimeStart && app.isPackaged) {
    const updateRootUri = "https://freedom-customize-tool-updates.vercel.app";
    const url = `${updateRootUri}/update/${process.platform}/${app.getVersion()}`
    autoUpdater.setFeedURL({ url });

    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 60000 * 15);
    setTimeout(() => {
      autoUpdater.checkForUpdates()
    }, 60000);

    autoUpdater.on('update-downloaded', (_, releaseNotes, releaseName)=> {
        const dialogOpts: Electron.MessageBoxOptions  = {
          type: 'info',
          buttons: ['Restart', 'Later'],
          title: 'Application Update',
          message: process.platform === 'win32' ? releaseNotes : releaseName,
          detail:
            'A new version has been downloaded. Restart the application to apply the updates.'
        }
      
        dialog.showMessageBox(dialogOpts).then((returnValue) => {
          if (returnValue.response === 0) 
            autoUpdater.quitAndInstall()
        })
    });
    autoUpdater.on('error', (message) => {
      log.error('Auto updater ran into an error:');
      log.error(message);
    })
  }
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');
  const path = require('path');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command: string, args: any[]) {
    let spawnedProcess, error;
    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args: any[]) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // spawnUpdate(['--createShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;
    case '--squirrel-uninstall':
      // spawnUpdate(['--removeShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;
    case '--squirrel-obsolete':
      app.quit();
      return true;
    case '--squirrel-firstrun':
      firstTimeStart = true;
    }
};

// Setup IPC
let expressPort = 0;
async function setupIpc() {
  ipcMain.handle(CallGetExpressUriChannel, async () => {
    while(expressPort === 0) {
      await sleep(250);
    }
    const expressUrl = `http://localhost:${expressPort}`
    return expressUrl;
  })
  
  setupMiscIpc(mainWindow);

  const store = new Store<AppDataStore>({
    defaults: {
      settings: {
        useDarkMode: false,
        freedomWoWRootDir: '',
        launchWoWAfterPatch: true,
        previewCharacter: {
          "race": 11,
          "gender": 1,
          "customizations": []
        }
      },
      itemData: {
        metadata: {
          name: "My Awesome Item",
          fileIconId: 0,
          fileIconName: "inv_misc_questionmark.blp",
          rarity: ItemRarity.Legendary,
          sheatheType: 0,
          subClass: ArmorSubclass.Cloth
        },
        itemMaterials: {},
        itemComponentModels: {
          "0": {
            texture: {
              id: -1,
              name: ""
            },
            models: []
          },
          "1": {
            texture: {
              id: -1,
              name: ""
            },
            models: []
          }
        },
        particleColors: [],
        helmetGeoVisMale: [],
        helmetGeoVisFemale: [],
        flags: 0,
        inventoryType: InventoryType.Head,
        geoSetGroup: [0, 0, 0, 0, 0]
      }
    }
  })
  log.info("Initializing app data store from path: " + store.path);
  setUpStoreIpc(store);

  const dbPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.db")
    : "./src/packaged/app.db";
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, err => {
    if (err) {
      throw err;
    }
  });
  setupDbIpc(db);

  const toolPath = app.isPackaged
    ? path.join(process.resourcesPath, "DBXPatchTool.exe")
    : path.resolve("../WDBXEditor2/publish/DBXPatchTool.exe");
  setupPatchingIpc(mainWindow, toolPath, store);

  await sleep(3000);
  const settings = store.get('settings')
  if (!settings.freedomWoWRootDir) {
    const freedomClientSettingsPath = path.resolve(app.getPath("appData"), "../Local/WoWFreedomClient/appstate.json");
    let suggestedPath = '';
    if (fs.existsSync(freedomClientSettingsPath)) {
      const settingsFile = await fs.promises.readFile(freedomClientSettingsPath);
      const appState = JSON.parse(settingsFile.toString());
      suggestedPath = appState.InstallPath;
    }
    mainWindow.webContents.send(OnFirstStartChannel, {
      suggestedDir: suggestedPath,
      launchWoWAfterPatch: settings.launchWoWAfterPatch,
      previewCharacter: settings.previewCharacter
    })
  }
}

// Setup menu
function setUpMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Open File...', accelerator: 'CommandOrControl+O', click: onOpenClick },
        { label: 'Save', accelerator: 'CommandOrControl+S', click: onSaveClick },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(app.isPackaged 
            ? [{ type: 'separator' }] 
            : [{ role: 'toggleDevTools' },{ type: 'separator' }]) as Electron.MenuItemConstructorOptions[],
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    }
  ]
  
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

async function createWindow(): Promise<void> {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
    
  });

  // Start express server
  try {
    const expressPath = app.isPackaged
      ? path.join(process.resourcesPath, "express_app.js")
      : "./.webpack/main/express_app.js";

    log.info("Starting express process: " + expressPath);
    const expressAppProcess = utilityProcess.fork(expressPath, [], {
      stdio: "pipe",
    });
    expressAppProcess.on('message', (msg) => {
      expressPort = parseInt(msg.toString());
      log.info("Express is running on port: ", expressPort);
    });
    log.info("Express running as pid: " + expressAppProcess.pid)
    mainWindow.on("closed", () => {
      mainWindow = null;
      expressAppProcess.kill()
    })
  } catch (error: any) {
    log.error('Encountered an error starting express:');
    log.error(error);
  }

  while (expressPort === 0) {
    await sleep(100);
  }
  
  // and load the index.html of the app.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `script-src 'self' http://localhost:${expressPort} ${app.isPackaged ? '' : "'unsafe-eval'"};`,
          `connect-src 'self' http://localhost:${expressPort} ${app.isPackaged ? '' : 'ws://localhost:8249'};`,
          `object-src 'none'; style-src-elem http://wow.zamimg.com file://wow.zamimg.com 'unsafe-inline';`,
          `img-src 'self' blob: data: http://localhost:${expressPort};`
        ] 
      }
    })
  })
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

async function onSaveClick(menuItem: MenuItem, browserWindow: BrowserWindow): Promise<void> {
  browserWindow.webContents.send(OnSaveChannel);
}

async function onOpenClick(menuItem: MenuItem, browserWindow: BrowserWindow): Promise<void> {
  browserWindow.webContents.send(OnOpenChannel);
}