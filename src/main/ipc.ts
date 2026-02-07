import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import { startRecording, stopRecording } from './audio'
import { sendToSidecar, onSidecarMessage } from './sidecar'

export function setupIPC(mainWindow: BrowserWindow): void {
  ipcMain.handle('audio:start', () => {
    const filePath = startRecording()
    return filePath
  })

  ipcMain.handle('audio:stop', async () => {
    const filePath = await stopRecording()
    return filePath
  })

  ipcMain.handle('engine:send', (_event, message: Record<string, unknown>) => {
    sendToSidecar(message)
  })

  ipcMain.handle('audio:read', (_event, filePath: string) => {
    try {
      const data = fs.readFileSync(filePath)
      const ext = filePath.endsWith('.mp3') ? 'mpeg' : 'wav'
      return `data:audio/${ext};base64,${data.toString('base64')}`
    } catch {
      return null
    }
  })

  // Forward sidecar messages to renderer
  onSidecarMessage((message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Intercept code_yellow events from sidecar
      if (message.type === 'code_yellow' && message.triggered) {
        mainWindow.webContents.send('code-yellow:triggered')
        return
      }
      mainWindow.webContents.send('engine:message', message)
    }
  })
}
