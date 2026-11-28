// The token keyboard: printed character tokens as keys, grouped under their team's label in the
// order the feature gives. It knows nothing about what a token means: the feature passes the keys,
// which are chosen, whether more can be taken, and what a tap does. A feature whose keys are not
// characters, such as reminders, draws each key itself and keeps the same groups and columns.
import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { ViewInstance } from 'react-native'

import { domElement } from './focus'
import { Icon } from './icons'
import { Token } from './Token'
import { tokenKeysLayout } from './tokenKeysLayout'
import { hairline, palette, ring, space, tabular, tokenKeys, type } from './theme'

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
  readonly chosen: readonly string[] // a key listed twice is chosen twice, and its badge counts the copies
  readonly full?: boolean // nothing more can be taken: every key not chosen dims and takes no tap
  readonly onPress: (key: K) => void
  readonly onLongPress?: (key: K) => void
  readonly render?: (key: K, size: number, press: () => void) => ReactNode // a key drawn by the feature, in place of a character token
}

const { gap, check, checkGlyph, labelTracking } = tokenKeys
// A chosen key draws this much smaller, so its ring stays inside its own place and two chosen
// neighbours never run their rings together.
const ringRoom = ring.width + ring.gap

export const TokenKeys = <K extends TokenKey>({ groups, chosen, full = false, onPress, onLongPress, render }: TokenKeysProps<K>) => {
  const p = palette
  const [width, setWidth] = useState(0)
  // Measured before the first paint too, as onLayout does after it: the keys would otherwise first
  // draw as an empty strip, and whatever stands beside them would jump as they fill it.
  const measure = useRef<ViewInstance>(null)
  useLayoutEffect(() => {
    const node = domElement(measure.current)
    if (node) setWidth(node.offsetWidth)
  }, [])
  const { size, width: across } = tokenKeysLayout(width)
  // Each team has its own rows, so the keys stand in the same places whatever the script: a
  // script with one Demon and one with four differ only in how far that row runs.
  return (
    <View ref={measure} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.measure}>
      {width > 0 ? <View style={[styles.groups, { width: across }]}>
        {groups.filter((g) => g.keys.length > 0).map((g) => (
          <View key={g.key} style={styles.group}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" numberOfLines={1} style={[type.text.label, styles.label, { color: g.color }]}>{g.label}</Text>
              <View style={[styles.rule, { backgroundColor: p.parchmentShade }]} />
            </View>
            <View style={[styles.keys, { gap }]}>
              {g.keys.map((k) => {
                const count = chosen.filter((id) => id === k.id).length
                const on = count > 0
                const blocked = full && !on
                if (render) return <View key={k.id} style={[styles.drawn, { width: size, height: size }]}>{render(k, size, () => onPress(k))}</View>
                return (
                  <View key={k.id} style={[styles.drawn, { width: size, height: size }]}>
                    {/* The wake and setup leaves are for the board: on a key they only cover the name. */}
                    <Token size={on ? size - 2 * ringRoom : size} character={k.id} name={k.name} printName markers={false} accessibilityLabel={k.name}
                      selected={on} dim={blocked} disabled={blocked} surface="paper" onPress={() => onPress(k)}
                      {...(onLongPress ? { onLongPress: () => onLongPress(k) } : {})} />
                    {/* Selection never relies on colour alone. */}
                    {on ? <View pointerEvents="none" aria-hidden style={[styles.check, { backgroundColor: p.ink, borderColor: p.accent }]}>
                      {count > 1 ? <Text style={[type.text.label, tabular, { color: p.parchment }]}>{count}</Text>
                        : <Icon name="check" color={p.parchment} size={checkGlyph} />}
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
  check: { position: 'absolute', top: 0, right: 0, width: check, height: check, borderRadius: check / 2,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
})
