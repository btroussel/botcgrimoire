import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useReducedMotion } from '../../ui/motion'
import { motion } from '../../ui/theme'
import { TokenBack } from './TokenBack'

export const TokenFlip = ({ size, revealed, children, onSettled }: {
  readonly size: number
  readonly revealed: boolean
  readonly children: ReactNode
  readonly onSettled: () => void
}) => revealed ? <TurningToken size={size} onSettled={onSettled}>{children}</TurningToken> : <TokenBack size={size} />

const TurningToken = ({ size, children, onSettled }: {
  readonly size: number
  readonly children: ReactNode
  readonly onSettled: () => void
}) => {
  const disc = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'back' | 'front' | 'settled'>('back')
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    const element = disc.current
    if (!element || phase === 'settled') return
    let active = true
    const back = phase === 'back'
    const animation = typeof element.animate === 'function' ? element.animate(reduced ? [
      { opacity: back ? 1 : 0 }, { opacity: back ? 0 : 1 },
    ] : [
      { transform: `perspective(900px) rotateY(${back ? 0 : -90}deg)` },
      { transform: `perspective(900px) rotateY(${back ? 90 : 0}deg)` },
    ], {
      duration: reduced ? motion.duration.fade / 2 : back ? motion.duration.flipOut : motion.duration.flipIn,
      easing: back ? motion.css.easeIn : motion.css.ease,
      fill: 'forwards',
    }) : undefined
    void (animation?.finished ?? Promise.resolve()).then(() => {
      if (!active) return
      // The layout effect starts the second half before the newly mounted face can paint.
      setPhase(back ? 'front' : 'settled')
      if (!back) onSettled()
    }).catch(() => { /* A hide or unmount cancels the animation and rejects finished. */ })
    return () => { active = false; animation?.cancel() }
  }, [phase, reduced, onSettled])

  return <div ref={disc} style={{ width: size, height: size, backfaceVisibility: 'hidden' }}>
    {phase !== 'back' ? children : <TokenBack size={size} />}
  </div>
}
