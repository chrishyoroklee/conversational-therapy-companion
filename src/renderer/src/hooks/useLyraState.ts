import { useReducer, useEffect, useCallback } from 'react'
import type { LyraState, Screen, RiskLevel, LyraMessage } from '../types/lyra'
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
}

function reducer(state: LyraState, action: Action): LyraState {
  switch (action.type) {
    case 'NAVIGATE':
      return {
        ...state,
        screen: action.screen,
        orbState: action.screen === 'session' && state.engineStatus === 'ready' ? 'idle' : state.orbState,
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
      }
    }

    case 'LLM_PROCESSING':
      return { ...state, orbState: 'thinking' }

    case 'LLM_RESULT': {
      const lyraMsg: LyraMessage = {
        id: crypto.randomUUID(),
        role: 'lyra',
        text: action.text,
        timestamp: Date.now(),
        status: 'final',
      }
      return {
        ...state,
        orbState: 'speaking',
        messages: [...state.messages, lyraMsg],
        currentTranscript: '',
      }
    }

    case 'TTS_RESULT':
      return { ...state, orbState: 'speaking' }

    case 'TTS_DONE':
      return { ...state, orbState: 'idle' }

    default:
      return state
  }
}

export function useLyraState() {
  const [state, dispatch] = useReducer(reducer, initialState)

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
        case 'llm_result':
          dispatch({ type: 'LLM_RESULT', text: message.text as string })
          break
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
  }, [])

  return {
    state,
    navigate,
    setRisk,
    toggleInputMode,
    startRecording,
    stopRecording,
    sendText,
  }
}
