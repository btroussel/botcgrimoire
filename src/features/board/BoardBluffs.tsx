import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { CharacterId } from '../../content'
import type { Grimoire } from '../../engine'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import { Button, IconButton } from '../../ui/Button'
import { Drawer } from '../../ui/Drawer'
import { Token } from '../../ui/Token'
import { TokenKeys } from '../../ui/TokenKeys'
import { boardBlock, boardWell, drawer, palette, space, touch, type } from '../../ui/theme'
import { bluffCount, openWells, shuffleWells, tapKey, tapWell } from './bluffWells'
import type { Wells } from './bluffWells'
import { bluffChoices, byTeam, edits } from './seat'
import { useEdits } from './useEdits'

// The not-in-play card the tray and its drawer show: the bluffs, in the good side's colours.
const useShowBluffs = () => {
  const e = useEdits()
  const interaction = useBoardInteraction()
  return (ids: readonly CharacterId[]) => {
    if (ids.length === 0) return
    interaction.showCard({
      kind: 'notInPlay',
      words: e.t('board.notInPlayWords'),
      characters: ids.map((c) => ({ id: c, name: e.name(c) })),
      tint: 'good',
    })
  }
}

// The tray's wells open the drawer the board owns, since a not-in-play card with no bluffs saved
// opens the same drawer, and a small game shows no tray. A well opens it with that well ringed.
export const BoardBluffs = ({ bluffs, boardWidth, clockWidth, canEdit, titled, onOpen }: {
  readonly bluffs: readonly CharacterId[]
  readonly boardWidth: number // the plaque shares the bottom edge from the far corner
  readonly clockWidth: number
  readonly canEdit: boolean
  readonly titled: boolean // the title over the wells; a short landscape board keeps its height for the ring
  readonly onOpen: (well: number) => void
}) => {
  const e = useEdits()
  const t = e.t
  const showBluffs = useShowBluffs()
  const bluffContentWidth = boardWidth - clockWidth - 2 * space.md - space.sm - 2 - 2 * space.xs
  const bluffSize = Math.max(touch, Math.min(60, bluffContentWidth / bluffCount))
  return (
          <View style={[styles.bluffs, { width: bluffCount * bluffSize + 2 * space.xs + 2 }]} accessibilityLabel={t('board.bluffsTitle')} role="region">
            {/* Three empty wells say nothing on their own; the region's name already reads it out.
                The title fits the slack the portrait status band already has over the tray. */}
            {titled ? <Text aria-hidden numberOfLines={1} style={[type.text.label, styles.title]}>{t('board.bluffsTitle')}</Text> : null}
            <View style={[boardBlock, styles.bluffTokens]}>
              {Array.from({ length: bluffCount }, (_, index) => {
                const c = bluffs[index]
                return <Token key={index} size={bluffSize} emptyStyle={boardWell}
                  {...(c ? { character: c, printName: true, name: e.name(c) } : {})}
                  alignment="good"
                  accessibilityLabel={c ? t('board.bluff', { name: e.name(c) }) : t('board.setBluffs')}
                  {...(canEdit ? { onPress: () => onOpen(index), ...(c ? { onLongPress: () => showBluffs(bluffs) } : {}) } : {})}
                />
              })}
            </View>
          </View>
  )
}

// Selecting bluffs stays separate from showing them, but the drawer also shows them: the
// Storyteller often chooses at the Demon's wake and shows at once, and once chosen they are shown
// far more often than changed. It opens with what is saved, never a random draw, since taking
// random picks back off cost a hand pick two or three taps.
export const BluffPicker = ({ board, bluffs, canEdit, well, visible, onClose }: {
  readonly board: Grimoire
  readonly bluffs: readonly CharacterId[]
  readonly canEdit: boolean
  readonly well: number | undefined // the well to ring first; the first empty one when omitted
  readonly visible: boolean
  readonly onClose: () => void
}) => {
  const e = useEdits()
  const t = e.t
  const p = palette
  const showBluffs = useShowBluffs()
  const choices = bluffChoices(board)
  const [state, setState] = useState<Wells>(() => openWells(bluffs, choices, well))
  // The wells start over each time the drawer opens; the edge is read during render so the same
  // open state passing again changes nothing.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setState(openWells(bluffs, choices, well))
  }
  const chosen = state.wells.filter((w): w is CharacterId => w !== undefined)

  const save = () => {
    if (canEdit) e.append(edits.setBluffs(chosen))
    onClose()
  }
  // Showing from the drawer saves the set first, so the tray and the log hold what the Demon saw.
  const saveAndShow = () => {
    const same = chosen.length === bluffs.length && chosen.every((id, i) => id === bluffs[i])
    if (canEdit && !same) e.append(edits.setBluffs(chosen))
    onClose()
    showBluffs(chosen)
  }

  const groups = byTeam(choices).map((g) => ({
    key: g.team, label: e.teamLabel(g.team), color: p.teamOnPaper[g.team],
    keys: g.ids.map((id) => ({ id, name: e.name(id) })),
  }))
  return (
    <Drawer visible={visible} title={t('board.bluffsTitle')} onClose={onClose} closeLabel={t('common.close')}
      // Away from Save, so a shuffle is never a tap meant to keep the set.
      right={<IconButton icon="shuffle" label={t('board.shuffleBluffs')} onPress={() => setState(shuffleWells(state, choices))}
        disabled={choices.length === 0} />}
      dock={<View style={styles.dock}>
        <View style={styles.wells}>
          {state.wells.map((id, index) => (
            <View key={index} style={styles.well}>
              <Token size={drawer.well} alignment="good" selected={state.ring === index}
                {...(id ? { character: id, name: e.name(id) } : {})}
                accessibilityLabel={id ? t('board.bluff', { name: e.name(id) }) : t('board.bluffEmpty', { n: index + 1 })}
                onPress={() => setState(tapWell(state, index))} />
              <Text aria-hidden numberOfLines={2} style={[type.text.label, styles.wellName, { color: p.ink }]}>{id ? e.name(id) : ''}</Text>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <Button label={t('board.showBluffsNow')} onPress={saveAndShow} surface="paper" disabled={chosen.length === 0} />
          {/* Short, so Show fits beside it; the drawer's title already says what is saved. */}
          <Button label={t('common.save')} onPress={save} variant="primary" surface="paper" />
        </View>
      </View>}>
      {choices.length === 0 ? <Text style={[type.text.body, styles.empty, { color: p.inkMuted }]}>{t('board.nothingMatches')}</Text> : null}
      <TokenKeys groups={groups} chosen={chosen} onPress={(k) => setState(tapKey(state, k.id as CharacterId))} />
    </Drawer>
  )
}

const styles = StyleSheet.create({
  bluffs: { flexShrink: 0, alignItems: 'center' },
  title: { color: palette.muted, maxWidth: '100%', textShadowColor: palette.felt, textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  bluffTokens: { flexDirection: 'row', alignSelf: 'flex-start', gap: space.xs, borderRadius: 999 },
  dock: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  wells: { flexDirection: 'row', gap: space.sm },
  // Room under each well for a name of two lines, so the wells never shift as they fill.
  well: { width: drawer.well + space.lg, alignItems: 'center', gap: space.xs },
  wellName: { textAlign: 'center', minHeight: 2 * (type.text.label.lineHeight ?? 0) },
  actions: { flexDirection: 'row', gap: space.sm, marginLeft: 'auto' },
  empty: { paddingVertical: space.lg, textAlign: 'center' },
})
