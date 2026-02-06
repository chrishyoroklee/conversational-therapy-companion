interface TranscriptDisplayProps {
  transcript: string
  isProcessing: boolean
}

export default function TranscriptDisplay({
  transcript,
  isProcessing
}: TranscriptDisplayProps): React.JSX.Element | null {
  if (!transcript && !isProcessing) return null

  return (
    <div className="mx-6 mb-4 px-4 py-3 rounded-xl border border-therapy-grey-light bg-therapy-card">
      {isProcessing ? (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-therapy-grey-deep animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-therapy-grey-deep animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-therapy-grey-deep animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-sm text-therapy-grey-deep">Processing...</span>
        </div>
      ) : (
        <p className="text-sm text-therapy-grey-deep italic">{transcript}</p>
      )}
    </div>
  )
}
