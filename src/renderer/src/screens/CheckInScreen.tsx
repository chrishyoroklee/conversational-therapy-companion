import ScreenShell from '../components/ScreenShell'
import CrisisFooter from '../components/CrisisFooter'
import type { RiskLevel } from '../types/lyra'

interface CheckInScreenProps {
  onSelect: (level: RiskLevel) => void
  onCrisis: () => void
}

const options: Array<{ level: RiskLevel; title: string; description: string; accent: string }> = [
  {
    level: 'low',
    title: 'I just need to talk',
    description: 'I want to process my thoughts or check in with myself.',
    accent: 'border-lyra-safe-green/60 hover:border-lyra-safe-green',
  },
  {
    level: 'medium',
    title: 'I am struggling, but I am okay',
    description: 'Things are hard right now and I could use someone to talk to.',
    accent: 'border-lyra-amber/60 hover:border-lyra-amber',
  },
  {
    level: 'high',
    title: 'I feel overwhelmed or unsafe',
    description: 'I need immediate support or am having thoughts of harming myself.',
    accent: 'border-lyra-crisis/60 hover:border-lyra-crisis',
  },
]

export default function CheckInScreen({ onSelect, onCrisis }: CheckInScreenProps) {
  return (
    <ScreenShell>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <h2 className="text-2xl font-light text-lyra-text mb-2">How are you feeling?</h2>
        <p className="text-sm text-lyra-text-muted mb-8">There are no wrong answers.</p>

        <div className="flex flex-col gap-4 max-w-md w-full">
          {options.map((opt) => (
            <button
              key={opt.level}
              onClick={() => onSelect(opt.level)}
              className={`
                w-full text-left rounded-2xl p-5 bg-lyra-surface
                border-2 ${opt.accent}
                transition-all duration-300
                hover:shadow-md
                focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent
                animate-fade-in
              `}
              aria-label={opt.title}
            >
              <p className="font-medium text-lyra-text mb-1">{opt.title}</p>
              <p className="text-xs text-lyra-text-muted">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <CrisisFooter onCrisisClick={onCrisis} />
    </ScreenShell>
  )
}
