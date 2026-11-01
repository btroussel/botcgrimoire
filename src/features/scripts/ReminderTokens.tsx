// A homebrew character's reminder tokens as the board will show them: each a reminder disc with
// the character's art and its words on the rim, typed underneath, with a small remove badge on
// the disc. The dashed slot adds one and puts the cursor in it; a token left blank is dropped when
// the character is saved.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'

import { focusStyle, isFocused } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import { AddSlot, ReminderChip } from '../../ui/ReminderChip'
import { motion, palette, radius, space, touch, type } from '../../ui/theme'
import { limits } from './character'

const disc = 64
const badge = 26

export interface ReminderTokensProps {
  readonly reminders: readonly string[]
  readonly art: (size: number) => ReactNode // the character's art at the given size
  readonly words: {
    readonly add: string
    readonly text: (n: number) => string // the field's accessible name
    readonly remove: (text: string) => string
    readonly placeholder: string
  }
  readonly onChange: (reminders: readonly string[]) => void
}

export const ReminderTokens = ({ reminders, art, words, onChange }: ReminderTokensProps) => {
  // Only a token just added takes the cursor; the ones already written wait for a tap.
  const [added, setAdded] = useState<number>()
  const [focused, setFocused] = useState<number>()
  const edit = (at: number, text: string) => onChange(reminders.map((r, i) => (i === at ? text : r)))
  return (
    <View style={styles.row}>
      {reminders.map((text, i) => (
        <View key={i} style={styles.item}>
          <View style={styles.disc}>
            <ReminderChip size={disc} label={text.trim() || words.placeholder} art={art(disc * 0.58)} />
            <Remove label={words.remove(text.trim() || words.text(i + 1))}
              onPress={() => { setAdded(undefined); onChange(reminders.filter((_, at) => at !== i)) }} />
          </View>
          <TextInput value={text} onChangeText={(value) => edit(i, value)} maxLength={limits.reminder} autoFocus={i === added}
            placeholder={words.placeholder} placeholderTextColor={palette.inkMuted} accessibilityLabel={words.text(i + 1)}
            onFocus={() => setFocused(i)} onBlur={() => setFocused(undefined)}
            style={[type.text.small, styles.input, { borderColor: focused === i ? palette.ink : palette.parchmentShade }]} />
        </View>
      ))}
      <View style={styles.item}>
        <AddSlot size={disc} label={words.add} onPress={() => { setAdded(reminders.length); onChange([...reminders, '']) }} />
      </View>
    </View>
  )
}

// A small ink disc on the token's shoulder, with the full touch target around it.
const Remove = ({ label, onPress }: { readonly label: string; readonly onPress: () => void }) => {
  const focusVisible = useFocusVisible()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={(state) => [styles.remove, focusStyle(palette, isFocused(state) && focusVisible, 'paper'), { opacity: state.pressed ? motion.pressedOpacity : 1 }]}>
      <View style={[styles.badge, { backgroundColor: palette.ink, borderColor: palette.parchment }]}>
        <Icon name="close" color={palette.parchment} size={14} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.sm },
  item: { width: 96, alignItems: 'center', gap: space.sm },
  disc: { width: disc, height: disc },
  remove: {
    position: 'absolute', top: (badge - touch) / 2 - space.xxs, right: (badge - touch) / 2 - space.xs,
    width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center',
  },
  badge: { width: badge, height: badge, borderRadius: badge / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  input: {
    alignSelf: 'stretch', minWidth: 0, minHeight: touch, paddingHorizontal: space.xs, color: palette.ink, textAlign: 'center', outlineWidth: 0,
    borderRadius: radius.control, borderWidth: 1, backgroundColor: palette.paperInset,
  },
})
