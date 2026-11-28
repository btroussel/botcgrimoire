import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { CharacterId } from '../../content'
import type { Grimoire } from '../../engine'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import { Button, IconButton } from '../../ui/Button'
import { Drawer, useOnOpen } from '../../ui/Drawer'
import { Token } from '../../ui/Token'
import { TokenKeys } from '../../ui/TokenKeys'
import { boardBlock, boardWell, palette, space, tabular, touch, type } from '../../ui/theme'
import { bluffCount, openPicks, shufflePicks, tapPick } from './bluffPicks'
import { bluffChoices, byTeam, edits } from './seat'
import { useCardWords } from './useCards'
import { useEdits } from './useEdits'

// The not-in-play card the tray and its drawer show: the phrase over the bluffs.
const useShowBluffs = () => {
  const e = useEdits()
  const interaction = useBoardInteraction()
  const words = useCardWords()
  return (ids: readonly CharacterId[]) => {
    if (ids.length === 0) return
    interaction.showCard({ words: words('notInPlay'), characters: ids.map((c) => ({ id: c, name: e.name(c) })) })
  }
}

// The tray's wells open the drawer the board owns, since a not-in-play card with no bluffs saved
// opens the same drawer, and a small game shows no tray.
export const BoardBluffs = ({ bluffs, boardWidth, clockWidth, canEdit, titled, onOpen }: {
  readonly bluffs: readonly CharacterId[]
  readonly boardWidth: number // the plaque shares the bottom edge from the far corner
  readonly clockWidth: number
  readonly canEdit: boolean
  readonly titled: boolean // the title over the wells; a short landscape board keeps its height for the ring
  readonly onOpen: () => void
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
                  {...(canEdit ? { onPress: onOpen, ...(c ? { onLongPress: () => showBluffs(bluffs) } : {}) } : {})}
                />
              })}
            </View>
          </View>
  )
}

// Selecting bluffs stays separate from showing them, but the drawer also shows them: the
// Storyteller often chooses at the Demon's wake and shows at once, and once chosen they are shown
// far more often than changed. It opens with what is saved, never a random draw, since taking
// random picks back off cost a hand pick two or three taps. The ticked keys are the picks: at a
// size that reads, a second row of the same three tokens under them said nothing new.
export const BluffPicker = ({ board, bluffs, canEdit, showFirst, visible, onClose }: {
  readonly board: Grimoire
  readonly bluffs: readonly CharacterId[]
  readonly canEdit: boolean
  readonly showFirst: boolean // opened on the way to the not-in-play card, so Show is the button that leads
  readonly visible: boolean
  readonly onClose: () => void
}) => {
  const e = useEdits()
  const t = e.t
  const p = palette
  const showBluffs = useShowBluffs()
  const choices = bluffChoices(board)
  const [picks, setPicks] = useState(() => openPicks(bluffs))
  useOnOpen(visible, () => setPicks(openPicks(bluffs)))

  const save = () => {
    if (canEdit) e.append(edits.setBluffs(picks))
    onClose()
  }
  // Showing from the drawer saves the set first, so the tray and the log hold what the Demon saw.
  const saveAndShow = () => {
    save()
    showBluffs(picks)
  }

  // A saved bluff that has since come into play keeps its key, ticked: what the Demon was shown
  // is not undone by a later character change. Only new picks and Shuffle keep to the choices.
  const groups = e.keyGroups(byTeam([...choices, ...bluffs.filter((id) => !choices.includes(id))]))
  return (
    <Drawer visible={visible} title={t('board.bluffsTitle')} onClose={onClose} closeLabel={t('common.close')}
      // Away from Save, so a shuffle is never a tap meant to keep the set.
      right={<IconButton icon="shuffle" label={t('board.shuffleBluffs')} onPress={() => setPicks(shufflePicks(picks, choices))}
        disabled={choices.length === 0} />}
      dock={<View style={styles.dock}>
        {/* The count stands for a pick scrolled out of view on a long script. */}
        <Text accessibilityLiveRegion="polite" style={[type.text.strong, tabular, { color: p.ink }]}>{t('setup.ofCount', { have: picks.length, of: bluffCount })}</Text>
        <Button label={t('board.showBluffsNow')} onPress={saveAndShow} surface="paper" disabled={picks.length === 0} style={styles.action}
          {...(showFirst ? { variant: 'primary' as const } : {})} />
        {/* Short, so Show fits beside it; the drawer's title already says what is saved. */}
        <Button label={t('common.save')} onPress={save} surface="paper" style={styles.action} {...(showFirst ? {} : { variant: 'primary' as const })} />
      </View>}>
      {choices.length === 0 ? <Text style={[type.text.body, styles.empty, { color: p.inkMuted }]}>{t('board.nothingMatches')}</Text> : null}
      <TokenKeys groups={groups} chosen={picks} full={picks.length >= bluffCount} onPress={(k) => setPicks(tapPick(picks, k.id as CharacterId))} />
    </Drawer>
  )
}

const styles = StyleSheet.create({
  bluffs: { flexShrink: 0, alignItems: 'center' },
  title: { color: palette.muted, maxWidth: '100%', textShadowColor: palette.felt, textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  bluffTokens: { flexDirection: 'row', alignSelf: 'flex-start', gap: space.xs, borderRadius: 999 },
  // The count keeps its place and the two buttons share the rest of the row. Where a long word
  // such as Enregistrer has no room beside the other, on the narrowest phone, it takes the next row.
  dock: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
  action: { flexGrow: 1 },
  empty: { paddingVertical: space.lg, textAlign: 'center' },
})
