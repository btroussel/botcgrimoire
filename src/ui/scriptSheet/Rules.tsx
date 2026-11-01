// The Bootlegger's homebrew rules, hung under its row: its ability says the script has some, and
// they read right after it. Printed as the author wrote them, or written in compose one bare field
// per rule, like the title, where a blank one is dropped on saving.
import { useState } from 'react'
import type { TextStyle } from 'react-native'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { Button, IconButton } from '../Button'
import type { Palette } from '../theme'
import { space, type } from '../theme'
import { styles as sheet } from './styles'
import type { ScriptSheetRulesField } from './types'

// Spacing alone left rules of one line reading as a paragraph, and the ability above as its
// first sentence. A hanging bullet starts each rule, and the ability, which has none, reads apart.
const Bullet = ({ text, p }: { readonly text: TextStyle; readonly p: Palette }) =>
  <Text aria-hidden style={[text, styles.bullet, { color: p.inkMuted }]}>•</Text>

// The read form, which the board's reference draws too in its own text size.
export const RuleList = ({ id, label, rules, text, p }: {
  readonly id?: string
  readonly label: string
  readonly rules: readonly string[]
  readonly text: TextStyle
  readonly p: Palette
}) => (
  <View {...(id ? { id } : {})} role="list" aria-label={label} style={styles.list}>
    {rules.map((rule, i) => (
      <View key={i} role="listitem" style={styles.item}>
        <Bullet text={text} p={p} />
        <Text style={[text, styles.text, { color: p.ink }]}>{rule}</Text>
      </View>
    ))}
  </View>
)

export const Rules = ({ label, rules, field, p }: {
  readonly label: string
  readonly rules?: readonly string[]
  readonly field?: ScriptSheetRulesField
  readonly p: Palette
}) => {
  // Only a rule just added takes the cursor; the ones already written wait for a tap.
  const [added, setAdded] = useState<number>()
  const [focused, setFocused] = useState<number>()
  if (!field) return <RuleList id="script-sheet-rules" label={label} rules={rules ?? []} text={type.text.small} p={p} />
  // Each field sits where its rule will print, so the draft reads like the saved sheet.
  return (
    <View id="script-sheet-rules" style={[styles.list, styles.fields]}>
      {field.values.map((rule, i) => (
        <View key={i} style={styles.item}>
          <View style={styles.fieldBullet}><Bullet text={type.text.small} p={p} /></View>
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
  list: { gap: space.sm, paddingTop: space.xs },
  fields: { gap: space.xs }, // each field's own padding and rule already set it apart
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  bullet: { width: space.sm, userSelect: 'none' }, // a copied rule comes without it
  text: { flex: 1, minWidth: 0 },
  fieldBullet: { paddingTop: space.sm },
  // Sized to the text by the browser where it can; elsewhere a long rule scrolls in its field.
  input: { flex: 1, paddingVertical: space.sm, fieldSizing: 'content' } as object,
  // The button's own padding would set its icon in from the bullets, where it adds the next rule.
  add: { alignItems: 'flex-start', marginLeft: -space.lg },
})
