import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { ScrollViewInstance } from 'react-native'

import { IconButton } from '../../ui/Button'
import { PaperTexture } from '../../ui/PaperTexture'
import { palette, space, type } from '../../ui/theme'

export interface HistoryTick {
  readonly cursor: number
  readonly label: string
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

export const HistorySlider = ({ value, min, max, ticks, onChange, label, valueText, previousLabel, nextLabel, onPrevious, onNext }: Props) => {
  const p = palette
  const range = max - min
  const [available, setAvailable] = useState(0)
  const scroll = useRef<ScrollViewInstance>(null)
  const scrollOffset = useRef(0)
  const widths = ticks.map(tick => Math.max(64, tick.label.length * 8 + 24))
  const inset = Math.max(40, ...widths.map(width => width / 2))
  // Labels and the thumb share the same event scale. Crowded phases widen the scrollable track.
  let span = Math.max(1, available - 2 * inset)
  ticks.forEach((tick, index) => {
    const previous = ticks[index - 1]
    if (previous && tick.cursor > previous.cursor) span = Math.max(span,
      ((widths[index - 1]! + widths[index]!) / 2 + 8) * range / (tick.cursor - previous.cursor))
  })
  const width = span + 2 * inset
  const x = (cursor: number) => inset + (range > 0 ? (cursor - min) / range * span : 0)
  const active = ticks.filter(tick => tick.cursor <= value).at(-1) ?? ticks[0]
  useEffect(() => {
    const position = inset + (range > 0 ? (value - min) / range * span : 0)
    if (position < scrollOffset.current + 16 || position > scrollOffset.current + available - 16)
      scroll.current?.scrollTo({ x: Math.max(0, position - available / 2), animated: false })
  }, [value, available, inset, span, range, min])
  return <View style={styles.row}>
    <IconButton icon="back" label={previousLabel} disabled={!onPrevious} onPress={onPrevious ?? (() => undefined)} style={styles.arrow} />
    <View style={styles.track} onLayout={event => setAvailable(event.nativeEvent.layout.width)}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.x }} scrollEventThrottle={16}>
        <View style={{ width, height: 88 }}>
          {ticks.map((tick, index) => <View key={tick.cursor} style={{ position: 'absolute', left: x(tick.cursor) - widths[index]! / 2, width: widths[index], height: 44 }}>
            {active?.cursor === tick.cursor ? <PaperTexture radius={8} /> : null}
            <button type="button" aria-pressed={active?.cursor === tick.cursor} onClick={() => onChange(tick.cursor)}
              style={{ position: 'relative', width: '100%', height: 44, boxSizing: 'border-box', padding: '0 8px', border: `1px solid ${p.accent}`, borderRadius: 8, whiteSpace: 'nowrap',
                background: 'transparent', color: active?.cursor === tick.cursor ? p.ink : p.text,
                fontFamily: type.text.strong.fontFamily, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{tick.label}</button>
          </View>)}
          <View style={{ position: 'absolute', top: 44, left: inset - 8, width: span + 16 }}>
            <input type="range" min={min} max={max} step={1} value={value} disabled={range === 0}
              aria-label={label} aria-valuetext={valueText} onChange={event => onChange(Number(event.currentTarget.value))}
              style={{ display: 'block', width: '100%', height: 44, margin: 0, accentColor: p.accent, cursor: 'pointer' }} />
          </View>
          {ticks.map(tick => <View key={tick.cursor} pointerEvents="none" style={{ position: 'absolute', top: 50, left: x(tick.cursor), width: 1, height: 6, backgroundColor: p.accent }} />)}
        </View>
      </ScrollView>
    </View>
    <IconButton icon="chevronRight" label={nextLabel} disabled={!onNext} onPress={onNext ?? (() => undefined)} style={styles.arrow} />
  </View>
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  track: { flex: 1, minWidth: 0 },
  arrow: { marginTop: 44 },
})
