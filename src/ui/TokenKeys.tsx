// The token keyboard: printed character tokens as keys, grouped under their team's label in the
// order the feature gives. It knows nothing about what a token means: the feature passes the keys,
// which are chosen, whether more can be taken, and what a tap does.
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Icon } from './icons'
import { Token } from './Token'
import { hairline, palette, space, tokenKeys, type } from './theme'

export interface TokenKey {
  readonly id: string
  readonly name: string // in the locale: the key's name for a screen reader and its print
}

export interface TokenKeyGroup {
  readonly key: string
  readonly label: string
  readonly color: string // the team's colour on paper
  readonly keys: readonly TokenKey[]
}

export interface TokenKeysProps {
  readonly groups: readonly TokenKeyGroup[]
  readonly chosen: readonly string[]
  readonly full?: boolean // nothing more can be taken: every key not chosen dims and takes no tap
  readonly onPress: (key: TokenKey) => void
}

const { size, gap, across, check } = tokenKeys
const span = (count: number) => count * size + Math.max(0, count - 1) * gap

export const TokenKeys = ({ groups, chosen, full = false, onPress }: TokenKeysProps) => {
  const p = palette
  const [width, setWidth] = useState(0)
  const columns = Math.max(1, Math.min(across, Math.floor((width + gap) / (size + gap))))
  // Each group is as wide as its keys, so a short team shares a row with the next when both
  // fit; the shared gap keeps every key on the same columns. A lone Demon still takes two
  // columns, room for its label in every language.
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.measure}>
      {width > 0 ? <View style={[styles.groups, { width: span(columns), columnGap: gap }]}>
        {groups.filter((g) => g.keys.length > 0).map((g) => (
          <View key={g.key} style={[styles.group, { width: span(Math.min(columns, Math.max(2, g.keys.length))) }]}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" numberOfLines={1} style={[type.text.label, styles.label, { color: g.color }]}>{g.label}</Text>
              <View style={[styles.rule, { backgroundColor: p.parchmentShade }]} />
            </View>
            <View style={[styles.keys, { gap }]}>
              {g.keys.map((k) => {
                const on = chosen.includes(k.id)
                const blocked = full && !on
                return (
                  <View key={k.id} style={{ width: size, height: size }}>
                    <Token size={size} character={k.id} name={k.name} printName accessibilityLabel={k.name}
                      selected={on} dim={blocked} disabled={blocked} onPress={() => onPress(k)} />
                    {/* Selection never relies on colour alone. */}
                    {on ? <View pointerEvents="none" aria-hidden style={[styles.check, { backgroundColor: p.ink, borderColor: p.accent }]}>
                      <Icon name="check" color={p.parchment} size={check - 6} />
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
  groups: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  group: { gap: space.xs },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 1 },
  rule: { flex: 1, height: hairline },
  keys: { flexDirection: 'row', flexWrap: 'wrap' },
  check: { position: 'absolute', top: -space.xs, right: -space.xs, width: check, height: check, borderRadius: check / 2,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
})
