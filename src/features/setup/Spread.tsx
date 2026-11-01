// The bag, face down. Normally it lies open with its tokens heaped inside (OpenBag). Under
// reduced motion the tokens sit still in a honeycomb instead, and a taken one leaves an empty
// socket, so the next player sees what is gone. Once a player takes one, the rest fade while it rises.
import { Pressable, StyleSheet, View } from 'react-native'

import type { Translate } from '../../content'
import { focusStyle, isFocused } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { useReducedMotion } from '../../ui/motion'
import { motion, palette, space } from '../../ui/theme'
import { TokenBack } from './TokenBack'
import { OpenBag } from './OpenBag'
import { spreadLayout } from './spreadLayout'

// Where a taken token lay, so it can rise from there.
export interface Lift {
  readonly x: number
  readonly y: number
  readonly token: number
  readonly turn: number
}

// A disc gives under the finger, like the board's tokens.
const pressedScale = 0.96

interface SpreadProps {
  readonly size: number
  readonly room: number // how far the open bag may spread round the token's square
  readonly free: readonly boolean[]
  readonly taken?: number // the token rising out of the bag
  readonly t: Translate
  readonly onTake: (at: number, from: Lift) => void
}

export const Spread = (props: SpreadProps) => useReducedMotion() ? <Honeycomb {...props} /> : <OpenBag {...props} />

const Honeycomb = ({ size, free, taken, t, onTake }: SpreadProps) => {
  const focusVisible = useFocusVisible()
  const { token, places } = spreadLayout(free.length, size, space.sm)
  const leaving = taken !== undefined
  return <div style={{ position: 'absolute', inset: 0, opacity: leaving ? 0 : 1,
    transition: `opacity ${motion.duration.fade}ms`, pointerEvents: leaving ? 'none' : 'auto' }}>
    {places.map((place, at) => {
      if (at === taken) return null
      const turn = { rotate: `${place.turn}deg` }
      const box = { left: place.x - token / 2, top: place.y - token / 2, width: token, height: token, borderRadius: token / 2 }
      if (!free[at]) return <View key={at} style={[styles.place, styles.socket, box]} />
      return <Pressable key={at} accessibilityRole="button" accessibilityLabel={t('setup.drawTake', { n: at + 1 })}
        onPress={() => onTake(at, { x: place.x, y: place.y, token, turn: place.turn })}
        style={state => [styles.place, box, { transform: state.pressed ? [turn, { scale: pressedScale }] : [turn] },
          focusStyle(palette, isFocused(state) && focusVisible)]}>
        <TokenBack size={token} />
      </Pressable>
    })}
  </div>
}

const styles = StyleSheet.create({
  place: { position: 'absolute' },
  socket: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.muted, opacity: 0.5 },
})
