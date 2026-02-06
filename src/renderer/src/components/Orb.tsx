import type { OrbState } from '../types/lyra'

interface OrbProps {
  state: OrbState
  size?: number
}

const stateClasses: Record<OrbState, string> = {
  idle: 'animate-orb-idle',
  listening: 'animate-orb-listening',
  thinking: 'animate-orb-thinking',
  speaking: 'animate-orb-speaking',
  disabled: 'orb-disabled',
}

export default function Orb({ state, size = 160 }: OrbProps) {
  const baseGradient =
    state === 'thinking'
      ? 'bg-gradient-to-r from-lyra-accent via-lyra-lavender to-lyra-accent'
      : 'bg-gradient-to-br from-lyra-accent to-lyra-lavender'

  return (
    <div
      className="flex items-center justify-center"
      role="img"
      aria-label={`Lyra is ${state}`}
    >
      <div
        className={`rounded-full transition-all duration-500 ease-in-out ${baseGradient} ${stateClasses[state]}`}
        style={{ width: size, height: size }}
      />
    </div>
  )
}
