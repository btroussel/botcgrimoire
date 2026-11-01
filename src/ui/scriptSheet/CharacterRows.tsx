import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AbilityText } from '../AbilityText'
import { IconButton, focusStyle, isFocused } from '../Button'
import { CharacterIcon } from '../CharacterIcon'
import { useFocusVisible } from '../focus'
import { PaperTexture } from '../PaperTexture'
import type { Palette } from '../theme'
import { motion, palette, tabular, type } from '../theme'
import { readRowIcon, rowIcon, smallArt, styles } from './styles'
import type { ScriptSheetJinx, ScriptSheetMode, ScriptSheetRow, ScriptSheetTeam } from './types'

// An unchosen row dims its art rather than the button around it, so a focus ring keeps its strength.
const Portrait = ({ row, size, lazy = false, dim = false }: { readonly row: ScriptSheetRow | undefined; readonly size: number; readonly lazy?: boolean; readonly dim?: boolean }) =>
  row ? <CharacterIcon id={row.id} team={row.team} size={size} lazy={lazy} {...(dim ? { style: styles.dimmed } : {})} /> : <View style={{ width: size, height: size }} />

export const Band = ({ group, color, p }: { readonly group: ScriptSheetTeam; readonly color: string; readonly p: Palette; }) => {
  const fill = group.count && group.count.of > 0 ? Math.min(1, group.count.have / group.count.of) : 0
  // Separate rules leave a gap for the label without an opaque patch over the paper. The add
  // control sits in that gap beside the count, so the rules keep the rows' gutters.
  const rule = (progress: number) => (
    <View style={[styles.rule, { backgroundColor: p.parchmentShade }]}>
      {progress > 0 ? <View style={[styles.fill, { backgroundColor: color, width: `${progress * 100}%` }]} /> : null}
    </View>
  )
  return (
    <View id={`script-sheet-band-${group.team}`} style={[styles.band, group.add ? styles.editableBand : null, { backgroundColor: p.parchment }]}>
      <PaperTexture />
      {rule(Math.min(1, fill * 2))}
      <View style={styles.bandLabel}>
        <Text style={[type.display.band, { color }]} numberOfLines={1}>
          {group.label}
        </Text>
        {group.count ? (
          <Text style={[type.text.strong, tabular, { color: p.inkMuted }]} numberOfLines={1}>
            {group.count.label}
          </Text>
        ) : null}
      </View>
      {group.add && group.rows.length > 0 ? (
        <IconButton icon="add" label={group.add.label} onPress={group.add.onPress} surface="paper" style={styles.bandAdd} />
      ) : null}
      {rule(Math.max(0, fill * 2 - 1))}
    </View>
  )
}

// ---------------------------------------------------------------------------------------------
// One character: the icon (its own tap), the name in the team's colour, the ability, and when
// selected in compose or deal mode, the art and text come to full opacity without extra marks.
// Compose draws the reader's compact row, so the draft looks like the sheet it saves; the deal
// keeps large art because the icon is its tap target.

interface RowProps extends ScriptSheetRow {
  readonly color: string
  readonly jinxPartners?: readonly ScriptSheetRow[] | undefined
  readonly mode: ScriptSheetMode
  readonly selected: boolean
  readonly onTap: ((id: string) => void) | undefined
  readonly onTapIcon: ((id: string) => void) | undefined
  readonly onLongPress: ((id: string) => void) | undefined
  readonly onRemove: ((id: string) => void) | undefined
  readonly removeLabel: string | undefined
}

// Group counts change on every pick. Individual row fields let unchanged rows skip that render.
export const Row = memo(function Row({ color, jinxPartners, mode, selected, onTap, onTapIcon, onLongPress, onRemove, removeLabel, ...row }: RowProps) {
  const p = palette
  const focusVisible = useFocusVisible()
  const inBag = mode === 'deal' && row.inBag !== undefined && row.inBag >= 2 ? row.inBag : undefined
  const compact = mode !== 'deal'
  const dim = mode !== 'read' && !selected
  const longPress = onLongPress ? { onLongPress: () => onLongPress(row.id) } : {}
  const portrait = <Portrait row={row} size={compact ? readRowIcon : rowIcon * 0.9} lazy={mode === 'compose'} dim={dim} />
  const name = <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 4 }}>
          <Text id={`script-sheet-name-${row.id}`} style={[type.text.strong, { color }]}>{row.name}{inBag !== undefined ? ` ×${inBag}` : ''}</Text>
          {jinxPartners && jinxPartners.length > 0 ? (
            <span className="script-jinx-markers" aria-label={jinxPartners.map((partner) => partner.name).join(', ')}>
              {jinxPartners.map((partner) => (
                <span key={partner.id} title={partner.name}>
                  <Portrait row={partner} size={16} />
                </span>
              ))}
            </span>
          ) : null}
        </View>
  // Unchosen rows step back but their words still read on vellum; the dimmer icon carries the cue.
  const details = (
    <View style={{ opacity: dim ? 0.8 : 1 }}>
      {name}
      <Text id={`script-sheet-ability-${row.id}`} style={[type.text.small, { color: p.ink }]}><AbilityText text={row.ability} /></Text>
    </View>
  )
  // Keep the icon, character selection and any setup choices outside each other's buttons.
  return (
    <View style={[styles.row, compact ? styles.readRow : null]}>
      {onTapIcon ? <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.name}
        onPress={() => onTapIcon?.(row.id)}
        {...longPress}
        style={(state) => [styles.iconHit, compact ? styles.readIconHit : null, focusStyle(p, isFocused(state) && focusVisible, 'paper'), { opacity: state.pressed ? motion.pressedOpacity : 1 }]}
      >
        {portrait}
      </Pressable> : (
        <View style={[styles.iconHit, compact ? styles.readIconHit : null]}>{portrait}</View>
      )}
      <View style={[styles.rowBody, compact ? styles.readRowBody : null]}>
        <View style={styles.rowText}>
          {onTap ? <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${row.name}. ${row.ability}`}
            aria-pressed={selected}
            onPress={() => onTap?.(row.id)}
            {...longPress}
            style={(state) => [styles.rowAction, focusStyle(p, isFocused(state) && focusVisible, 'paper'), { opacity: state.pressed ? motion.pressedOpacity : 1 }]}
          >
            {details}
          </Pressable> : <View style={styles.rowAction}>{details}</View>}
          {row.below}
        </View>
      </View>
      {onRemove && !row.implied ? <IconButton icon="close" label={removeLabel ?? row.name} onPress={() => onRemove(row.id)} surface="paper" /> : null}
    </View>
  )
})

// The paired icons identify each ruling in the final Jinx section.
export const JinxLine = ({ jinx, rowsById, p }: { readonly jinx: ScriptSheetJinx; readonly rowsById: ReadonlyMap<string, ScriptSheetRow>; readonly p: Palette }) => {
  return (
    <View id={`script-sheet-jinx-${jinx.a}-${jinx.b}`} style={styles.jinx}>
      <View style={styles.jinxPair}>
        <Portrait row={rowsById.get(jinx.a)} size={smallArt} />
        <Portrait row={rowsById.get(jinx.b)} size={smallArt} />
      </View>
      <Text style={[type.text.small, styles.grow, { color: p.inkMuted }]}>
        {jinx.reason}
      </Text>
    </View>
  )
}
