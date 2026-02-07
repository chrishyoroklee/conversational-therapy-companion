import { useReducer, useEffect, useCallback, useRef } from 'react'
import type { LyraState, Screen, RiskLevel, LyraMessage } from '../types/lyra'
import { sanitizeResponse } from '../lib/safeguard'
import * as engine from '../engine'

type Action =
  | { type: 'NAVIGATE'; screen: Screen }
  | { type: 'SET_RISK'; level: RiskLevel }
  | { type: 'SET_INPUT_MODE'; mode: 'voice' | 'text' }
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'ENGINE_READY' }
  | { type: 'ENGINE_ERROR'; message: string }
  | { type: 'ASR_PROCESSING' }
  | { type: 'ASR_RESULT'; text: string }
  | { type: 'LLM_PROCESSING' }
  | { type: 'LLM_RESULT'; text: string }
  | { type: 'TTS_RESULT'; path: string }
  | { type: 'TTS_DONE' }
  | { type: 'ADD_USER_MESSAGE'; text: string }
  | { type: 'SET_INTENT'; intent: string | null }
  | { type: 'DECLINE_GRATITUDE' }
  | { type: 'SHOW_REFLECTION' }
  | { type: 'HIDE_REFLECTION' }
  | { type: 'SET_AUTO_REGEN_USED'; used: boolean }

const initialState: LyraState = {
  screen: 'landing',
  engineStatus: 'loading',
  statusMessage: undefined,
  riskLevel: null,
  orbState: 'disabled',
  inputMode: 'voice',
  isRecording: false,
  messages: [],
  currentTranscript: '',
  sessionIntent: null,
  turnCount: 0,
  gratitudeDeclined: false,
  showReflectionModal: false,
  autoRegenUsed: false,
}

function reducer(state: LyraState, action: Action): LyraState {
  switch (action.type) {
    case 'NAVIGATE': {
      // Seed Lyra's intro message when entering a fresh session
      const enteringFreshSession =
        action.screen === 'session' && state.screen !== 'session' && state.messages.length === 0
      const introMessage: LyraMessage | null = enteringFreshSession
        ? {
            id: crypto.randomUUID(),
            role: 'lyra',
            text: "Hey, I'm Lyra — I'm here to listen and chat with you. Whatever's on your mind, big or small, you can share it at your own pace. How are you doing today?",
            timestamp: Date.now(),
            status: 'final',
          }
        : null

      return {
        ...state,
        screen: action.screen,
        orbState: action.screen === 'session' && state.engineStatus === 'ready' ? 'idle' : state.orbState,
        ...(introMessage ? { messages: [introMessage] } : {}),
        // Reset session state when leaving session
        ...(action.screen === 'landing'
          ? {
            sessionIntent: null,
            turnCount: 0,
            gratitudeDeclined: false,
            showReflectionModal: false,
            messages: [],
            riskLevel: null,
            autoRegenUsed: false,
          }
          : {}),
      }
    }

    case 'SET_RISK':
      return { ...state, riskLevel: action.level }

    case 'SET_INPUT_MODE':
      return { ...state, inputMode: action.mode }

    case 'START_RECORDING':
      return { ...state, isRecording: true, orbState: 'listening' }

    case 'STOP_RECORDING':
      return { ...state, isRecording: false }

    case 'ENGINE_READY':
      return {
        ...state,
        engineStatus: 'ready',
        statusMessage: undefined,
        orbState: state.screen === 'session' ? 'idle' : state.orbState,
      }

    case 'ENGINE_ERROR':
      return {
        ...state,
        engineStatus: 'error',
        statusMessage: action.message,
        orbState: 'disabled',
      }

    case 'ASR_PROCESSING':
      return { ...state, orbState: 'thinking', currentTranscript: '' }

    case 'ASR_RESULT': {
      if (!action.text.trim()) {
        return { ...state, orbState: 'idle' }
      }
      const userMsg: LyraMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: action.text,
        timestamp: Date.now(),
        status: 'final',
      }
      return {
        ...state,
        currentTranscript: action.text,
        orbState: 'thinking',
        messages: [...state.messages, userMsg],
        autoRegenUsed: false,
      }
    }

    case 'ADD_USER_MESSAGE': {
      const msg: LyraMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: action.text,
        timestamp: Date.now(),
        status: 'final',
      }
      return {
        ...state,
        orbState: 'thinking',
        messages: [...state.messages, msg],
        autoRegenUsed: false,
      }
    }

    case 'LLM_PROCESSING':
      return { ...state, orbState: 'thinking' }

    case 'LLM_RESULT': {
      const sanitized = sanitizeResponse(action.text)
      const lyraMsg: LyraMessage = {
        id: crypto.randomUUID(),
        role: 'lyra',
        text: sanitized,
        timestamp: Date.now(),
        status: 'final',
      }
      return {
        ...state,
        orbState: 'speaking',
        messages: [...state.messages, lyraMsg],
        currentTranscript: '',
        turnCount: state.turnCount + 1,
        autoRegenUsed: false,
      }
    }

    case 'TTS_RESULT':
      return { ...state, orbState: 'speaking' }

    case 'TTS_DONE':
      return { ...state, orbState: 'idle' }

    case 'SET_INTENT':
      return { ...state, sessionIntent: action.intent }

    case 'DECLINE_GRATITUDE':
      return { ...state, gratitudeDeclined: true }

    case 'SHOW_REFLECTION':
      return { ...state, showReflectionModal: true }

    case 'HIDE_REFLECTION':
      return { ...state, showReflectionModal: false }

    case 'SET_AUTO_REGEN_USED':
      return { ...state, autoRegenUsed: action.used }

    default:
      return state
  }
}

