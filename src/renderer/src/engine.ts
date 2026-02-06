type EngineMessageHandler = (message: Record<string, unknown>) => void

export function onEngineMessage(handler: EngineMessageHandler): () => void {
  const api = window.therapyAPI
  if (!api) {
    console.error('therapyAPI not available')
    return () => {}
  }
  return api.onEngineMessage(handler)
}

export async function startListening(): Promise<string> {
  return window.therapyAPI.startRecording()
}

export async function stopListening(): Promise<string | null> {
  return window.therapyAPI.stopRecording()
}

export function sendAudioForTranscription(filePath: string): void {
  window.therapyAPI.sendToEngine({ type: 'asr', path: filePath })
}

export function sendTextToLyra(text: string): void {
  window.therapyAPI.sendToEngine({ type: 'llm', text })
}

export async function speak(audioPath: string): Promise<void> {
  const dataUrl = await window.therapyAPI.readAudioFile(audioPath)
  if (dataUrl) {
    const audio = new Audio(dataUrl)
    await audio.play()
  }
}
