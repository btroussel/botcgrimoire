// The states a seat wears on the board, each a small piece laid over a token: the skull of a
// ghost vote a dead seat still holds, the translucent skull of a nominee marked for execution and
// the brass ring around a chosen disc. Death itself is the greyed token (Token's `dead`), not a
// piece. Each mark arrives with the mark motion so it is seen to happen. One rule: every piece
// here is positioned against the token's box (size x size at the origin) and touches nothing else.
import { StyleSheet, View } from 'react-native'
import Svg, { Ellipse, Path } from 'react-native-svg'

import { Appear } from './Appear'
import { motion, palette, ring, shadows } from './theme'

export interface MarkProps {
  readonly size: number // the token's diameter
}

export const BlockMark = ({ size }: MarkProps) => {
  const diameter = size * 0.62
  return <View pointerEvents="none" aria-hidden style={{ position: 'absolute',
    left: (size - diameter) / 2, top: (size - diameter) / 2, opacity: 0.65 }}>
    <Svg width={diameter} height={diameter} viewBox="0 0 64 64">
      <Path d="M32 4C17 4 8 14 8 28c0 10 5 15 13 18v10h22V46c8-3 13-8 13-18C56 14 47 4 32 4Z"
        fill={palette.text} stroke={palette.ink} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M15 27c0-8 13-8 13 0s-13 9-13 0Zm21 0c0-8 13-8 13 0s-13 9-13 0ZM32 34l-5 9h10Z" fill={palette.ink} />
      <Path d="M28 48v8m8-8v8" stroke={palette.ink} strokeWidth={3} />
    </Svg>
  </View>
}

// The ghost vote is the skull a dead seat holds, as a dead player holds the vote token, and gives
// up once the vote is spent. It sits on the top of the rim, clear of the art's centre and of a
// marked nominee's skull, and lands a beat after the token greys when both arrive together.
export const GhostVoteMark = ({ size }: MarkProps) => {
  const p = palette
  // Large enough to be seen at arm's length on a crowded board, small enough to leave the art.
  const width = Math.max(16, size * 0.3)
  const height = width * 21 / 20
  // A box shadow would draw a rectangle around a skull, so the shadow is cast by its outline.
  const filter = `drop-shadow(${shadows.lifted})`
  return (
    <Appear pointerEvents="none" delay={motion.duration.markStagger}
      style={[styles.ghost, { top: -size * 0.05, left: (size - width) / 2, width, height }, { filter }]}>
      <Svg width={width} height={height} viewBox="2 1 20 21" aria-hidden>
        <Path d="M12 2C6.6 2 3 5.9 3 10.9c0 3.1 1.4 5.3 3.4 6.6V21h11.2v-3.5c2-1.3 3.4-3.5 3.4-6.6C21 5.9 17.4 2 12 2Z"
          fill={p.text} stroke={p.ink} strokeWidth={1.3} strokeLinejoin="round" />
        <Ellipse cx={8.3} cy={11.3} rx={2.5} ry={2.8} fill={p.ink} />
        <Ellipse cx={15.7} cy={11.3} rx={2.5} ry={2.8} fill={p.ink} />
        <Path d="M12 14.1l-1.5 2.7h3Z" fill={p.ink} />
        <Path d="M9.6 21v-2.7M12 21v-2.7M14.4 21v-2.7" stroke={p.ink} strokeWidth={1} />
      </Svg>
    </Appear>
  )
}

// The brass ring outside a disc: a selected token, a hand recorded during the count.
export const SelectedRing = ({ size }: MarkProps) => {
  const p = palette
  const inset = ring.gap + ring.width
  const outer = size + 2 * inset
  // Set with the mark motion: the ring appears as the hand is recorded or the seat picked.
  return (
    <Appear pointerEvents="none" style={[styles.ring, { top: -inset, left: -inset, width: outer, height: outer }]}>
      <View style={[styles.ringLine, { width: outer, height: outer, borderRadius: outer / 2, borderColor: p.accent }]} />
    </Appear>
  )
}

// Available choices use a broken line so they cannot be mistaken for recorded selections.
export const AvailableRing = ({ size }: MarkProps) => {
  const inset = ring.gap + ring.width
  const outer = size + 2 * inset
  return <View pointerEvents="none" aria-hidden style={{ position: 'absolute', top: -inset, left: -inset,
    width: outer, height: outer, borderRadius: outer / 2, borderWidth: 2,
    borderStyle: 'dashed', borderColor: palette.accent }} />
}

const styles = StyleSheet.create({
  ghost: { position: 'absolute' },
  ring: { position: 'absolute' },
  ringLine: { borderWidth: ring.width },
})
