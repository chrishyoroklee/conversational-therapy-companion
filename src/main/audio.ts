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
    let deviceName = 'Microphone Array (Qualcomm(R) Aqstic(TM) ACX Static Endpoints Audio Device)' // Default fallback

    try {
      // Run ffmpeg to list devices
      // ffmpeg -list_devices true -f dshow -i dummy
      // Output is sent to stderr
      const output = require('child_process').execSync('ffmpeg -list_devices true -f dshow -i dummy 2>&1', { encoding: 'utf8' })

      // Look for audio devices
      // Pattern: [dshow @ ...]  "Microphone Name" (audio)
      const match = output.match(/] "(.*)" \(audio\)/)
      if (match && match[1]) {
        deviceName = match[1]
        console.log(`[Audio] Detected microphone: ${deviceName}`)
      }
    } catch (e) {
      console.warn('[Audio] Failed to detect microphone, using default:', deviceName)
    }

    recordCommand = `ffmpeg -f dshow -i audio="${deviceName}" -ar 16000 -ac 1 -acodec pcm_s16le -y "${filePath}"`
  } else {
    // macOS/Linux: Use sox (rec)
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
