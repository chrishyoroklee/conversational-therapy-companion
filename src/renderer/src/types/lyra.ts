export type Screen = 'landing' | 'onboarding' | 'checkin' | 'session' | 'crisis' | 'gratitude'

export type RiskLevel = 'low' | 'medium' | 'high' | null

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'disabled'

export type InputMode = 'voice' | 'text'

export interface LyraMessage {
  id: string
  role: 'user' | 'lyra'
  text: string
  timestamp: number
  status: 'final' | 'streaming'
}

export type EngineStatus = 'loading' | 'ready' | 'error'

export interface GratitudeEntry {
  id: string
  text: string
  date: string
}

export interface LyraState {
  screen: Screen
  engineStatus: EngineStatus
  statusMessage: string | undefined
  riskLevel: RiskLevel
  orbState: OrbState
  inputMode: InputMode
  isRecording: boolean
  messages: LyraMessage[]
  currentTranscript: string
  sessionIntent: string | null
  turnCount: number
  gratitudeDeclined: boolean
  showReflectionModal: boolean
  autoRegenUsed: boolean
}
