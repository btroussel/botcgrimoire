import { useState } from 'react'

import type { CharacterId } from '../../content'
import { emptySeat, isEmptySeat } from '../../content'
import { Confirm } from '../../ui/Confirm'
import { EdgeButton } from '../../ui/EdgeButton'
import { Picker } from '../../ui/Picker'
import { palette } from '../../ui/theme'
import { edits, pickerGroups, roster } from './seat'
import { useEdits } from './useEdits'

export interface SeatDialogAction {
  readonly seatId: string
  readonly kind: 'character' | 'remove'
}

// These actions finish at the board, with no player-details screen underneath. A closing dialog
// keeps the seat it was opened for, so Empty seat can fade out after its seat has gone.
export const SeatActionDialog = ({ action, visible, onClose }: {
  readonly action: SeatDialogAction
  readonly visible: boolean
  readonly onClose: () => void
}) => {
  const e = useEdits()
  const found = e.board?.seats.find(candidate => candidate.id === action.seatId)
  const [kept, setKept] = useState(found)
  if (found && found !== kept) setKept(found)
  const seat = found ?? kept
  if (!seat || !e.board || e.lookingBack) return null
  if (action.kind === 'remove') return <Confirm visible={visible}
    title={e.t('board.removeSeatTitle', { name: seat.name })} message={e.t('board.removeSeatMessage')}
    confirmLabel={e.t('board.removeSeat')} cancelLabel={e.t('common.cancel')} danger
    onConfirm={() => { e.append(edits.removeSeat(seat.id)); onClose() }} onCancel={onClose} />

  const choose = (to: string) => { e.append(edits.setCharacter(seat.id, to as CharacterId)); onClose() }
  const empty = isEmptySeat(seat.character)
  return <Picker visible={visible} title={e.t('board.character')} onClose={onClose} closeLabel={e.t('common.close')}
    groups={pickerGroups(roster(e.board.script), e.teamLabel, palette.teamOnPaper,
      characterId => ({ id: characterId, character: characterId, name: e.name(characterId) }))}
    tokenGrid {...(!empty ? { selected: [seat.character] } : {})} onPick={choose}
    right={!empty ? <EdgeButton label={e.t('board.clearCharacter')} onPress={() => choose(emptySeat)} /> : null}
    emptyLabel={e.t('board.nothingMatches')} />
}
