import ScreenShell from '../components/ScreenShell'

interface CrisisScreenProps {
  onBack: () => void
}

export default function CrisisScreen({ onBack }: CrisisScreenProps) {
  return (
    <ScreenShell>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-fade-in">
        <h1 className="text-2xl font-medium text-lyra-text mb-4">
          You deserve immediate support.
        </h1>
        <p className="text-sm text-lyra-text-muted max-w-sm leading-relaxed mb-10">
          If you are in immediate danger, call 911. You can also call or text 988 for the
          Suicide and Crisis Lifeline, available 24/7.
        </p>

        <div className="flex flex-col gap-4 w-64">
          <a
            href="tel:911"
            className="py-4 px-6 rounded-xl bg-lyra-surface border-2 border-lyra-crisis/50
                       text-lyra-text font-medium text-lg text-center
                       hover:border-lyra-crisis transition-all duration-300
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-crisis"
            aria-label="Call 911 emergency services"
          >
            911 &mdash; Emergency
          </a>

          <a
            href="tel:988"
            className="py-4 px-6 rounded-xl bg-lyra-surface border-2 border-lyra-accent/50
                       text-lyra-text font-medium text-lg text-center
                       hover:border-lyra-accent transition-all duration-300
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent"
            aria-label="Call or text 988 Suicide and Crisis Lifeline"
          >
            988 &mdash; Crisis Lifeline
          </a>
        </div>

        <button
          onClick={onBack}
          className="mt-10 text-sm text-lyra-text-muted hover:text-lyra-text
                     transition-colors duration-300 underline
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent rounded"
          aria-label="Return to Lyra home screen"
        >
          Back to Lyra
        </button>
      </div>
    </ScreenShell>
  )
}
