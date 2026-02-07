import { useState } from 'react'

interface GratitudeSuggestionProps {
  onAccept: (text: string) => void
  onDecline: () => void
}

export default function GratitudeSuggestion({ onAccept, onDecline }: GratitudeSuggestionProps) {
  const [showInput, setShowInput] = useState(false)
  const [text, setText] = useState('')

  if (showInput) {
    return (
      <div className="mx-4 p-4 rounded-xl bg-lyra-surface/80 animate-fade-in space-y-3">
        <p className="text-sm text-lyra-text">Name one small thing that felt okay today.</p>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              onAccept(text.trim())
            }
          }}
          placeholder="e.g. My morning coffee was nice"
          className="w-full px-3 py-2 rounded-lg bg-lyra-bg text-sm text-lyra-text
                     placeholder:text-lyra-text-muted/50
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDecline}
            className="text-xs text-lyra-text-muted hover:text-lyra-text transition-colors px-2 py-1"
          >
            Never mind
          </button>
          <button
            onClick={() => text.trim() && onAccept(text.trim())}
            disabled={!text.trim()}
            className="text-xs font-medium text-lyra-accent hover:text-lyra-accent-soft
                       transition-colors px-3 py-1 rounded-lg
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-4 p-4 rounded-xl bg-lyra-surface/80 animate-fade-in space-y-3">
      <p className="text-sm text-lyra-text leading-relaxed">
        Sometimes it can soften things to name one small thing that felt okay today. Would you like
        to try that?
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setShowInput(true)}
          className="text-xs font-medium text-lyra-accent hover:text-lyra-accent-soft
                     transition-colors px-3 py-1 rounded-lg"
        >
          Sure
        </button>
        <button
          onClick={onDecline}
          className="text-xs text-lyra-text-muted hover:text-lyra-text transition-colors px-2 py-1"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
