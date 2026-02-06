import { ipcMain, BrowserWindow } from 'electron'
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

  // Forward sidecar messages to renderer
  onSidecarMessage((message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('engine:message', message)
    }
  })
}
