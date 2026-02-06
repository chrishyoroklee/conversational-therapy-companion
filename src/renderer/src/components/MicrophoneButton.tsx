interface MicrophoneButtonProps {
  isRecording: boolean
  disabled: boolean
  onClick: () => void
}

export default function MicrophoneButton({
  isRecording,
  disabled,
  onClick
}: MicrophoneButtonProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-center py-6">
      <div className="relative">
        {isRecording && (
          <div className="absolute inset-0 rounded-full bg-red-500/30 animate-pulse-ring" />
        )}
        <button
          onClick={onClick}
          disabled={disabled}
          className={`
            relative w-32 h-32 rounded-full flex items-center justify-center
            transition-all duration-200 ease-in-out
            ${disabled ? 'bg-gray-300 cursor-not-allowed' : ''}
            ${isRecording ? 'bg-red-500 hover:bg-red-600 scale-105' : ''}
            ${!isRecording && !disabled ? 'bg-therapy-text hover:bg-gray-800' : ''}
          `}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`w-12 h-12 ${disabled ? 'text-gray-500' : 'text-white'}`}
          >
            {isRecording ? (
              <rect x="6" y="6" width="12" height="12" rx="2" />
            ) : (
              <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4zm7 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.93V22H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A7 7 0 0 0 19 12z" />
            )}
          </svg>
        </button>
      </div>
    </div>
  )
}
