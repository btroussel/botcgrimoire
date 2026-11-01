// The Bootlegger's homebrew rules, the section after the jinxes: printed as the author wrote
// them, or written one field per rule in compose, where a blank one is dropped on saving.
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button, IconButton } from '../Button'
import { CharacterIcon } from '../CharacterIcon'
import { Field } from '../Field'
import type { Palette } from '../theme'
import { space, type } from '../theme'
import { styles as sheet } from './styles'
import type { ScriptSheetRulesField } from './types'

export const Rules = ({ heading, rules, field, p }: {
  readonly heading: string
  readonly rules?: readonly string[]
  readonly field?: ScriptSheetRulesField
  readonly p: Palette
}) => {
  // Only a rule just added takes the cursor; the ones already written wait for a tap.
  const [added, setAdded] = useState<number>()
  return (
    <View id="script-sheet-rules" style={sheet.section}>
      <View style={sheet.jinxHeading}>
        <CharacterIcon id="bootlegger" team="loric" size={24} />
        <Text role="heading" style={[type.text.strong, sheet.heading, { color: p.ink }]}>{heading}</Text>
      </View>
      {field ? (
        <>
          {field.values.map((rule, i) => (
            <View key={i} style={styles.rule}>
              <View style={styles.field}>
                <Field label={field.text(i + 1)} value={rule} multiline lines={2} autoFocus={i === added}
                  onChange={(value) => field.onChange(field.values.map((r, at) => (at === i ? value : r)))} />
              </View>
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
        </>
      ) : rules?.map((rule, i) => <Text key={i} style={[type.text.small, { color: p.inkMuted }]}>{rule}</Text>)}
    </View>
  )
}

const styles = StyleSheet.create({
  rule: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  field: { flex: 1, minWidth: 0 },
  add: { alignItems: 'flex-start' },
})
