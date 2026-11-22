import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ScrollViewInstance } from 'react-native'

import { IconButton } from '../../ui/Button'
import type { IconName } from '../../ui/icons'
import { Icon } from '../../ui/icons'
import { font, palette, space, tabular } from '../../ui/theme'

// Where a phase opens on the track: its glyph and number sit over the step that shows it.
export interface HistoryTick {
  readonly cursor: number
  readonly icon: IconName
  readonly number?: number
  readonly label: string // the phase in words, for a pointer's tooltip
}

interface Props {
  readonly value: number
  readonly min: number
  readonly max: number
  readonly ticks: readonly HistoryTick[]
  readonly onChange: (value: number) => void
  readonly label: string
  readonly valueText: string
  readonly previousLabel: string
  readonly nextLabel: string
  readonly onPrevious?: (() => void) | undefined
  readonly onNext?: (() => void) | undefined
}

const row = 44
const glyph = 16
const digit = 8 // a bold tabular digit at 12 px, rounded up
// Below this spacing the step marks would merge into a bar, so only the phases keep theirs.
const leastStepGap = 6

export const HistorySlider = ({ value, min, max, ticks, onChange, label, valueText, previousLabel, nextLabel, onPrevious, onNext }: Props) => {
  const p = palette
  const range = max - min
  const [available, setAvailable] = useState(0)
  const scroll = useRef<ScrollViewInstance>(null)
  const scrollOffset = useRef(0)
  const widths = ticks.map(tick => glyph + (tick.number !== undefined ? 3 + String(tick.number).length * digit : 0))
  // The glyph sits on its step and the number runs to its right, so the right end needs the room.
  const inset = Math.max(16, ...widths.map(width => width - glyph / 2))
  // Marks and the thumb share one scale. Phases crowded together widen the track, which scrolls.
  let span = Math.max(1, available - 2 * inset)
  ticks.forEach((tick, index) => {
    const previous = ticks[index - 1]
    if (previous && tick.cursor > previous.cursor) span = Math.max(span,
      (widths[index - 1]! + space.sm) * range / (tick.cursor - previous.cursor))
  })
  const width = span + 2 * inset
  const x = (cursor: number) => inset + (range > 0 ? (cursor - min) / range * span : 0)
  const active = ticks.filter(tick => tick.cursor <= value).at(-1) ?? ticks[0]
  const phaseAt = new Set(ticks.map(tick => tick.cursor))
  const steps = range > 0 && span / range >= leastStepGap ? Array.from({ length: range + 1 }, (_, i) => min + i) : [...phaseAt]
  useEffect(() => {
    const position = inset + (range > 0 ? (value - min) / range * span : 0)
    if (position < scrollOffset.current + 16 || position > scrollOffset.current + available - 16)
      scroll.current?.scrollTo({ x: Math.max(0, position - available / 2), animated: false })
  }, [value, available, inset, span, range, min])
  return <View style={styles.row}>
    <IconButton icon="back" label={previousLabel} disabled={!onPrevious} onPress={onPrevious ?? (() => undefined)} />
    <View style={styles.track} onLayout={event => setAvailable(event.nativeEvent.layout.width)}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.x }} scrollEventThrottle={16}>
        <View style={{ width, height: row }}>
          {/* Every step the replay can stop on, a longer brass mark where a phase opens. */}
          {steps.map(step => <View key={step} pointerEvents="none" style={[styles.step, { left: x(step) },
            phaseAt.has(step) ? { top: 26, height: 12, backgroundColor: p.accent } : { backgroundColor: p.muted }]} />)}
          {ticks.map((tick, index) => {
            const colour = active?.cursor === tick.cursor ? p.accent : p.muted
            return <View key={tick.cursor} pointerEvents="none" aria-hidden style={[styles.mark, { left: x(tick.cursor) - glyph / 2, width: widths[index] }]}>
              <Icon name={tick.icon} size={glyph} color={colour} />
              {tick.number !== undefined ? <Text style={[styles.number, tabular, { color: colour }]}>{tick.number}</Text> : null}
            </View>
          })}
          {/* The range input takes the whole row, so a tap on a phase's mark lands on that phase. */}
          <View style={{ position: 'absolute', top: 0, left: inset - 8, width: span + 16 }}>
            <input type="range" min={min} max={max} step={1} value={value} disabled={range === 0}
              aria-label={label} aria-valuetext={valueText} title={active?.label} onChange={event => onChange(Number(event.currentTarget.value))}
              style={{ display: 'block', width: '100%', height: row, margin: 0, paddingTop: 6, boxSizing: 'border-box', background: 'transparent', accentColor: p.accent, cursor: 'pointer' }} />
          </View>
        </View>
      </ScrollView>
    </View>
    <IconButton icon="chevronRight" label={nextLabel} disabled={!onNext} onPress={onNext ?? (() => undefined)} />
  </View>
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: row },
  track: { flex: 1, minWidth: 0 },
  mark: { position: 'absolute', top: 0, height: glyph, flexDirection: 'row', alignItems: 'center', gap: 3 },
  number: { fontFamily: font.body.bold, fontSize: 12, lineHeight: glyph },
  step: { position: 'absolute', top: 30, width: 1, height: 5 },
})
