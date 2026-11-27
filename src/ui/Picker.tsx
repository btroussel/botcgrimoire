// A centred window that picks one name from a short list read top to bottom, today the app's
// language. A tap picks and the feature closes; the chosen row carries a check. Token choices come
// up in the token keys' drawer instead. It knows nothing about what a row means; the feature fills
// the rows and translates every word.
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { focusStyle, isFocused } from './Button'
import { useFocusVisible } from './focus'
import { Icon } from './icons'
import { Sheet } from './Sheet'
import { palette, radius, space, touch, type } from './theme'

export interface PickerRow {
  readonly id: string
  readonly name: string
  readonly lang?: string // a name in another language than the page, such as a language's own name
}

export interface PickerProps {
  readonly visible: boolean
  readonly title: string
  readonly onClose: () => void
  readonly closeLabel: string
  readonly rows: readonly PickerRow[]
  readonly onPick: (id: string) => void
  readonly selected?: readonly string[]
}

export const Picker = ({ visible, title, onClose, closeLabel, rows, onPick, selected = [] }: PickerProps) => {
  const p = palette
  const focusVisible = useFocusVisible()
  return (
    <Sheet visible={visible} title={title} onClose={onClose} closeLabel={closeLabel} width={640}>
      <View style={styles.list}>
        {rows.map((row) => {
          const on = selected.includes(row.id)
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              aria-pressed={on}
              // A name in its own language is announced in that language.
              accessibilityLabel={row.name}
              {...(row.lang ? { lang: row.lang } : {})}
              onPress={() => onPick(row.id)}
              style={(state) => [styles.row, { backgroundColor: state.pressed ? p.paperPressed : 'transparent' }, focusStyle(p, isFocused(state) && focusVisible, 'paper')]}
            >
              <View style={styles.rowHeading}>
                <View style={styles.rowText}>
                  <Text style={[type.text.strong, { color: p.ink }]}>{row.name}</Text>
                </View>
                {on ? (
                  <View style={[styles.check, { backgroundColor: p.accent }]}>
                    <Icon name="check" color={p.onAccent} size={16} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  // Ten names fit without scrolling on a phone, and 36 points still taps reliably in a single
  // column.
  list: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 36, paddingVertical: space.xxs, paddingHorizontal: space.sm, borderRadius: radius.control },
  rowHeading: { flexDirection: 'row', alignItems: 'center', gap: space.md, width: '100%' },
  rowText: { flex: 1, minWidth: 0, gap: space.xxs },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: (touch - 24) / 2 },
})
