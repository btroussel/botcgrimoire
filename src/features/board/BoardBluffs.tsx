import { StyleSheet, Text, View } from 'react-native'
import type { CharacterId } from '../../content'
import type { Grimoire } from '../../engine'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import type { PickerGroup } from '../../ui/Picker'
import { Picker } from '../../ui/Picker'
import { Token } from '../../ui/Token'
import { boardBlock, boardWell, palette, space, touch, type } from '../../ui/theme'
import { bluffChoices, edits, pickerGroups } from './seat'
import { useEdits } from './useEdits'

const bluffCount = 3

// The not-in-play card the tray and its picker show: the bluffs, in the good side's colours.
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

// The tray's wells open the picker the board owns, since a not-in-play card with no bluffs saved
// opens the same picker, and a small game shows no tray.
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

// Selecting bluffs stays separate from showing them, but the picker also shows them: the
// Storyteller often chooses at the Demon's wake and shows at once, and once chosen they are shown
// far more often than changed.
export const BluffPicker = ({ board, bluffs, canEdit, visible, onClose }: {
  readonly board: Grimoire
  readonly bluffs: readonly CharacterId[]
  readonly canEdit: boolean
  readonly visible: boolean
  readonly onClose: () => void
}) => {
  const e = useEdits()
  const t = e.t
  const showBluffs = useShowBluffs()
  const bluffIds = bluffChoices(board)
  const bluffGroups: readonly PickerGroup[] = pickerGroups(bluffIds, e.teamLabel, palette.teamOnPaper,
    (c) => ({ id: c, character: c, name: e.name(c) }))
  const setBluffs = (ids: readonly string[]) => {
    if (canEdit) e.append(edits.setBluffs(ids as readonly CharacterId[]))
    onClose()
  }
  // Showing from the picker saves the set first, so the tray and the log hold what the Demon saw.
  const setAndShow = (ids: readonly string[]) => {
    const next = ids as readonly CharacterId[]
    const same = next.length === bluffs.length && next.every((id, i) => id === bluffs[i])
    if (canEdit && !same) e.append(edits.setBluffs(next))
    onClose()
    showBluffs(next)
  }
  return (
        <Picker
          visible={visible}
          title={t('board.bluffsTitle')}
          onClose={onClose}
          closeLabel={t('common.close')}
          groups={bluffGroups}
          selected={bluffs.filter(id => bluffIds.includes(id))}
          tokenGrid
          multi={{
            max: bluffCount,
            min: 0,
            shuffleLabel: t('board.shuffleBluffs'),
            // Short, so Show fits beside it; the sheet's title already says what is saved.
            confirmLabel: () => t('common.save'),
            onConfirm: setBluffs,
            also: { label: t('board.showBluffsNow'), onConfirm: setAndShow },
          }}
          emptyLabel={t('board.nothingMatches')}
        />
  )
}
const styles = StyleSheet.create({
  bluffs: { flexShrink: 0, alignItems: 'center' },
  title: { color: palette.muted, maxWidth: '100%', textShadowColor: palette.felt, textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  bluffTokens: { flexDirection: 'row', alignSelf: 'flex-start', gap: space.xs, borderRadius: 999 },
})
