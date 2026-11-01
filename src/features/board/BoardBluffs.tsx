import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { CharacterId } from '../../content'
import type { Grimoire } from '../../engine'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import type { PickerGroup } from '../../ui/Picker'
import { Picker } from '../../ui/Picker'
import { Token } from '../../ui/Token'
import { boardBlock, boardWell, palette, space, touch } from '../../ui/theme'
import { bluffChoices, edits, pickerGroups } from './seat'
import { useEdits } from './useEdits'

const bluffCount = 3

// The display and picker share one owner, so selecting bluffs stays separate from showing them.
export const BoardBluffs = ({ board, bluffs, boardWidth, clockWidth, canEdit }: {
  readonly board: Grimoire
  readonly bluffs: readonly CharacterId[]
  readonly boardWidth: number // the plaque shares the bottom edge from the far corner
  readonly clockWidth: number
  readonly canEdit: boolean
}) => {
  const e = useEdits()
  const interaction = useBoardInteraction()
  const t = e.t
  const p = palette
  const [bluffsOpen, setBluffsOpen] = useState(false)
  const bluffContentWidth = boardWidth - clockWidth - 2 * space.md - space.sm - 2 - 2 * space.xs
  const bluffSize = Math.max(touch, Math.min(60, bluffContentWidth / bluffCount))
  // Selection is saved separately from displaying the card.
  const bluffIds = bluffChoices(board)
  const bluffGroups: readonly PickerGroup[] = pickerGroups(bluffIds, e.teamLabel, p.teamOnPaper,
    (c) => ({ id: c, character: c, name: e.name(c) }))
  const setBluffs = (ids: readonly string[]) => {
    if (canEdit) e.append(edits.setBluffs(ids as readonly CharacterId[]))
    setBluffsOpen(false)
  }
  const showBluffs = () => {
    if (bluffs.length === 0) return
    interaction.showCard({
      kind: 'notInPlay',
      words: t('board.notInPlayWords'),
      characters: bluffs.map((c) => ({ id: c, name: e.name(c) })),
      tint: 'good',
    })
  }


  return <>
          <View style={[styles.bluffs, { width: bluffCount * bluffSize + 2 * space.xs + 2 }]} accessibilityLabel={t('board.bluffsTitle')} role="region">
            <View style={[boardBlock, styles.bluffTokens]}>
              {Array.from({ length: bluffCount }, (_, index) => {
                const c = bluffs[index]
                return <Token key={index} size={bluffSize} emptyStyle={boardWell}
                  {...(c ? { character: c, printName: true, name: e.name(c) } : {})}
                  alignment="good"
                  accessibilityLabel={c ? t('board.bluff', { name: e.name(c) }) : t('board.setBluffs')}
                  {...(canEdit ? { onPress: () => setBluffsOpen(true), ...(c ? { onLongPress: showBluffs } : {}) } : {})}
                />
              })}
            </View>
          </View>

        <Picker
          visible={bluffsOpen}
          title={t('board.bluffsTitle')}
          onClose={() => setBluffsOpen(false)}
          closeLabel={t('common.close')}
          groups={bluffGroups}
          selected={bluffs.filter(id => bluffIds.includes(id))}
          tokenGrid
          multi={{
            max: bluffCount,
            min: 0,
            shuffleLabel: t('board.shuffleBluffs'),
            confirmLabel: () => t('board.setBluffs'),
            onConfirm: setBluffs,
          }}
          emptyLabel={t('board.nothingMatches')}
        />
  </>
}
const styles = StyleSheet.create({
  bluffs: { flexShrink: 0, alignItems: 'center', gap: space.xs },
  bluffTokens: { flexDirection: 'row', alignSelf: 'flex-start', gap: space.xs, borderRadius: 999 },
})
