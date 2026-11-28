// Characters in play come first, then the notes already written this game, then the rest of
// the script. The notes row's plus hands the seat to the note window. A tap places and closes.
import { useMemo, useState } from 'react'

import type { SeatId } from '../../engine'
import { Drawer, useOnOpen } from '../../ui/Drawer'
import { AddSlot, ReminderChip } from '../../ui/ReminderChip'
import { palette } from '../../ui/theme'
import { TokenKeys } from '../../ui/TokenKeys'
import type { TokenKeyGroup } from '../../ui/TokenKeys'
import type { ReminderEntry } from './seat'
import { edits, reminderGroups, seatSpan, writtenNotes } from './seat'
import { useEdits } from './useEdits'

export interface ReminderPickerProps {
  readonly target: SeatId | undefined // none closes the drawer
  readonly onClose: () => void
  readonly onWriteNote: (seat: SeatId) => void // the plus: a new note in its own window
}

interface Shown {
  readonly id: string
  readonly name: string // what a screen reader says
  readonly label: string // printed on the disc; empty for the plus
  readonly character?: string // none for a note
  readonly onPress: () => void
}

export const ReminderPicker = ({ target, onClose, onWriteNote }: ReminderPickerProps) => {
  const e = useEdits()
  // The drawer slides out after the target is cleared, so it keeps the last one it had, and where
  // that seat stood as it opened.
  const [kept, setKept] = useState(target)
  if (target && target !== kept) setKept(target)
  // Read on every opening, the same seat's included: the ring may have been laid out again since.
  const [span, setSpan] = useState<ReturnType<typeof seatSpan>>()
  useOnOpen(target !== undefined, () => setSpan(target ? seatSpan(target) : undefined))

  const board = e.board
  const seat = board?.seats.find((s) => s.id === kept)
  const seatId = seat?.id
  const groups = useMemo(() => (board ? reminderGroups(board, e.locale) : []), [board, e.locale])

  const place = (entry: ReminderEntry) => {
    if (e.lookingBack || !board || seatId === undefined) return
    e.append(edits.placeReminder(entry, seatId))
    onClose()
  }

  const placeNote = (text: string) => {
    if (e.lookingBack || text.trim() === '' || seatId === undefined) return
    e.append(edits.placeNote(text.trim(), seatId))
    onClose()
  }
  const notes = useMemo(() => writtenNotes(e.log), [e.log])

  const reminderChips = (key: string): readonly Shown[] => (groups.find(g => g.key === key)?.entries ?? []).map(entry => ({
    id: entry.key, label: entry.label, character: entry.character,
    name: `${entry.label}, ${entry.characterName}`, onPress: () => place(entry),
  }))
  const add: Shown = { id: 'add', name: e.t('board.writeNote'), label: '', onPress: () => { if (seatId !== undefined) onWriteNote(seatId) } }
  // The notes row always shows, since its plus is the way to a new note.
  const shown: readonly TokenKeyGroup<Shown>[] = [
    { key: 'inPlay', label: e.t('board.inPlayGroup'), color: palette.ink, keys: reminderChips('inPlay') },
    { key: 'notes', label: e.t('board.notesGroup'), color: palette.ink, keys: [add, ...notes.map((text): Shown => ({
      id: `note/${text}`, label: text, name: e.t('board.placeWrittenNote', { note: text }), onPress: () => placeNote(text) }))] },
    { key: 'notInPlay', label: e.t('board.notInPlayGroup'), color: palette.ink, keys: reminderChips('notInPlay') },
  ]

  return (
    <Drawer visible={target !== undefined} title={e.t('board.reminderFor', { name: seat?.name ?? '' })}
      onClose={onClose} closeLabel={e.t('common.close')} {...(span ? { avoid: span } : {})}>
      <TokenKeys groups={shown} chosen={[]} onPress={(chip) => chip.onPress()} render={(chip, size, press) => chip.id === add.id
        ? <AddSlot size={size} label={chip.name} onPress={press} />
        : <ReminderChip size={size} discHitArea label={chip.label} {...(chip.character !== undefined ? { character: chip.character } : {})}
          accessibilityLabel={chip.name} onPress={press} />} />
    </Drawer>
  )
}
