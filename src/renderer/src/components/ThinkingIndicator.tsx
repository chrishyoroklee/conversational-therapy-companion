import { useEffect, useState } from 'react'

const phrases = [
  'Reflecting on what you shared...',
  'Taking a moment to think...',
  'Considering how to respond...',
  'Listening carefully...',
  'Gathering my thoughts...',
]

export default function ThinkingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [phaseKey, setPhaseKey] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length)
      setPhaseKey((prev) => prev + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="rounded-xl px-4 py-3 animate-fade-in bg-lyra-surface text-lyra-text text-sm shadow-sm border border-lyra-lavender/30"
      role="status"
      aria-label="Lyra is thinking"
    >
      <p className="text-xs font-medium mb-1 opacity-60">Lyra</p>

      <div className="flex items-center gap-3">
        {/* Bouncing dots */}
        <div className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="thinking-dot-bounce inline-block w-2 h-2 rounded-full bg-lyra-accent"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>

        {/* Rotating phrase */}
        <span
          key={phaseKey}
          className="thinking-phrase-fade text-lyra-text-muted text-xs"
        >
          {phrases[phraseIndex]}
        </span>
      </div>
    </div>
  )
}
