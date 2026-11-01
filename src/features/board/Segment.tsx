import { useId } from 'react'
import { StyleSheet, View } from 'react-native'
import type { CSSProperties } from 'react'

import { border, focusRing, motion, palette, radius, space, touch, type } from '../../ui/theme'

export interface SegmentOption<T extends string> {
  readonly value: T
  readonly label: string
}

export interface SegmentProps<T extends string> {
  readonly options: readonly SegmentOption<T>[]
  readonly value: T | undefined
  readonly onChange: (value: T) => void
  readonly accessibilityLabel: string
}

// Native radio inputs supply arrow-key selection and one tab stop for the group on the web.
// The segment draws a slim pill on vellum, each label at its own width, but keeps full-height
// targets that reach past it, for a header that should cost little space above a read-only list.
// The focus ring is brass over ink and ink over vellum, whichever the label's fill is.
export const Segment = <T extends string>({ options, value, onChange, accessibilityLabel }: SegmentProps<T>) => {
  const name = useId()
  return <View style={styles.group} role="radiogroup" aria-label={accessibilityLabel}>
    <style href="grimoire-segment" precedence="default">{`
      .grimoire-segment input:focus-visible + span { outline: ${focusRing.width}px solid ${palette.accent}; outline-offset: -${focusRing.width + focusRing.offset}px; }
      .grimoire-segment input:not(:checked):focus-visible + span { outline-color: ${palette.ink}; }
      .grimoire-segment:active { opacity: ${motion.pressedOpacity}; }
    `}</style>
    {options.map(option => {
      const selected = option.value === value
      return <label key={option.value} className="grimoire-segment" style={{ flex: '1 0 auto', minWidth: 0, maxWidth: '100%', position: 'relative', cursor: 'pointer',
        display: 'flex', alignItems: 'center', height: touch, margin: `${-(touch - pillHeight) / 2}px 0` }}>
        <input type="radio" name={name} value={option.value} checked={selected} aria-label={option.label}
          onChange={() => onChange(option.value)} style={hiddenInput} />
        <span style={{ ...labelStyle, background: selected ? palette.ink : 'transparent', color: selected ? palette.parchment : palette.ink }}>{option.label}</span>
      </label>
    })}
  </View>
}

const pillHeight = 26
const hiddenInput: CSSProperties = { position: 'absolute', width: 1, height: 1, opacity: 0, margin: 0 }
const labelStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxSizing: 'border-box', minHeight: 0, minWidth: touch, height: pillHeight, padding: `0 ${space.sm}px`, fontFamily: type.text.strong.fontFamily, fontSize: type.text.small.fontSize, lineHeight: `${type.text.strong.lineHeight}px`, borderRadius: radius.control - 3, overflowWrap: 'anywhere' }
// Visible overflow lets each full-height target extend past the slim pill.
const styles = StyleSheet.create({ group: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: border, borderColor: palette.parchmentShade, borderRadius: radius.control, overflow: 'visible', padding: 1, maxWidth: '100%' } })
