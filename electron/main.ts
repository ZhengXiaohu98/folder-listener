import { app, BrowserWindow, ipcMain, nativeTheme, dialog, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { startWatcher, stopWatcher, getWatcherStatus, getActivities, getActivitiesPaged, getStats, setMainWindow, applyWatcherConfig } from './watcher.js'
import { setLoggerWindow, getLogs, clearLogs, logger } from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  const appIcon = path.join(process.env.VITE_PUBLIC, 'logo.png')

  if (process.platform === 'darwin') {
    app.dock?.setIcon(appIcon)
  }

  win = new BrowserWindow({
    width: 1000,
    height: 750,
    show: false, // Prevent white screen flash by hiding until ready
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Prevent white screen flash
  win.once('ready-to-show', () => {
    win?.show()
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  setMainWindow(win)
  setLoggerWindow(win)
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) {
      nativeTheme.themeSource = 'light'
    } else {
      nativeTheme.themeSource = 'dark'
    }
    return nativeTheme.shouldUseDarkColors
  })

  ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system'
  })

  ipcMain.handle('dark-mode:get', () => {
    return nativeTheme.shouldUseDarkColors
  })

  const configPath = path.join(app.getPath('userData'), 'config.json')

  const getConfig = async () => {
    try {
      const data = await fs.readFile(configPath, 'utf-8')
      return JSON.parse(data)
    } catch (err) {
      console.log('Failed to read config, generating defaults', err)
      const defaultConfig = {
        theme: 'system',
        accent: '青色',
        sourceFolder: app.getPath('downloads'),
        destFolder: path.join(app.getPath('documents'), 'MagicFolder', 'Processed'),
        compressionLevel: 'Medium',
        customOptions: { quality: 80, maxWidth: 1920 },
        supportedFormats: { jpeg: true, png: true, webp: true, gif: true, svg: true, avif: true },
        advancedOptions: {
          autoDelete: false,
          enableCustomSuffix: false,
          customSuffix: '-min',
          enableCustomFileName: false,
          customFileName: 'folder-listener',
        },
        outputFormat: 'Original',
      }
      try {
        await fs.mkdir(path.dirname(configPath), { recursive: true })
        await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2))
      } catch (writeErr) {
        console.error('Failed to write default config', writeErr)
      }
      return defaultConfig
    }
  }

  const setConfig = async (updates: any) => {
    const current = await getConfig()
    const updated = { ...current, ...updates }
    try {
      await fs.writeFile(configPath, JSON.stringify(updated, null, 2))
      await applyWatcherConfig(updated)
    } catch (err) {
      console.error('Failed to save config', err)
    }
    return updated
  }

  ipcMain.handle('get-config', async () => {
    return await getConfig()
  })

  ipcMain.handle('set-config', async (_, updates) => {
    return await setConfig(updates)
  })

  ipcMain.handle('select-folder', async () => {
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (!canceled && filePaths.length > 0) {
      return filePaths[0]
    }
    return null
  })

  ipcMain.handle('shell:openPath', async (_, folderPath: string) => {
    if (!folderPath) return
    await shell.openPath(folderPath)
  })

  nativeTheme.on('updated', () => {
    win?.webContents.send('theme-updated', nativeTheme.shouldUseDarkColors)
  })

  ipcMain.handle('watcher:start', async () => {
    const config = await getConfig()
    await startWatcher(config)
    return getWatcherStatus()
  })

  ipcMain.handle('watcher:stop', async () => {
    await stopWatcher()
    return getWatcherStatus()
  })

  ipcMain.handle('watcher:status', () => {
    return getWatcherStatus()
  })

  ipcMain.handle('db:activities', async () => {
    return await getActivities()
  })

  ipcMain.handle('db:activities-paged', async (_, { page = 1, pageSize = 10, timeFilter = 'all' } = {}) => {
    return await getActivitiesPaged({ page, pageSize, timeFilter })
  })

  ipcMain.handle('db:stats', async () => {
    return await getStats()
  })

  ipcMain.handle('logs:get', async (_, opts = {}) => {
    return await getLogs(opts)
  })

  ipcMain.handle('logs:clear', async () => {
    await clearLogs()
  })

  createWindow()
})

// ---------------------------------------------------------------------------
// Capture global process errors and log them
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err)
  logger.error('app', `Uncaught exception: ${err.message}`, err.stack)
})

process.on('unhandledRejection', (reason: any) => {
  const msg = reason?.message ?? String(reason)
  const stack = reason?.stack ?? undefined
  console.error('[main] Unhandled rejection:', reason)
  logger.error('app', `Unhandled rejection: ${msg}`, stack)
})
