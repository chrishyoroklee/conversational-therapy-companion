import { useState, useEffect, useCallback } from 'react'
import StatusBar from './components/StatusBar'
import ChatHistory from './components/ChatHistory'
import TranscriptDisplay from './components/TranscriptDisplay'
import MicrophoneButton from './components/MicrophoneButton'
import type { Message } from './types/messages'

type EngineStatus = 'loading' | 'ready' | 'error'

export default function App(): React.JSX.Element {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('loading')
  const [statusMessage, setStatusMessage] = useState<string>()
  const [isRecording, setIsRecording] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: Date.now()
      }
    ])
  }, [])

  useEffect(() => {
    const api = window.therapyAPI
    if (!api) return

    api.onEngineMessage((message) => {
      const type = message.type as string

      switch (type) {
        case 'ready':
          setEngineStatus('ready')
          setStatusMessage(undefined)
          break

        case 'error':
          setEngineStatus('error')
          setStatusMessage(message.message as string)
          setIsProcessing(false)
          break

        case 'asr_processing':
          setIsProcessing(true)
          setCurrentTranscript('')
          break

        case 'asr_result': {
          const text = message.text as string
          setCurrentTranscript(text)
          setIsProcessing(false)

          if (text.trim()) {
            addMessage('user', text)
            // Send to LLM
            api.sendToEngine({ type: 'llm', text })
            setIsProcessing(true)
          }
          break
        }

        case 'llm_processing':
          setIsProcessing(true)
          break

        case 'llm_result': {
          const response = message.text as string
          addMessage('assistant', response)
          setIsProcessing(false)
          setCurrentTranscript('')
          break
        }
      }
    })

    return () => {
      api.removeEngineListener()
    }
  }, [addMessage])

  const handleMicClick = useCallback(async () => {
    const api = window.therapyAPI
    if (!api) return

    if (isRecording) {
      setIsRecording(false)
      const filePath = await api.stopRecording()
      if (filePath) {
        api.sendToEngine({ type: 'asr', path: filePath })
      }
    } else {
      setIsRecording(true)
      await api.startRecording()
    }
  }, [isRecording])

  return (
    <div className="h-screen flex flex-col bg-therapy-bg">
      <StatusBar status={engineStatus} message={statusMessage} />

      <ChatHistory messages={messages} />

      <TranscriptDisplay transcript={currentTranscript} isProcessing={isProcessing} />

      <MicrophoneButton
        isRecording={isRecording}
        disabled={engineStatus !== 'ready'}
        onClick={handleMicClick}
      />
    </div>
  )
}
