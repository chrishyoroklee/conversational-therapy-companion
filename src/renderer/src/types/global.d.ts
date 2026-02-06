interface TherapyAPI {
  startRecording: () => Promise<string>
  stopRecording: () => Promise<string | null>
  sendToEngine: (message: Record<string, unknown>) => Promise<void>
  onEngineMessage: (callback: (message: Record<string, unknown>) => void) => (() => void)
  removeEngineListener: () => void
}

declare global {
  interface Window {
    therapyAPI: TherapyAPI
  }
}

export {}
