// One sheet for every choice from a list: a character for a seat or a card, the bluffs, the bag,
// the loose Fabled and Loric, the app's language.
// Grouped rows with a check on what is chosen.
// A tap picks and closes unless the picker is `multi`, where the footer's
// primary confirms the set. It knows nothing about what a row means; the feature fills the rows
// and translates every word.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { teams } from '../content'
import { CharacterIcon } from './CharacterIcon'

import { Button, IconButton, focusStyle, isFocused } from './Button'
import { EdgeButton } from './EdgeButton'
import { useFocusVisible } from './focus'
import { Icon } from './icons'
import { Sheet } from './Sheet'
import { Token } from './Token'
import { palette, radius, space, tabular, touch, type } from './theme'

export interface PickerRow {
  readonly id: string
  readonly name: string
  readonly detail?: string
  readonly character?: string // token preview for a character selection
  readonly lang?: string // a name in another language than the page, such as a language's own name
}

export interface PickerGroup {
  readonly key: string
  readonly label?: string
  readonly color?: string
  readonly rows: readonly PickerRow[]
}

export interface PickerMulti {
  readonly max: number
  readonly min?: number // the footer wakes from this many chosen; exactly `max` when omitted
  readonly shuffleLabel?: string // opt in to random defaults and a shuffle control
  readonly repeat?: boolean // a long press on a token chooses it once more, as for a bag's repeats
  readonly confirmLabel: (count: number) => string
  readonly onConfirm: (ids: readonly string[]) => void
}

export interface PickerProps {
  readonly visible: boolean
  readonly title: string
  readonly onClose: () => void
  readonly closeLabel: string
  readonly onBack?: () => void
  readonly backLabel?: string
  readonly groups: readonly PickerGroup[]
  readonly onPick?: (id: string) => void // single choice: picks and the feature closes
  readonly selected?: readonly string[]
  readonly multi?: PickerMulti
  readonly compactReference?: boolean // responsive ability grid with token selection and header confirmation
  readonly tokenGrid?: boolean // printed character tokens without ability text
  readonly right?: ReactNode // compact action beside the header's close control
  readonly emptyLabel: string
}

const randomSelection = (groups: readonly PickerGroup[], max: number): readonly string[] => {
  const pool = [...new Set(groups.flatMap((g) => g.rows.map((r) => r.id)))]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, max)
}

