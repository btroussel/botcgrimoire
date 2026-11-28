import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { AbilityText } from '../AbilityText'
import { IconButton, focusStyle, isFocused } from '../Button'
import { CharacterIcon } from '../CharacterIcon'
import { Icon } from '../icons'
import { useFocusVisible } from '../focus'
import { PaperTexture } from '../PaperTexture'
import type { Palette } from '../theme'
import { motion, palette, tabular, type } from '../theme'
import { readRowIcon, rowIcon, smallArt, styles } from './styles'
import type { ScriptSheetJinx, ScriptSheetMode, ScriptSheetRow, ScriptSheetTeam } from './types'

// An unchosen row dims its art rather than the button around it, so a focus ring keeps its strength.
const Portrait = ({ row, size, lazy = false, dim = false }: { readonly row: ScriptSheetRow | undefined; readonly size: number; readonly lazy?: boolean; readonly dim?: boolean }) =>
  row ? <CharacterIcon id={row.id} team={row.team} size={size} lazy={lazy} {...(dim ? { style: styles.dimmed } : {})} /> : <View style={{ width: size, height: size }} />

// The deal's band fills toward its count, since a bag is counted at a glance. Compose says the
// count in words only: there the fill was a second, fainter copy of the number beside it.
export const Band = ({ group, color, fills, p }: { readonly group: ScriptSheetTeam; readonly color: string; readonly fills: boolean; readonly p: Palette; }) => {
  const fill = fills && group.count && group.count.of > 0 ? Math.min(1, group.count.have / group.count.of) : 0
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
      {group.add ? (
        <IconButton icon="add" label={group.add.label} onPress={group.add.onPress} surface="paper" style={styles.bandAdd} />
      ) : null}
      {rule(Math.max(0, fill * 2 - 1))}
    </View>
  )
}

// ---------------------------------------------------------------------------------------------
// One character: the icon (its own tap), the name in the team's colour, the ability. In the deal
// a chosen row is the one with full-strength art, a bold name and a black ability; an unchosen
// one has faint art, a regular name and muted ink. The weight is there so the choice never rests
// on how faded a row looks, and no badge covers the art. Compose lists only the chosen characters.
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
  readonly onEdit: ((id: string) => void) | undefined
  readonly editLabel: string | undefined
}

// Group counts change on every pick. Individual row fields let unchanged rows skip that render.
export const Row = memo(function Row({ color, jinxPartners, mode, selected, onTap, onTapIcon, onLongPress, onRemove, removeLabel, onEdit, editLabel, ...row }: RowProps) {
  const p = palette
  const focusVisible = useFocusVisible()
  const inBag = mode === 'deal' && row.inBag !== undefined && row.inBag >= 2 ? row.inBag : undefined
  const compact = mode !== 'deal'
  const dim = mode !== 'read' && !selected
  const longPress = onLongPress ? { onLongPress: () => onLongPress(row.id) } : {}
  const portrait = <Portrait row={row} size={compact ? readRowIcon : rowIcon * 0.9} lazy={mode === 'compose'} dim={dim} />
  // A homebrew row's words open its record: the pencil after the name says so, and the row keeps
  // one control at its end, so it stands no taller than the rows around it.
  const edit = onEdit && row.homebrew ? () => onEdit(row.id) : undefined
  const name = <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 4 }}>
          <Text id={`script-sheet-name-${row.id}`} style={[dim ? type.text.body : type.text.strong, { color }]}>{row.name}{inBag !== undefined ? ` ×${inBag}` : ''}</Text>
          {edit ? <Icon name="edit" color={p.inkMuted} size={14} /> : null}
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
  // An unchosen row's words keep their full opacity, since they are read to make the choice.
  // What hangs under the row, such as the Bootlegger's rules, has colours of its own, so it
  // steps back by opacity.
  const stepBack = { opacity: dim ? 0.8 : 1 }
  const details = (
    <View>
      {name}
      <Text id={`script-sheet-ability-${row.id}`} style={[type.text.small, { color: dim ? p.inkMuted : p.ink }]}><AbilityText text={row.ability} /></Text>
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
          </Pressable> : edit ? <Pressable
            accessibilityRole="button"
            accessibilityLabel={editLabel ?? row.name}
            onPress={edit}
            style={(state) => [styles.rowAction, focusStyle(p, isFocused(state) && focusVisible, 'paper'), { opacity: state.pressed ? motion.pressedOpacity : 1 }]}
          >
            {details}
          </Pressable> : <View style={styles.rowAction}>{details}</View>}
          {row.below ? <View style={[styles.below, stepBack]}>{row.below}</View> : null}
        </View>
      </View>
      {onRemove && !row.implied ? <IconButton icon="close" label={removeLabel ?? row.name} onPress={() => onRemove(row.id)} surface="paper" quiet /> : null}
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
