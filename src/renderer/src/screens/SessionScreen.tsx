import ScreenShell from '../components/ScreenShell'
import Orb from '../components/Orb'
import MicButton from '../components/MicButton'
import TextInput from '../components/TextInput'
import Transcript from '../components/Transcript'
import RiskBanner from '../components/RiskBanner'
import IntentChips from '../components/IntentChips'
import GratitudeSuggestion from '../components/GratitudeSuggestion'
import ReflectionModal from '../components/ReflectionModal'
import { addEntry } from '../lib/gratitude'
import type { LyraState } from '../types/lyra'

interface SessionScreenProps {
  state: LyraState
  onStartRecording: () => void
  onStopRecording: () => void
  onSendText: (text: string) => void
  onToggleInputMode: () => void
  onEndSession: () => void
  onConfirmEndSession: () => void
  onSetIntent: (intent: string | null) => void
  onDeclineGratitude: () => void
}

export default function SessionScreen({
  state,
  onStartRecording,
  onStopRecording,
  onSendText,
  onToggleInputMode,
  onEndSession,
  onConfirmEndSession,
  onSetIntent,
  onDeclineGratitude,
}: SessionScreenProps) {
  const {
    orbState,
    messages,
    inputMode,
    isRecording,
    riskLevel,
    engineStatus,
    sessionIntent,
    turnCount,
    gratitudeDeclined,
    showReflectionModal,
  } = state
  const isReady = engineStatus === 'ready'

  const showGratitude =
    turnCount >= 5 &&
    riskLevel !== 'high' &&
    !gratitudeDeclined &&
    orbState !== 'listening' &&
    orbState !== 'thinking'

  return (
    <ScreenShell>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3">
        <span className="text-sm text-lyra-text-muted font-medium">Lyra</span>
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${engineStatus === 'ready'
              ? 'bg-lyra-safe-green'
              : engineStatus === 'loading'
                ? 'bg-lyra-amber animate-pulse'
                : 'bg-lyra-crisis'
              }`}
            aria-label={`Engine status: ${engineStatus}`}
          />
          <button
            onClick={onEndSession}
            className="text-xs text-lyra-text-muted hover:text-lyra-text
                       transition-colors duration-300
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent rounded px-2 py-1"
            aria-label="End session and return to home"
          >
            End session
          </button>
        </div>
      </div>

      {/* Risk banner for medium */}
      {riskLevel === 'medium' && <RiskBanner />}

      {/* Orb */}
      <div className="flex items-center justify-center py-6 flex-shrink-0">
        <Orb state={isReady ? orbState : 'disabled'} size={140} />
      </div>

      {/* Intent chips */}
      <div className="flex flex-col items-center gap-2">
        <IntentChips selected={sessionIntent} onSelect={onSetIntent} />
      </div>

      {/* Gratitude suggestion */}
      {showGratitude && (
        <GratitudeSuggestion
          onAccept={(text) => {
            addEntry(text)
            onDeclineGratitude()
          }}
          onDecline={onDeclineGratitude}
        />
      )}

      {/* Transcript */}
      <Transcript messages={messages} />

      {/* Input area */}
      <div className="pb-6 pt-2 space-y-3 flex-shrink-0">
        {/* Input mode toggle */}
        <div className="flex justify-center">
          <button
            onClick={onToggleInputMode}
            className="text-xs text-lyra-text-muted hover:text-lyra-accent
                       transition-colors duration-300
                       focus:outline-none focus-visible:underline"
            aria-label={`Switch to ${inputMode === 'voice' ? 'text' : 'voice'} input`}
          >
            {inputMode === 'voice' ? 'Type instead' : 'Use voice'}
          </button>
        </div>

        {/* Voice or text input */}
        {inputMode === 'voice' ? (
          <div className="flex justify-center">
            <MicButton
              isRecording={isRecording}
              disabled={!isReady}
              onStart={onStartRecording}
              onStop={onStopRecording}
            />
          </div>
        ) : (
          <TextInput onSend={onSendText} disabled={!isReady} />
        )}
      </div>

      {/* Reflection modal */}
      {showReflectionModal && (
        <ReflectionModal
          messages={messages}
          onAddGratitude={(text) => addEntry(text)}
          onEndSession={onConfirmEndSession}
          onDismiss={onEndSession}
        />
      )}
    </ScreenShell>
  )
}
