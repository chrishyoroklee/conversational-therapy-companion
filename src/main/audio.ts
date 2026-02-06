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

  // Use platform-specific recording commands
  let recordCommand: string
  if (process.platform === 'win32') {
    // Windows: Use FFmpeg to record from default audio input
    // Use the microphone device found on this system
    recordCommand = `ffmpeg -f dshow -i audio="Microphone Array (Qualcomm(R) Aqstic(TM) ACX Static Endpoints Audio Device)" -ar 16000 -ac 1 -acodec pcm_s16le -y "${filePath}"`
  } else {
    // macOS/Linux: Use sox (rec) 
    // Requires sox to be installed: brew install sox (macOS) or apt install sox (Linux)
    recordCommand = `rec -r 16000 -c 1 -b 16 "${filePath}"`
  }
  
  recordProcess = exec(recordCommand, (error) => {
    if (error && !error.killed) {
      console.error('Recording error:', error.message)
    }
  })

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
      // Add a small delay to ensure file is fully written
      setTimeout(() => {
        resolve(filePath)
      }, 100)
    })

    // Use 'q' command to gracefully stop FFmpeg instead of SIGINT
    if (process.platform === 'win32') {
      proc.stdin?.write('q')
      proc.stdin?.end()
    } else {
      proc.kill('SIGINT')
    }
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
