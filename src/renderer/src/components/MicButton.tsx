interface MicButtonProps {
  isRecording: boolean
  disabled: boolean
  onStart: () => void
  onStop: () => void
}

export default function MicButton({ isRecording, disabled, onStart, onStop }: MicButtonProps) {
  return (
    <div className="relative flex items-center justify-center">
      {isRecording && (
        <div className="absolute w-16 h-16 rounded-full bg-lyra-accent/20 animate-pulse-ring" />
      )}
      <button
        onPointerDown={disabled ? undefined : onStart}
        onPointerUp={disabled ? undefined : isRecording ? onStop : undefined}
        onPointerLeave={disabled ? undefined : isRecording ? onStop : undefined}
        onContextMenu={(e) => e.preventDefault()}
        disabled={disabled}
        className={`
          relative w-16 h-16 rounded-full flex items-center justify-center
          transition-all duration-300 ease-in-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent focus-visible:ring-offset-2
          ${disabled ? 'bg-lyra-lavender/40 cursor-not-allowed' : ''}
          ${isRecording ? 'bg-lyra-accent scale-110' : ''}
          ${!isRecording && !disabled ? 'bg-lyra-accent hover:bg-lyra-accent-soft' : ''}
        `}
        aria-label={isRecording ? 'Release to stop recording' : 'Hold to talk'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`w-7 h-7 ${disabled ? 'text-lyra-text-muted' : 'text-white'}`}
        >
          {isRecording ? (
            <rect x="6" y="6" width="12" height="12" rx="2" />
          ) : (
            <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4zm7 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.93V22H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A7 7 0 0 0 19 12z" />
          )}
        </svg>
      </button>
    </div>
  )
}
