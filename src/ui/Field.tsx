import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { focusStyle } from './Button'
import { useFocusVisible } from './focus'
import { palette, radius, space, touch, type } from './theme'

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
  return <View style={styles.wrap}>
    <Text style={[type.text.small, { color: palette.inkMuted }]}>{label}</Text>
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
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: palette.paperInset, borderWidth: 1, borderColor: palette.parchmentShade },
  tall: { alignItems: 'flex-start', paddingVertical: space.sm },
  input: { flex: 1, minWidth: 0, minHeight: touch, paddingVertical: 0, outlineWidth: 0, color: palette.ink },
  inputTall: { minHeight: touch * 2 },
  // Sized to the text by the browser where it can; elsewhere the starting height scrolls.
  inputSized: { minHeight: 0, fieldSizing: 'content' } as object,
})
