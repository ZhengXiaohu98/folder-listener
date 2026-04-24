import { app, BrowserWindow, ipcMain, nativeTheme, dialog, shell, Tray, Menu, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import {
  startWatcher, stopWatcher, getWatcherStatus,
  startPipelineWatcher, stopPipelineWatcher,
  getActivities, getActivitiesPaged, getStats, setMainWindow, applyWatcherConfig,
  type Pipeline,
} from './watcher.js'
import { setLoggerWindow, getLogs, clearLogs, logger } from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let tray: Tray | null = null
let isQuitting = false

function getAppIconPath() {
  if (process.platform === 'darwin') {
    return path.join(process.env.VITE_PUBLIC, 'logo-dock.png')
  }
  return path.join(process.env.VITE_PUBLIC, 'logo.png')
}

function setDockIcon() {
  if (process.platform !== 'darwin') return
  app.dock?.setIcon(getAppIconPath())
}

function createTray() {
  const iconPath = getAppIconPath()
  let trayIcon = nativeImage.createFromPath(iconPath)

  if (process.platform === 'darwin') {
    trayIcon = trayIcon.resize({ width: 18, height: 18 })
  } else {
    trayIcon = trayIcon.resize({ width: 16, height: 16 })
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Folder Listener')

  const updateContextMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示 Folder Listener',
        click: () => showWindow(),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ])
    tray?.setContextMenu(contextMenu)
  }

  updateContextMenu()

  tray.on('click', () => {
    showWindow()
  })
}

async function showWindow() {
  if (!win) return
  if (process.platform === 'darwin') {
    await app.dock?.show()
    setDockIcon()
  }
  win.show()
  win.focus()
}

function hideWindow() {
  if (!win) return
  win.hide()
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }
}

function createWindow() {
  const appIcon = getAppIconPath()

  setDockIcon()

  win = new BrowserWindow({
    width: 1000,
    height: 750,
    show: false,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.once('ready-to-show', () => {
    win?.show()
  })

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      hideWindow()
    }
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  setMainWindow(win)
  setLoggerWindow(win)
}

app.on('window-all-closed', () => {
  if (isQuitting) {
    tray?.destroy()
    tray = null
    win = null
    if (process.platform !== 'darwin') {
      app.quit()
    }
  }
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('activate', () => {
  if (win) {
    showWindow()
  } else {
    createWindow()
  }
})

// ---------------------------------------------------------------------------
// Default pipeline factory
// ---------------------------------------------------------------------------
const DEFAULT_COMPRESSION_MAIN = {
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

function createDefaultPipeline(): Pipeline {
  return {
    id: `pipeline-${Date.now()}`,
    name: 'Pipeline 1',
    enabled: false,
    sourceFolder: app.getPath('downloads'),
    destFolder: path.join(app.getPath('documents'), 'MagicFolder', 'Processed'),
    hookEnabled: false,
    hookCode: '',
    ...DEFAULT_COMPRESSION_MAIN,
  }
}

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
      const parsed = JSON.parse(data)

      // Migration: if no pipelines array, create one from legacy single-pipeline config
      if (!parsed.pipelines) {
        const migratedPipeline: Pipeline = {
          id: `pipeline-${Date.now()}`,
          name: 'Pipeline 1',
          enabled: false,
          sourceFolder: parsed.sourceFolder ?? app.getPath('downloads'),
          destFolder: parsed.destFolder ?? path.join(app.getPath('documents'), 'MagicFolder', 'Processed'),
          hookEnabled: parsed.hookEnabled ?? false,
          hookCode: parsed.hookCode ?? '',
          // Migrate top-level compression settings into the pipeline
          compressionLevel: parsed.compressionLevel ?? DEFAULT_COMPRESSION_MAIN.compressionLevel,
          customOptions: parsed.customOptions ?? DEFAULT_COMPRESSION_MAIN.customOptions,
          supportedFormats: parsed.supportedFormats ?? DEFAULT_COMPRESSION_MAIN.supportedFormats,
          advancedOptions: parsed.advancedOptions ?? DEFAULT_COMPRESSION_MAIN.advancedOptions,
          outputFormat: parsed.outputFormat ?? DEFAULT_COMPRESSION_MAIN.outputFormat,
        }
        parsed.pipelines = [migratedPipeline]
        await fs.writeFile(configPath, JSON.stringify(parsed, null, 2))
      } else {
        // Hydrate existing pipelines that may be missing compression fields
        parsed.pipelines = parsed.pipelines.map((p: any) => ({
          ...DEFAULT_COMPRESSION_MAIN,
          ...p,
        }))
      }

      return parsed
    } catch (err) {
      console.log('Failed to read config, generating defaults', err)
      const defaultPipeline = createDefaultPipeline()
      const defaultConfig = {
        theme: 'system',
        accent: '青色',
        pipelines: [defaultPipeline],
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

  // -------------------------------------------------------------------------
  // Watcher IPC — multi-pipeline
  // -------------------------------------------------------------------------

  /** Start ALL enabled pipelines */
  ipcMain.handle('watcher:start', async () => {
    const config = await getConfig()
    await startWatcher(config)
    return getWatcherStatus()
  })

  /** Stop ALL pipeline watchers */
  ipcMain.handle('watcher:stop', async () => {
    await stopWatcher()
    return getWatcherStatus()
  })

  /** Returns Record<pipelineId, boolean> */
  ipcMain.handle('watcher:status', () => {
    return getWatcherStatus()
  })

  /** Start a specific pipeline by id */
  ipcMain.handle('watcher:start-pipeline', async (_, pipelineId: string) => {
    const config = await getConfig()
    const pipelines: Pipeline[] = config.pipelines ?? []
    const pipeline = pipelines.find((p: Pipeline) => p.id === pipelineId)
    if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`)
    await startPipelineWatcher(pipeline, config)
    // Persist enabled state
    const updated = pipelines.map((p: Pipeline) => p.id === pipelineId ? { ...p, enabled: true } : p)
    await setConfig({ pipelines: updated })
    return getWatcherStatus()
  })

  /** Stop a specific pipeline by id */
  ipcMain.handle('watcher:stop-pipeline', async (_, pipelineId: string) => {
    await stopPipelineWatcher(pipelineId)
    // Persist disabled state
    const config = await getConfig()
    const pipelines: Pipeline[] = config.pipelines ?? []
    const updated = pipelines.map((p: Pipeline) => p.id === pipelineId ? { ...p, enabled: false } : p)
    await setConfig({ pipelines: updated })
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
  createTray()
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
