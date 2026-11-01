// A compact brass compartment: phase and time first, players below. Given an action it is also
// the phase control, so the reading the Storyteller checks is the thing they tap.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Appear } from '../../ui/Appear'
import { focusStyle, isFocused, isHovered } from '../../ui/Button'
import { formatElapsed, untilNextSecond } from '../../ui/elapsed'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import type { IconName } from '../../ui/icons'
import { durationFor, useReducedMotion } from '../../ui/motion'
import { boardBlock, hoverWash, motion, palette, space, tabular, type } from '../../ui/theme'

export interface ClockProps {
  readonly width: number
  readonly phase: string // the counter, translated by the feature: "Night 2", "Day 2", "Setup", "Game over"
  readonly phaseIcon?: IconName
  readonly aliveLabel?: string
  readonly startedAt?: number // epoch ms; while set, the elapsed line ticks from it
  readonly elapsedMs?: number // accumulated active play time supplied by the feature
  readonly timer?: ReactNode // the feature's live discussion countdown, separate from elapsed play time
  readonly onPress?: () => void // named by the phase
  readonly expanded?: boolean
}

// Ticks on the second boundary of the elapsed time, so the line changes exactly when it should
// rather than up to a second late.
const useSecondTick = (startedAt: number | undefined): number => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt === undefined) return
    let handle: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const current = Date.now()
      setNow(current)
      handle = setTimeout(tick, untilNextSecond(current - startedAt))
    }
    tick()
    return () => {
      if (handle !== undefined) clearTimeout(handle)
    }
  }, [startedAt])
  return now
}

export const Clock = ({ width, phase, phaseIcon = 'setup', aliveLabel, startedAt, elapsedMs, timer, onPress, expanded }: ClockProps) => {
  const p = palette
  const current = useSecondTick(startedAt)
  const focusVisible = useFocusVisible()
  const [pressed, setPressed] = useState(false)
  const reduced = useReducedMotion()
  const elapsed = elapsedMs ?? (startedAt !== undefined ? current - startedAt : undefined)
  // A long reading or a long phase name ("Préparation") takes its own line rather than truncating.
  const stacked = (elapsed ?? 0) >= 3_600_000 || phase.length > 9
  const elapsedText = <Text style={[type.text.small, styles.elapsed, tabular, { color: p.muted }]}>{formatElapsed(elapsed ?? 0)}</Text>
  // The chevron turns to point where the window is, rather than swapping glyphs.
  const chevron = onPress ? <div aria-hidden style={{ display: 'flex', transform: expanded ? 'rotate(180deg)' : 'none',
    transition: `transform ${durationFor(motion.duration.mark, reduced)}ms ${motion.css.ease}` }}>
    <Icon name="chevronUp" size={14} color={p.accent} />
  </div> : null
  // Opaque, unlike the bluffs tray, because it floats over an open reference's paper. As a control
  // it takes the brass of the thing to tap next, and a chevron points to where its window opens,
  // since a phone has no hover to reveal that a status reading is also a button.
  return (
    <View style={[boardBlock, styles.block, { width, backgroundColor: p.ink, opacity: pressed ? motion.pressedOpacity : 1 }, onPress ? { borderColor: p.accent } : null]}>
      <View style={styles.row}>
        {/* A new phase fades in, so the change the Storyteller just made is seen to happen. */}
        <Appear key={phase} from={1} style={[styles.row, styles.phase]}>
          {width >= 140 ? <Icon name={phaseIcon} size={16} color={p.muted} /> : null}
          <Text style={[type.display.title, styles.reading, { color: p.text }]} numberOfLines={1} accessibilityLabel={phase}>{phase}</Text>
        </Appear>
        {!stacked ? elapsedText : null}
      </View>
      {stacked ? elapsedText : null}
      {/* The chevron ends the players row, which has room to spare, leaving the phase row its
          width for Night 10 and longer translations. */}
      {aliveLabel ? <View style={[styles.row, styles.alive, { borderTopColor: boardBlock.borderColor }]}>
        <Icon name="players" size={14} color={p.muted} />
        <Text style={[type.text.small, styles.aliveText, tabular, { color: p.text }]}>{aliveLabel}</Text>
        {chevron}
      </View> : null}
      {timer}
      {/* A button's children are hidden from assistive technology, so the readings stay beside it
          and the press surface lies over them. */}
      {onPress ? <Pressable accessibilityRole="button" accessibilityLabel={phase} aria-expanded={expanded}
        onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
        style={state => [styles.press, isHovered(state) || expanded ? { backgroundColor: hoverWash.felt } : null,
          focusStyle(p, isFocused(state) && focusVisible)]} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { alignSelf: 'flex-end', padding: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  phase: { flex: 1, minWidth: 0 },
  reading: { flex: 1, fontSize: 20, lineHeight: 23 },
  elapsed: { fontSize: 12, flexShrink: 0 },
  alive: { borderTopWidth: 1, paddingTop: space.xs, marginTop: space.xs },
  aliveText: { flex: 1, fontSize: 12 },
  press: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: boardBlock.borderRadius },
})
