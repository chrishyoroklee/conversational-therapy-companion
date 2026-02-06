interface CrisisFooterProps {
  onCrisisClick: () => void
}

export default function CrisisFooter({ onCrisisClick }: CrisisFooterProps) {
  return (
    <footer className="py-4 px-6 text-center" role="contentinfo">
      <p className="text-xs text-lyra-text-muted">
        If you or someone you know is in crisis,{' '}
        <button
          onClick={onCrisisClick}
          className="underline text-lyra-accent hover:text-lyra-accent-soft
                     transition-colors duration-300 focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-lyra-accent rounded"
          aria-label="Get crisis support information"
        >
          get support now
        </button>
        .
      </p>
    </footer>
  )
}
