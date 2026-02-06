import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { app } from 'electron'

let sidecar: ChildProcess | null = null
let buffer = ''

type MessageCallback = (message: Record<string, unknown>) => void
const listeners: Set<MessageCallback> = new Set()

function getPythonPath(): string {
  const isWindows = process.platform === 'win32'
  const pythonExecutable = isWindows ? 'Scripts\\python.exe' : 'bin/python'
  
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'venv', pythonExecutable)
  }
  return path.join(app.getAppPath(), 'python', 'venv', pythonExecutable)
}

function getEnginePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'engine.py')
  }
  return path.join(app.getAppPath(), 'python', 'engine.py')
}

export function startSidecar(): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath()
    const enginePath = getEnginePath()

    console.log(`Starting sidecar: ${pythonPath} ${enginePath}`)

    sidecar = spawn(pythonPath, [enginePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(enginePath)
    })

    const readyTimeout = setTimeout(() => {
      reject(new Error('Sidecar failed to become ready within 60s'))
    }, 60_000)

    const onReady = (message: Record<string, unknown>): void => {
      if (message.type === 'ready') {
        clearTimeout(readyTimeout)
        offSidecarMessage(onReady)
        resolve()
      }
    }

    onSidecarMessage(onReady)

    sidecar.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const message = JSON.parse(line)
          for (const cb of listeners) {
            cb(message)
          }
        } catch {
          console.error('Failed to parse sidecar output:', line)
        }
      }
    })

    sidecar.stderr?.on('data', (data: Buffer) => {
      console.error('[sidecar]', data.toString().trim())
    })

    sidecar.on('error', (err) => {
      console.error('Sidecar process error:', err)
      clearTimeout(readyTimeout)
      reject(err)
    })

    sidecar.on('exit', (code) => {
      console.log(`Sidecar exited with code ${code}`)
      sidecar = null
    })
  })
}

export function stopSidecar(): void {
  if (sidecar) {
    sidecar.kill()
    sidecar = null
  }
}

export function sendToSidecar(message: Record<string, unknown>): void {
  if (!sidecar?.stdin?.writable) {
    console.error('Sidecar is not running')
    return
  }
  sidecar.stdin.write(JSON.stringify(message) + '\n')
}

export function onSidecarMessage(callback: MessageCallback): void {
  listeners.add(callback)
}

export function offSidecarMessage(callback: MessageCallback): void {
  listeners.delete(callback)
}
