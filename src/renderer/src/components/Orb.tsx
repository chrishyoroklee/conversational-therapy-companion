import { useCallback, useRef, useEffect, useState } from 'react'
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
  const wrapperRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useRef(false)
  // Force re-render to catch media query (optional, but good for completeness)
  const [, setMounted] = useState(false)
  const swirlOpacity = state === 'disabled' ? 0.3 : 1

  const sparks = [
    { top: '12%', left: '20%', size: 2, opacity: 0.5, delay: '0s' },
    { top: '18%', left: '72%', size: 2, opacity: 0.4, delay: '2s' },
    { top: '34%', left: '10%', size: 1.5, opacity: 0.35, delay: '4s' },
    { top: '58%', left: '82%', size: 2, opacity: 0.45, delay: '1s' },
    { top: '70%', left: '18%', size: 1.5, opacity: 0.4, delay: '3s' },
    { top: '82%', left: '60%', size: 2, opacity: 0.35, delay: '5s' },
    { top: '44%', left: '88%', size: 1.5, opacity: 0.35, delay: '6s' },
  ]

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    setMounted(true)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion.current || !wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = ((e.clientX - cx) / rect.width) * 3
    const dy = ((e.clientY - cy) / rect.height) * 3
    wrapperRef.current.style.transform = `translate(${dx}px, ${dy}px)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (wrapperRef.current) {
      wrapperRef.current.style.transform = 'translate(0, 0)'
    }
  }, [])

  return (
    <div
      className="flex items-center justify-center"
      role="img"
      aria-label={`Lyra is ${state}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={wrapperRef}
        className="relative transition-transform duration-200 ease-out"
        style={{ width: size, height: size }}
      >
        {/* Nebula halo */}
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: size * 2,
            height: size * 2,
            transform: 'translate(-50%, -50%)',
            opacity: swirlOpacity,
          }}
        >
          <div className={`absolute inset-0 orb-nebula ${prefersReducedMotion.current ? '' : 'animate-nebula-breathe'}`} />
        </div>

        {/* Energy ribbons */}
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: size * 1.75,
            height: size * 1.05,
            transform: 'translate(-50%, -50%) rotate(25deg) skewX(18deg)',
            opacity: swirlOpacity,
          }}
        >
          <div className={`absolute inset-0 orb-ribbon orb-ribbon-one ${prefersReducedMotion.current ? '' : 'animate-swirl-rotate-slow'}`} />
        </div>
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: size * 2,
            height: size * 1.2,
            transform: 'translate(-50%, -50%) rotate(-18deg) skewX(-12deg)',
            opacity: swirlOpacity * 0.9,
          }}
        >
          <div className={`absolute inset-0 orb-ribbon orb-ribbon-two ${prefersReducedMotion.current ? '' : 'animate-swirl-rotate-slower'}`} />
        </div>

        {/* Star specks */}
        {sparks.map((spark, index) => (
          <div
            key={`spark-${index}`}
            className={`absolute orb-spark ${prefersReducedMotion.current ? '' : 'animate-spark-drift'}`}
            style={{
              top: spark.top,
              left: spark.left,
              width: spark.size,
              height: spark.size,
              opacity: spark.opacity * swirlOpacity,
              animationDelay: spark.delay,
            }}
          />
        ))}

        {/* Drop shadow */}
        <div
          className="absolute inset-x-4 -bottom-2 h-4 rounded-full bg-lyra-accent/20 blur-lg orb-shadow"
        />

        {/* Main orb with radial gradient */}
        <div
          className={`absolute inset-0 rounded-full transition-all duration-500 ease-in-out orb-core ${stateClasses[state]}`}
          style={{
            background:
              state === 'thinking'
                ? undefined
                : 'radial-gradient(circle at 40% 35%, #A78BFA 0%, #7C5CFC 50%, #5B3FD4 100%)',
          }}
        />

        {/* Thinking state needs gradient classes for shimmer */}
        {state === 'thinking' && (
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-r from-lyra-accent via-lyra-lavender to-lyra-accent ${stateClasses[state]}`}
          />
        )}

        {/* Inner glow */}
        <div className="absolute inset-3 rounded-full bg-white/10 blur-md orb-inner-glow" />

        {/* Top highlight reflection */}
        <div
          className="absolute rounded-full bg-white/20 blur-sm orb-highlight"
          style={{
            width: size * 0.35,
            height: size * 0.18,
            top: size * 0.12,
            left: size * 0.25,
          }}
        />
      </div>
    </div>
  )
}
