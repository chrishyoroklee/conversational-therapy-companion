import { useState } from 'react'
import type { LyraMessage } from '../types/lyra'

interface ReflectionModalProps {
  messages: LyraMessage[]
  onAddGratitude: (text: string) => void
  onEndSession: () => void
  onDismiss: () => void
}

export default function ReflectionModal({
  messages,
  onAddGratitude,
  onEndSession,
  onDismiss,
}: ReflectionModalProps) {
  const [showInput, setShowInput] = useState(false)
  const [text, setText] = useState('')

  // Extract recent user topics (last 3 user messages, truncated)
  const recentTopics = messages
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => (m.text.length > 60 ? m.text.slice(0, 57) + '...' : m.text))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={onDismiss}
    >
      <div
        className="mx-6 max-w-sm w-full bg-lyra-surface rounded-2xl p-6 shadow-xl space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-lyra-text">Before you go...</h2>

        {recentTopics.length > 0 && (
          <div>
            <p className="text-xs text-lyra-text-muted mb-2">Today we talked about:</p>
            <ul className="space-y-1">
              {recentTopics.map((topic, i) => (
                <li key={i} className="text-sm text-lyra-text pl-3 border-l-2 border-lyra-lavender">
                  {topic}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showInput ? (
          <div className="space-y-2">
            <p className="text-sm text-lyra-text">Add one steady thing from today:</p>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && text.trim()) {
                  onAddGratitude(text.trim())
                  onEndSession()
                }
              }}
              placeholder="Something small that felt okay..."
              className="w-full px-3 py-2 rounded-lg bg-lyra-bg text-sm text-lyra-text
                         placeholder:text-lyra-text-muted/50
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowInput(false)}
                className="text-xs text-lyra-text-muted hover:text-lyra-text transition-colors px-2 py-1"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (text.trim()) {
                    onAddGratitude(text.trim())
                    onEndSession()
                  }
                }}
                disabled={!text.trim()}
                className="text-xs font-medium text-lyra-accent hover:text-lyra-accent-soft
                           transition-colors px-3 py-1 rounded-lg
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save & end
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowInput(true)}
              className="w-full py-2 rounded-xl bg-lyra-bg hover:bg-lyra-bg-deep
                         text-sm text-lyra-text transition-colors duration-300"
            >
              Add one steady thing from today
            </button>
            <button
              onClick={onEndSession}
              className="w-full py-2 rounded-xl bg-lyra-accent text-white text-sm font-medium
                         hover:opacity-90 transition-opacity duration-300"
            >
              End session
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
