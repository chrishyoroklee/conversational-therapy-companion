import { useEffect, useRef } from 'react'
import type { LyraMessage } from '../types/lyra'

interface TranscriptProps {
  messages: LyraMessage[]
}

export default function Transcript({ messages }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) return null

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      role="log"
      aria-label="Conversation transcript"
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`
            rounded-xl px-4 py-3 animate-fade-in transition-colors duration-300
            ${
              msg.role === 'user'
                ? 'bg-lyra-surface-dim text-lyra-text-muted text-sm'
                : 'bg-lyra-surface text-lyra-text text-sm shadow-sm border border-lyra-lavender/30'
            }
          `}
        >
          <p className="text-xs font-medium mb-1 opacity-60">
            {msg.role === 'user' ? 'You' : 'Lyra'}
          </p>
          <p className="leading-relaxed">{msg.text}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
