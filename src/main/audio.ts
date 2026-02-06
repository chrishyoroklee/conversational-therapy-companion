import { exec, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

let recordProcess: ChildProcess | null = null
let currentFilePath: string | null = null

function getTempDir(): string {
  const tempDir = path.join(os.tmpdir(), 'therapy-companion')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  return tempDir
}

export function startRecording(): string {
  const filePath = path.join(getTempDir(), `recording_${Date.now()}.wav`)
  currentFilePath = filePath

  // Use sox (rec) for cross-platform recording
  // Requires sox to be installed: brew install sox
  recordProcess = exec(
    `rec -r 16000 -c 1 -b 16 "${filePath}"`,
    (error) => {
      if (error && !error.killed) {
        console.error('Recording error:', error.message)
      }
    }
  )

  return filePath
}

export function stopRecording(): Promise<string | null> {
  const filePath = currentFilePath
  currentFilePath = null

  if (!recordProcess) {
    return Promise.resolve(filePath)
  }

  return new Promise((resolve) => {
    const proc = recordProcess!
    recordProcess = null

    proc.on('exit', () => {
      resolve(filePath)
    })

    proc.kill('SIGINT')
  })
}

export function cleanupTempFiles(): void {
  const tempDir = getTempDir()
  try {
    const files = fs.readdirSync(tempDir)
    for (const file of files) {
      fs.unlinkSync(path.join(tempDir, file))
    }
  } catch {
    // ignore cleanup errors
  }
}
