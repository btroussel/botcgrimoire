// One window for a note's text: a new note written for a seat from the reminder picker's plus,
// or a placed note opened from its disc on the board, rewritten in place or taken off. The disc
// clips a long note, so this is where it reads in full.
// Reminders from characters have no text to edit, so their tap still removes them.
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { EventId, SeatId } from '../../engine'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { space } from '../../ui/theme'
import { edits } from './seat'
import { useEdits } from './useEdits'

export type NoteTarget =
  | { readonly kind: 'new'; readonly seat: SeatId }
  | { readonly kind: 'placed'; readonly placedBy: EventId }

export interface NoteEditorProps {
  readonly target: NoteTarget | undefined // none closes the sheet
  readonly onClose: () => void
}

export const NoteEditor = ({ target, onClose }: NoteEditorProps) => {
  const e = useEdits()
  const seats = e.board?.seats ?? []
  const found = target?.kind === 'new'
    ? seats.filter(seat => seat.id === target.seat).map(seat => ({ seat: seat.name, note: '', placed: false }))[0]
    : target?.kind === 'placed'
      ? seats.flatMap(seat => seat.tokens.filter(token => token.placedBy === target.placedBy && token.note !== undefined)
        .map(token => ({ seat: seat.name, note: token.note ?? '', placed: true })))[0]
      : undefined
  // The sheet fades out after the target is cleared or the note removed, so it keeps the last
  // seat and text it had.
  const [kept, setKept] = useState(found)
  if (found && (found.seat !== kept?.seat || found.note !== kept.note || found.placed !== kept.placed)) setKept(found)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(target)
  if (target !== editing) {
    setEditing(target)
    if (target !== undefined) setText(found?.note ?? '')
  }

  const open = target !== undefined && found !== undefined
  const placed = kept?.placed === true
  const ready = text.trim() !== '' && text.trim() !== kept?.note
  const save = () => {
    if (e.lookingBack || !target || !ready) return
    e.append(target.kind === 'new' ? edits.placeNote(text.trim(), target.seat) : edits.setNote(target.placedBy, text))
    onClose()
  }
  const remove = () => {
    if (e.lookingBack || target?.kind !== 'placed') return
    e.append(edits.removeToken(target.placedBy))
    onClose()
  }

  return (
    <Sheet visible={open} width={480} title={e.t('board.noteOn', { name: kept?.seat ?? '' })} onClose={onClose}
      closeLabel={e.t('common.close')}
      footer={<View style={styles.actions}>
        {placed ? <Button label={e.t('board.removeNote')} onPress={remove} variant="dangerText" surface="paper" /> : null}
        <Button label={e.t(placed ? 'board.saveNote' : 'board.placeNote')} onPress={save} disabled={!ready} variant="primary" surface="paper" />
      </View>}>
      <Field label={e.t('board.note')} value={text} onChange={setText} multiline lines={3} autoFocus />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
})
