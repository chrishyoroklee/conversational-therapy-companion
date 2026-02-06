import ScreenShell from '../components/ScreenShell'
import CrisisFooter from '../components/CrisisFooter'

interface LandingScreenProps {
  onStart: () => void
  onHowItWorks: () => void
  onCrisis: () => void
}

export default function LandingScreen({ onStart, onHowItWorks, onCrisis }: LandingScreenProps) {
  return (
    <ScreenShell>
      <div className="flex-1 flex flex-col items-center justify-center px-8 animate-fade-in">
        <h1 className="text-5xl font-light tracking-tight text-lyra-text mb-3">Lyra</h1>
        <p className="text-lg text-lyra-text-muted mb-2">
          A compassionate companion for when your mind feels loud.
        </p>
        <p className="text-sm text-lyra-text-muted/70 max-w-sm text-center mb-10 leading-relaxed">
          I'm not a licensed therapist. If you're in immediate danger, call 911 or 988.
        </p>

        <div className="flex flex-col gap-3 w-64">
          <button
            onClick={onStart}
            className="py-3 px-6 rounded-xl bg-lyra-accent text-white font-medium text-base
                       hover:bg-lyra-accent-soft transition-all duration-300
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent focus-visible:ring-offset-2"
            aria-label="Start a session with Lyra"
          >
            Start
          </button>
          <button
            onClick={onHowItWorks}
            className="py-3 px-6 rounded-xl bg-lyra-surface text-lyra-text font-medium text-base
                       border border-lyra-lavender/50
                       hover:bg-lyra-bg-deep transition-all duration-300
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent focus-visible:ring-offset-2"
            aria-label="Learn how Lyra works"
          >
            How Lyra Works
          </button>
        </div>
      </div>

      <CrisisFooter onCrisisClick={onCrisis} />
    </ScreenShell>
  )
}
