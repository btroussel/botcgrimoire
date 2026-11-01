// The small motion for a thing that has just been put on the board: a chip placed, a mark set,
// the gap markers armed. It scales from 0.8 to 1 with its opacity over 160 ms on mount, and
// under reduced motion only fades, in 120 ms. Wrap the piece; the style goes on the wrapper so
// an absolutely positioned piece keeps its place. The run is WAAPI, started before the first
// paint, so it costs React nothing per frame.
import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import type { StyleProp, ViewInstance, ViewStyle } from 'react-native'

import { domElement } from './focus'
import { durationFor, useReducedMotion } from './motion'
import { motion } from './theme'

export interface AppearProps {
  readonly children: ReactNode
  readonly style?: StyleProp<ViewStyle>
  readonly pointerEvents?: 'none' | 'auto'
  readonly delay?: number // ms before it starts, for a piece that should land after another; 0 under reduced motion
  readonly from?: number // the scale it grows from; 1 for a fade alone
}

export const Appear = ({ children, style, pointerEvents, delay = 0, from = 0.8 }: AppearProps) => {
  const reduced = useReducedMotion()
  const piece = useRef<ViewInstance>(null)
  useLayoutEffect(() => {
    const element = domElement(piece.current)
    const run = element?.animate?.(reduced || from === 1 ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: `scale(${from})` }, { opacity: 1, transform: 'none' }],
    { duration: durationFor(motion.duration.mark, reduced, true), delay: durationFor(delay, reduced), easing: motion.css.ease, fill: 'backwards' })
    return () => run?.cancel()
    // A piece arrives once, when it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <View ref={piece} style={style} {...(pointerEvents ? { pointerEvents } : {})}>
      {children}
    </View>
  )
}
