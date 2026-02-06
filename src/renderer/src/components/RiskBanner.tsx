import { useState } from 'react'

export default function RiskBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div
      className="mx-4 mt-2 px-4 py-3 rounded-xl bg-lyra-warm/60 text-lyra-text text-sm
                 flex items-center justify-between animate-fade-in"
      role="alert"
    >
      <p>
        Remember: talking to a trusted person or a professional can make a real difference.{' '}
        <span className="font-medium">You deserve support.</span>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="ml-3 text-lyra-text-muted hover:text-lyra-text transition-colors flex-shrink-0"
        aria-label="Dismiss banner"
      >
        &times;
      </button>
    </div>
  )
}
