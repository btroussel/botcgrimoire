import { useState } from 'react'

import type { CharacterId } from '../../content'
import { emptySeat, isEmptySeat } from '../../content'
import { StyleSheet, View } from 'react-native'

import { Button } from '../../ui/Button'
import { Confirm } from '../../ui/Confirm'
import { Drawer, useOnOpen } from '../../ui/Drawer'
import { TokenKeys } from '../../ui/TokenKeys'
import { characterGroups, edits, seatSpan } from './seat'
import { useEdits } from './useEdits'

export interface SeatDialogAction {
  readonly seatId: string
  readonly kind: 'character' | 'remove'
}

// These actions finish at the board, with no player-details screen underneath. A closing dialog
// keeps the seat it was opened for, so Remove the seat can fade out after its seat has gone. The
// character comes up in a drawer that leaves the seat in view, from wherever it stood as it opened.
export const SeatActionDialog = ({ action, visible, onClose }: {
  readonly action: SeatDialogAction
  readonly visible: boolean
  readonly onClose: () => void
}) => {
  const e = useEdits()
  const found = e.board?.seats.find(candidate => candidate.id === action.seatId)
  const [kept, setKept] = useState(found)
  if (found && found !== kept) setKept(found)
  const [span, setSpan] = useState(() => seatSpan(action.seatId))
  useOnOpen(visible, () => setSpan(seatSpan(action.seatId)))
  const seat = found ?? kept
  if (!seat || !e.board || e.lookingBack) return null
  if (action.kind === 'remove') return <Confirm visible={visible}
    title={e.t('board.removeSeatTitle', { name: seat.name })} message={e.t('board.removeSeatMessage')}
    confirmLabel={e.t('board.removeSeat')} cancelLabel={e.t('common.cancel')} danger
    onConfirm={() => { e.append(edits.removeSeat(seat.id)); onClose() }} onCancel={onClose} />

  const choose = (to: string) => { e.append(edits.setCharacter(seat.id, to as CharacterId)); onClose() }
  const empty = isEmptySeat(seat.character)
  return <Drawer visible={visible} title={e.t('board.characterFor', { name: seat.name })} onClose={onClose} closeLabel={e.t('common.close')}
    {...(span ? { avoid: span } : {})}
    // At the foot, apart from the cross: it records an edit on one tap, and beside the cross a
    // tap meant to close the drawer emptied the seat.
    {...(!empty ? { dock: <View style={styles.clear}><Button variant="text" surface="paper" label={e.t('board.clearCharacter')} onPress={() => choose(emptySeat)} /></View> } : {})}>
    <TokenKeys groups={e.keyGroups(characterGroups(e.board.script))} chosen={empty ? [] : [seat.character]} onPress={k => choose(k.id)} />
  </Drawer>
}

const styles = StyleSheet.create({
  clear: { alignItems: 'flex-start' },
})
