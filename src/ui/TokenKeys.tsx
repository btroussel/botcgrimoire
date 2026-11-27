// The token keyboard: printed character tokens as keys, grouped under their team's label in the
// order the feature gives. It knows nothing about what a token means: the feature passes the keys,
// which are chosen, whether more can be taken, and what a tap does. A feature whose keys are not
// characters, such as reminders, draws each key itself and keeps the same groups and columns.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Icon } from './icons'
import { Token } from './Token'
import { hairline, palette, space, tokenKeys, type } from './theme'

export interface TokenKey {
  readonly id: string
  readonly name: string // in the locale: the key's name for a screen reader and its print
}

export interface TokenKeyGroup<K extends TokenKey = TokenKey> {
  readonly key: string
  readonly label: string
  readonly color: string // the team's colour on paper
  readonly keys: readonly K[]
}

export interface TokenKeysProps<K extends TokenKey> {
  readonly groups: readonly TokenKeyGroup<K>[]
  readonly chosen: readonly string[]
  readonly full?: boolean // nothing more can be taken: every key not chosen dims and takes no tap
  readonly onPress: (key: K) => void
  readonly render?: (key: K, size: number, press: () => void) => ReactNode // a key drawn by the feature, in place of a character token
}

const { size, gap, across, check, checkGlyph, labelTracking } = tokenKeys
const span = (count: number) => count * size + Math.max(0, count - 1) * gap

export const TokenKeys = <K extends TokenKey>({ groups, chosen, full = false, onPress, render }: TokenKeysProps<K>) => {
  const p = palette
  const [width, setWidth] = useState(0)
  const columns = Math.max(1, Math.min(across, Math.floor((width + gap) / (size + gap))))
  // Each team has its own rows, so the keys stand in the same places whatever the script: a
  // script with one Demon and one with four differ only in how far that row runs.
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.measure}>
      {width > 0 ? <View style={[styles.groups, { width: span(columns) }]}>
        {groups.filter((g) => g.keys.length > 0).map((g) => (
          <View key={g.key} style={styles.group}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" numberOfLines={1} style={[type.text.label, styles.label, { color: g.color }]}>{g.label}</Text>
              <View style={[styles.rule, { backgroundColor: p.parchmentShade }]} />
            </View>
            <View style={[styles.keys, { gap }]}>
              {g.keys.map((k) => {
                const on = chosen.includes(k.id)
                const blocked = full && !on
                if (render) return <View key={k.id} style={[styles.drawn, { width: size, height: size }]}>{render(k, size, () => onPress(k))}</View>
                return (
                  <View key={k.id} style={{ width: size, height: size }}>
                    <Token size={size} character={k.id} name={k.name} printName accessibilityLabel={k.name}
                      selected={on} dim={blocked} disabled={blocked} surface="paper" onPress={() => onPress(k)} />
                    {/* Selection never relies on colour alone. */}
                    {on ? <View pointerEvents="none" aria-hidden style={[styles.check, { backgroundColor: p.ink, borderColor: p.accent }]}>
                      <Icon name="check" color={p.parchment} size={checkGlyph} />
                    </View> : null}
                  </View>
                )
              })}
            </View>
          </View>
        ))}
      </View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  measure: { alignSelf: 'stretch', alignItems: 'center' },
  groups: { gap: space.md },
  group: { gap: space.xs },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { textTransform: 'uppercase', letterSpacing: labelTracking, flexShrink: 1 },
  rule: { flex: 1, height: hairline },
  keys: { flexDirection: 'row', flexWrap: 'wrap' },
  drawn: { alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', top: -space.xs, right: -space.xs, width: check, height: check, borderRadius: check / 2,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
})