export function useLyraState() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const cleanup = engine.onEngineMessage((message) => {
      const type = message.type as string

      switch (type) {
        case 'ready':
          dispatch({ type: 'ENGINE_READY' })
          break
        case 'error':
          dispatch({ type: 'ENGINE_ERROR', message: message.message as string })
          break
        case 'asr_processing':
          dispatch({ type: 'ASR_PROCESSING' })
          break
        case 'asr_result': {
          const text = message.text as string
          dispatch({ type: 'ASR_RESULT', text })
          if (text.trim()) {
            engine.sendTextToLyra(text)
          }
          break
        }
        case 'llm_processing':
          dispatch({ type: 'LLM_PROCESSING' })
          break
        case 'llm_result': {
          const riskLevel = (message.risk_level as string) ?? 'green'
          const actions = (message.actions as string[]) ?? []
          let assistantText = (message.text as string) ?? ''

          // RED — crisis: navigate to crisis screen, no transcript message
          if (riskLevel === 'red' || actions.includes('crisis')) {
            dispatch({ type: 'NAVIGATE', screen: 'crisis' })
            break
          }

          // YELLOW — show support banner AND render the assistant text
          if (riskLevel === 'yellow') {
            dispatch({ type: 'SET_RISK', level: 'medium' })
          }

          // Fail-safe: if non-RED response has no text, use fallback
          if (!assistantText.trim()) {
            console.warn('[lyra] Empty assistant_text for non-RED response. Raw payload:', message)
            assistantText = "I'm here with you. Can you tell me a little more about what's going on?"
          }

          dispatch({ type: 'LLM_RESULT', text: assistantText })
          break
        }
        case 'tts_result': {
          const audioPath = message.path as string | null
          if (audioPath) {
            dispatch({ type: 'TTS_RESULT', path: audioPath })
            engine.speak(audioPath)
              .then(() => dispatch({ type: 'TTS_DONE' }))
              .catch(() => dispatch({ type: 'TTS_DONE' }))
          } else {
            dispatch({ type: 'TTS_DONE' })
          }
          break
        }
      }
    })

    return cleanup
  }, [])

  const navigate = useCallback((screen: Screen) => {
    dispatch({ type: 'NAVIGATE', screen })
  }, [])

  const setRisk = useCallback((level: RiskLevel) => {
    dispatch({ type: 'SET_RISK', level })
    if (level === 'high') {
      dispatch({ type: 'NAVIGATE', screen: 'crisis' })
    } else {
      dispatch({ type: 'NAVIGATE', screen: 'session' })
    }
  }, [])

  const toggleInputMode = useCallback(() => {
    dispatch({
      type: 'SET_INPUT_MODE',
      mode: state.inputMode === 'voice' ? 'text' : 'voice',
    })
  }, [state.inputMode])

  const startRecording = useCallback(async () => {
    dispatch({ type: 'START_RECORDING' })
    await engine.startListening()
  }, [])

  const stopRecording = useCallback(async () => {
    dispatch({ type: 'STOP_RECORDING' })
    const filePath = await engine.stopListening()
    if (filePath) {
      engine.sendAudioForTranscription(filePath)
    }
  }, [])

  const sendText = useCallback((text: string) => {
    if (!text.trim()) return
    dispatch({ type: 'ADD_USER_MESSAGE', text })
    engine.sendTextToLyra(text)
  }, [state.sessionIntent])

  const setIntent = useCallback((intent: string | null) => {
    dispatch({ type: 'SET_INTENT', intent })
  }, [])

  const declineGratitude = useCallback(() => {
    dispatch({ type: 'DECLINE_GRATITUDE' })
  }, [])

  const requestEndSession = useCallback(() => {
    dispatch({ type: 'SHOW_REFLECTION' })
  }, [])

  const confirmEndSession = useCallback(() => {
    dispatch({ type: 'HIDE_REFLECTION' })
    dispatch({ type: 'NAVIGATE', screen: 'landing' })
  }, [])

  return {
    state,
    navigate,
    setRisk,
    toggleInputMode,
    startRecording,
    stopRecording,
    sendText,
    setIntent,
    declineGratitude,
    requestEndSession,
    confirmEndSession,
  }
}
