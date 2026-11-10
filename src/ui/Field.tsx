import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { focusStyle } from './Button'
import { fieldCount } from './fieldCount'
import { useFocusVisible } from './focus'
import { palette, radius, space, tabular, touch, type } from './theme'

export interface FieldProps {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly multiline?: boolean
  readonly lines?: number // a multiline field's starting height; it grows with its text where the browser can
  readonly maxLength?: number
  readonly autoFocus?: boolean
}

export const Field = ({ label, value, onChange, multiline, lines, maxLength, autoFocus }: FieldProps) => {
  const focusVisible = useFocusVisible()
  const [focused, setFocused] = useState(false)
  const count = maxLength !== undefined ? fieldCount(value.length, maxLength) : 'hidden'
  return <View style={styles.wrap}>
    <View style={styles.labelRow}>
      <Text style={[type.text.small, styles.label, { color: palette.inkMuted }]}>{label}</Text>
      {/* Plain text, not a live region: a screen reader finds it when it reads the form, rather
          than hearing a number after every keystroke. */}
      {count !== 'hidden'
        ? <Text style={[type.text.small, tabular, { color: count === 'full' ? palette.danger : palette.inkMuted }]}>{`${value.length}/${maxLength}`}</Text>
        : null}
    </View>
    <View style={[styles.field, multiline ? styles.tall : null, focusStyle(palette, focused && focusVisible, 'paper')]}>
      <TextInput value={value} onChangeText={onChange} accessibilityLabel={label}
        multiline={multiline} autoFocus={autoFocus}
        {...(maxLength !== undefined ? { maxLength } : {})}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={[type.text.body, styles.input, multiline ? (lines ? [styles.inputSized, { minHeight: lines * lineHeight }] : styles.inputTall) : null]} />
    </View>
  </View>
}

const lineHeight = type.text.body.lineHeight ?? 22

const styles = StyleSheet.create({
  wrap: { gap: space.xs, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  label: { flex: 1, minWidth: 0 },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: palette.paperInset, borderWidth: 1, borderColor: palette.parchmentShade },
  tall: { alignItems: 'flex-start', paddingVertical: space.sm },
  input: { flex: 1, minWidth: 0, minHeight: touch, paddingVertical: 0, outlineWidth: 0, color: palette.ink },
  inputTall: { minHeight: touch * 2 },
  // Sized to the text by the browser where it can; elsewhere the starting height scrolls.
  inputSized: { minHeight: 0, fieldSizing: 'content' } as object,
})
