import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const therapyAPI = {
  startRecording: (): Promise<string> => ipcRenderer.invoke('audio:start'),
  stopRecording: (): Promise<string | null> => ipcRenderer.invoke('audio:stop'),
  sendToEngine: (message: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke('engine:send', message),
  onEngineMessage: (callback: (message: Record<string, unknown>) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: Record<string, unknown>): void =>
      callback(message)
    ipcRenderer.on('engine:message', handler)
    return () => {
      ipcRenderer.removeListener('engine:message', handler)
    }
  },
  readAudioFile: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('audio:read', filePath),
  removeEngineListener: (): void => {
    ipcRenderer.removeAllListeners('engine:message')
  },
  codeYellow: {
    onTriggered: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on('code-yellow:triggered', handler)
      return () => {
        ipcRenderer.removeListener('code-yellow:triggered', handler)
      }
    },
    sendConsent: (consented: boolean): void => {
      ipcRenderer.send('code-yellow:consent', consented)
    },
    submitZip: (zip: string): void => {
      ipcRenderer.send('code-yellow:zip-lookup', zip)
    },
    onResults: (callback: (data: unknown) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => callback(data)
      ipcRenderer.on('code-yellow:results', handler)
      return () => {
        ipcRenderer.removeListener('code-yellow:results', handler)
      }
    }
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
