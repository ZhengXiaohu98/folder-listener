import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

contextBridge.exposeInMainWorld('darkMode', {
  toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
  system: () => ipcRenderer.invoke('dark-mode:system'),
  get: () => ipcRenderer.invoke('dark-mode:get'),
  onUpdated: (callback: (isDark: boolean) => void) => {
    ipcRenderer.on('theme-updated', (_event, isDark) => callback(isDark))
  }
})

contextBridge.exposeInMainWorld('watcherAPI', {
  start: () => ipcRenderer.invoke('watcher:start'),
  stop: () => ipcRenderer.invoke('watcher:stop'),
  status: () => ipcRenderer.invoke('watcher:status'),
  getActivities: () => ipcRenderer.invoke('db:activities'),
  getActivitiesPaged: (opts: any) => ipcRenderer.invoke('db:activities-paged', opts),
  getStats: () => ipcRenderer.invoke('db:stats'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('shell:openPath', folderPath),
  onActivityAdded: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('activity-added', listener);
    return () => ipcRenderer.off('activity-added', listener);
  }
})
