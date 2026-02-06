import { useState, useCallback, type KeyboardEvent } from 'react'

interface TextInputProps {
  onSend: (text: string) => void
  disabled: boolean
}

export default function TextInput({ onSend, disabled }: TextInputProps) {
  const [value, setValue] = useState('')

  const handleSend = useCallback(() => {
    if (value.trim() && !disabled) {
      onSend(value.trim())
      setValue('')
    }
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="flex items-center gap-2 px-4">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type your message..."
        className="flex-1 px-4 py-3 rounded-xl bg-lyra-surface border border-lyra-lavender/40
                   text-sm text-lyra-text placeholder:text-lyra-text-muted/50
                   focus:outline-none focus:ring-2 focus:ring-lyra-accent/50
                   transition-all duration-300"
        aria-label="Type a message to Lyra"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="px-4 py-3 rounded-xl bg-lyra-accent text-white text-sm font-medium
                   hover:bg-lyra-accent-soft disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-300
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent"
        aria-label="Send message"
      >
        Send
      </button>
    </div>
  )
}
