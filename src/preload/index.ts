import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const therapyAPI = {
  startRecording: (): Promise<string> => ipcRenderer.invoke('audio:start'),
  stopRecording: (): Promise<string | null> => ipcRenderer.invoke('audio:stop'),
  sendToEngine: (message: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke('engine:send', message),
  onEngineMessage: (callback: (message: Record<string, unknown>) => void): void => {
    ipcRenderer.on('engine:message', (_event, message) => callback(message))
  },
  removeEngineListener: (): void => {
    ipcRenderer.removeAllListeners('engine:message')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('therapyAPI', therapyAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error fallback for non-isolated context
  window.electron = electronAPI
  // @ts-expect-error fallback
  window.therapyAPI = therapyAPI
}
