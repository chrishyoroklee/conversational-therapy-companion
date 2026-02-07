import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { startSidecar, stopSidecar } from './sidecar'
import { cleanupTempFiles } from './audio'
import { setupIPC } from './ipc'
import { setupCodeYellow } from './codeYellow'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#F8F9FA',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.therapy.companion')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()
  setupIPC(mainWindow)
  setupCodeYellow(mainWindow)

  // Start the Python sidecar after renderer has loaded so IPC listeners are ready
  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      await startSidecar()
      mainWindow.webContents.send('engine:message', { type: 'ready' })
    } catch (err) {
      console.error('Failed to start sidecar:', err)
      mainWindow.webContents.send('engine:message', {
        type: 'error',
        message: 'Failed to start AI engine. Check Python setup.'
      })
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createWindow()
      setupIPC(window)
    }
  })
})

app.on('window-all-closed', () => {
  stopSidecar()
  cleanupTempFiles()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopSidecar()
  cleanupTempFiles()
})
