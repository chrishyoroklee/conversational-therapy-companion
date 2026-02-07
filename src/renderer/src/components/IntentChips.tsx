const INTENTS = ['Vent', 'Perspective', 'Calm Down', 'Make a Plan'] as const

interface IntentChipsProps {
  selected: string | null
  onSelect: (intent: string | null) => void
}

export default function IntentChips({ selected, onSelect }: IntentChipsProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-2 animate-fade-in">
      {/* Label / Status Line */}
      <div className="flex items-center gap-2 min-h-[24px]">
        {selected ? (
          <div className="flex items-center gap-2 text-xs text-lyra-text animate-fade-in">
            <span>Tone set to: <span className="font-medium text-lyra-accent">{selected}</span></span>
            <button
              onClick={() => onSelect(null)}
              className="hover:bg-lyra-surface rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-lyra-accent"
              aria-label="Clear tone selection"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-lyra-text-muted hover:text-lyra-text">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-lyra-text-muted">
            <span>Optional: choose a tone</span>
            <div className="group relative flex items-center justify-center cursor-help">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 opacity-70">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 w-48 p-2 bg-lyra-bg-deep border border-white/5 rounded-lg text-[10px] leading-tight text-center shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none">
                This helps Lyra respond the way you want. You can skip it.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {INTENTS.map((intent) => {
          const isSelected = selected === intent
          return (
            <button
              key={intent}
              onClick={() => onSelect(isSelected ? null : intent)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 border
                focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent
                ${isSelected
                  ? 'bg-lyra-accent/10 border-lyra-accent text-lyra-accent'
                  : 'bg-transparent border-lyra-border hover:border-lyra-text-muted text-lyra-text-muted hover:text-lyra-text'
                }`}
              aria-pressed={isSelected}
            >
              {intent}
            </button>
          )
        })}
      </div>
    </div>
  )
}
