import { useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import CrisisFooter from '../components/CrisisFooter'

interface OnboardingScreenProps {
  onComplete: () => void
  onSkip: () => void
  onCrisis: () => void
}

const steps = [
  {
    title: 'Lyra listens',
    body: 'Speak naturally. Lyra will listen, reflect back what it hears, and ask gentle questions. Think of her as older-sister energy -- psychology-informed, but never clinical.',
  },
  {
    title: 'What Lyra is not',
    body: 'Lyra cannot diagnose, prescribe, or replace professional care. If you are in crisis, Lyra will guide you to real human support.',
  },
  {
    title: 'Your privacy',
    body: 'Everything runs locally on your device. Your voice and words are never sent to the cloud. No accounts, no data collection.',
  },
]

export default function OnboardingScreen({
  onComplete,
  onSkip,
  onCrisis,
}: OnboardingScreenProps) {
  const [step, setStep] = useState(0)
  const isLast = step === steps.length - 1

  const handleNext = () => {
    if (isLast) {
      onComplete()
    } else {
      setStep((s) => s + 1)
    }
  }

  return (
    <ScreenShell>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Step indicator */}
        <div
          className="flex gap-2 mb-8"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={3}
        >
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-lyra-accent' : 'bg-lyra-lavender/50'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div
          className="max-w-md w-full bg-lyra-surface rounded-2xl p-8 shadow-sm animate-fade-in"
          key={step}
        >
          <h2 className="text-xl font-medium text-lyra-text mb-4">{steps[step].title}</h2>
          <p className="text-sm text-lyra-text-muted leading-relaxed">{steps[step].body}</p>
        </div>

        {/* Navigation */}
        <div className="flex gap-4 mt-8">
          <button
            onClick={onSkip}
            className="py-2 px-6 rounded-xl text-sm text-lyra-text-muted
                       hover:text-lyra-text transition-colors duration-300
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent"
            aria-label="Skip onboarding"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="py-2 px-6 rounded-xl bg-lyra-accent text-white text-sm font-medium
                       hover:bg-lyra-accent-soft transition-all duration-300
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent focus-visible:ring-offset-2"
          >
            {isLast ? 'Continue' : 'Next'}
          </button>
        </div>
      </div>

      <CrisisFooter onCrisisClick={onCrisis} />
    </ScreenShell>
  )
}