export const Picker = ({ visible, title, onClose, closeLabel, onBack, backLabel, groups, onPick, selected = [], multi, compactReference = false, tokenGrid = false, right, emptyLabel }: PickerProps) => {
  const p = palette
  const focusVisible = useFocusVisible()
  const [tokenGridWidth, setTokenGridWidth] = useState(0)
  // Seven across where there is room, so Trouble Brewing's thirteen Townsfolk take two rows.
  const gridColumns = Math.max(1, Math.min(7, Math.floor((tokenGridWidth + space.sm) / (touch + space.sm))))
  const gridTokenSize = tokenGridWidth > 0 ? Math.max(touch, Math.min(88, Math.floor((tokenGridWidth - (gridColumns - 1) * space.sm) / gridColumns))) : 64
  const initialSelection = () => selected.length === 0 && multi?.shuffleLabel !== undefined ? randomSelection(groups, multi.max) : selected
  const [chosen, setChosen] = useState<readonly string[]>(() => visible ? initialSelection() : selected)
  // The set starts over each time the sheet opens; the edge is read during render
  // so the same open state passing again changes nothing.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) {
      setChosen(initialSelection())
    }
  }

  const tap = (row: PickerRow) => {
    if (!multi) {
      onPick?.(row.id)
      return
    }
    const has = chosen.includes(row.id)
    if (!has && chosen.length >= multi.max) return
    setChosen(has ? chosen.filter((x) => x !== row.id) : [...chosen, row.id])
  }
  const isOn = (id: string) => (multi ? chosen.includes(id) : selected.includes(id))
  const again = (row: PickerRow) => {
    if (multi && chosen.length < multi.max) setChosen([...chosen, row.id])
  }

  const shuffle = multi?.shuffleLabel !== undefined ? (
    <IconButton
      icon="shuffle"
      label={multi.shuffleLabel}
      onPress={() => setChosen(randomSelection(groups, multi.max))}
      disabled={!groups.some((g) => g.rows.length > 0)}

      surface="paper"
    />
  ) : undefined

  const footer = multi && !compactReference ? (
    <View style={[styles.actions, tokenGrid && styles.compactActions]}>
      {shuffle}
      <Button style={tokenGrid ? styles.compactConfirm : styles.confirm} label={multi.confirmLabel(chosen.length)} onPress={() => multi.onConfirm(chosen)} variant="primary" surface="paper" disabled={chosen.length > multi.max || chosen.length < (multi.min ?? multi.max)} />
    </View>
  ) : undefined

  return (
    <Sheet visible={visible} title={title} onClose={onClose} closeLabel={closeLabel} width={640}
      right={compactReference && multi ? <>{right}<EdgeButton label={multi.confirmLabel(chosen.length)} onPress={() => multi.onConfirm(chosen)} disabled={chosen.length > multi.max || chosen.length < (multi.min ?? multi.max)} /></> : right}
      {...(onBack ? { onBack } : {})} {...(backLabel ? { backLabel } : {})}
      {...(footer ? { footer } : {})} {...(compactReference ? { contentPaddingHorizontal: space.md } : {})}>
      {groups.every((g) => g.rows.length === 0) ? <Text style={[type.text.body, styles.empty, { color: p.inkMuted }]}>{emptyLabel}</Text> : null}
      {tokenGrid ? groups.filter(g => g.rows.length > 0).map(g => {
        const team = teams.find(team => team === g.key)
        return <View key={g.key} style={styles.tokenSection}>
        {g.label ? <View style={styles.tokenSectionHeading}>
          {team ? <div role="heading" aria-level={2} aria-label={g.label} title={g.label}>
            <CharacterIcon id={team} team={team} size={36} />
          </div> : <Text accessibilityRole="header" style={[type.text.label, { color: g.color ?? p.ink }]}>{g.label}</Text>}
        </View> : null}
        <View style={styles.tokenGrid} onLayout={event => setTokenGridWidth(event.nativeEvent.layout.width)}>
          {g.rows.map(row => {
            const on = isOn(row.id)
            // A multi choice may hold a row more than once, such as repeated tokens in a bag.
            const copies = multi ? chosen.filter(id => id === row.id).length : 0
            return <View key={row.id} style={{ width: gridTokenSize, height: gridTokenSize }}>
              <Token size={gridTokenSize}
                character={row.character ?? row.id} name={row.name} printName
                accessibilityLabel={copies > 1 ? `${row.name} ×${copies}` : row.name} selected={on}
                style={on ? styles.selectedToken : undefined} onPress={() => tap(row)}
                {...(multi?.repeat ? { onLongPress: () => again(row) } : {})} />
              {on ? <View pointerEvents="none" aria-hidden style={styles.tokenCheck}>
                {copies > 1 ? <Text style={[type.text.label, tabular, { color: p.parchment }]}>{copies}</Text>
                  : <Icon name="check" color={p.parchment} size={17} />}
              </View> : null}
            </View>
          })}
        </View>
      </View>}) : compactReference ? groups.filter(g => g.rows.length > 0).map(g => {
        const team = teams.find(team => team === g.key)
        return <View key={g.key} style={styles.group}>
          {g.label ? <View style={styles.referenceHeading}>
            {team ? <CharacterIcon id={team} team={team} size={28} /> : null}
            <Text accessibilityRole="header" style={[type.text.strong, { color: g.color ?? p.ink }]}>{g.label}</Text>
            <View style={styles.tokenSectionRule} />
          </View> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: space.sm }}>
            {g.rows.map(row => {
              const on = isOn(row.id)
              return <Pressable key={row.id} accessibilityRole="button" aria-pressed={on}
                accessibilityLabel={row.detail ? `${row.name}, ${row.detail}` : row.name}
                onPress={() => tap(row)} style={state => [styles.referenceRow,
                  { backgroundColor: state.pressed ? p.paperPressed : 'transparent' },
                  focusStyle(p, isFocused(state) && focusVisible, 'paper')]}>
                <View style={styles.referenceArt}>
                  {row.character ? <Token size={48} character={row.character} selected={on} /> : null}
                </View>
                <View style={styles.rowText}>
                  <Text style={[type.text.strong, styles.referenceName, { color: p.ink }]}>{row.name}</Text>
                  {row.detail ? <Text style={[type.text.body, styles.referenceAbility, { color: p.ink }]}>{row.detail}</Text> : null}
                </View>
              </Pressable>
            })}
          </div>
        </View>
      }) : groups.map((g) => (
        <View key={g.key} style={styles.list}>
          {g.rows.map((row) => {
            const on = isOn(row.id)
            return (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                aria-pressed={on}
                // A name in its own language is announced in that language.
                accessibilityLabel={row.name}
                {...(row.lang ? { lang: row.lang } : {})}
                onPress={() => tap(row)}
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
      ))}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  selectedToken: { boxShadow: `0 0 0 2px ${palette.ink}, 0 0 0 5px ${palette.accent}` },
  tokenCheck: { position: 'absolute', top: -3, right: -3, width: 25, height: 25, borderRadius: 13,
    backgroundColor: palette.ink, borderWidth: 2, borderColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  tokenSection: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  tokenSectionHeading: { width: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: palette.parchmentShade, paddingRight: space.sm },
  tokenSectionRule: { flex: 1, height: 1, backgroundColor: palette.parchmentShade },
  tokenGrid: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: space.sm, paddingVertical: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  compactActions: { justifyContent: 'flex-end' },
  compactConfirm: { flexShrink: 1, minWidth: 0 },
  confirm: { flex: 1, minWidth: 0 },
  group: { gap: space.xxs },
  referenceHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs, paddingBottom: space.xs },
  referenceName: { fontSize: 14, lineHeight: 20 },
  referenceAbility: { fontSize: 13, lineHeight: 18 },
  referenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.xs,
    borderRadius: radius.control },
  referenceArt: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // The plain list holds the languages: ten names fit without scrolling on a phone, and 36 points
  // still taps reliably in a single column.
  list: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 36, paddingVertical: space.xxs, paddingHorizontal: space.sm, borderRadius: radius.control },
  rowHeading: { flexDirection: 'row', alignItems: 'center', gap: space.md, width: '100%' },
  rowText: { flex: 1, minWidth: 0, gap: space.xxs },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: (touch - 24) / 2 },
  empty: { paddingVertical: space.lg },
})
