// The Bootlegger's homebrew rules, hung under its row: its ability says the script has some, and
// they read right after it. Printed as the author wrote them, or written in compose one bare field
// per rule, like the title, where a blank one is dropped on saving.
import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { Button, IconButton } from '../Button'
import type { Palette } from '../theme'
import { space, type } from '../theme'
import { styles as sheet } from './styles'
import type { ScriptSheetRulesField } from './types'

export const Rules = ({ label, rules, field, p }: {
  readonly label: string
  readonly rules?: readonly string[]
  readonly field?: ScriptSheetRulesField
  readonly p: Palette
}) => {
  // Only a rule just added takes the cursor; the ones already written wait for a tap.
  const [added, setAdded] = useState<number>()
  const [focused, setFocused] = useState<number>()
  if (!field) return (
    <View id="script-sheet-rules" role="list" aria-label={label} style={styles.list}>
      {rules?.map((rule, i) => <Text key={i} role="listitem" style={[type.text.small, { color: p.ink }]}>{rule}</Text>)}
    </View>
  )
  return (
    <View id="script-sheet-rules" style={styles.list}>
      {field.values.map((rule, i) => (
        <View key={i} style={styles.rule}>
          <TextInput
            value={rule}
            multiline
            autoFocus={i === added}
            placeholder={field.text(i + 1)}
            placeholderTextColor={p.inkMuted}
            accessibilityLabel={field.text(i + 1)}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused(undefined)}
            onChangeText={(value) => field.onChange(field.values.map((r, at) => (at === i ? value : r)))}
            style={[type.text.small, sheet.nameField, styles.input, { color: p.ink, borderBottomColor: focused === i ? p.accent : p.parchmentShade }]}
          />
          <IconButton icon="close" label={field.remove(i + 1)} surface="paper"
            onPress={() => { setAdded(undefined); field.onChange(field.values.filter((_, at) => at !== i)) }} />
        </View>
      ))}
      {field.add ? (
        <View style={styles.add}>
          <Button label={field.add} icon="add" variant="text" surface="paper"
            onPress={() => { setAdded(field.values.length); field.onChange([...field.values, '']) }} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: space.xs, paddingTop: space.xs },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  // Sized to the text by the browser where it can; elsewhere a long rule scrolls in its field.
  input: { flex: 1, paddingVertical: space.sm, fieldSizing: 'content' } as object,
  // The button's own padding would set its icon in from the rules' text.
  add: { alignItems: 'flex-start', marginLeft: -space.lg },
})
