import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('capture', {
  listSources: () => ipcRenderer.invoke('capture:list-sources'),
  select: (id: string, withAudio: boolean) => ipcRenderer.invoke('capture:select', id, withAudio)
})
