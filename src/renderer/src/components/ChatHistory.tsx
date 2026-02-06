import { useEffect, useRef } from 'react'
import type { Message } from '../types/messages'

interface ChatHistoryProps {
  messages: Message[]
}

export default function ChatHistory({ messages }: ChatHistoryProps): React.JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center animate-fade-in">
          <p className="text-2xl font-light text-therapy-grey-deep mb-2">
            Welcome
          </p>
          <p className="text-sm text-therapy-grey-deep/60">
            Press the microphone to start a conversation.
            <br />
            I'm here to listen.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`
              max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${
                msg.role === 'user'
                  ? 'bg-therapy-grey-light text-therapy-text'
                  : 'bg-therapy-grey-deep text-white'
              }
            `}
          >
            {msg.content}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
