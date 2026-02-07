import type { CodeYellowResults } from './codeYellow'

interface TherapyAPI {
  startRecording: () => Promise<string>
  stopRecording: () => Promise<string | null>
  sendToEngine: (message: Record<string, unknown>) => Promise<void>
  readAudioFile: (filePath: string) => Promise<string | null>
  onEngineMessage: (callback: (message: Record<string, unknown>) => void) => (() => void)
  removeEngineListener: () => void
  codeYellow: {
    onTriggered: (callback: () => void) => () => void
    sendConsent: (consented: boolean) => void
    submitZip: (zip: string) => void
    onResults: (callback: (data: CodeYellowResults) => void) => () => void
  }
}

declare global {
  interface Window {
    therapyAPI: TherapyAPI
  }
}

export {}
