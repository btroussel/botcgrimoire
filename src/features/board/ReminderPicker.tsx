// Characters in play come first, then the notes already written this game, then the rest of
// the script. The notes row's plus hands the seat to the note window. A tap places and closes.
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { SeatId } from '../../engine'
import { AddSlot, ReminderChip } from '../../ui/ReminderChip'
import { font, palette, space } from '../../ui/theme'
import { Sheet } from '../../ui/Sheet'
import type { ReminderEntry } from './seat'
import { edits, reminderGroups, writtenNotes } from './seat'
import { useEdits } from './useEdits'

export interface ReminderPickerProps {
  readonly target: SeatId | undefined // none closes the sheet
  readonly onClose: () => void
  readonly onWriteNote: (seat: SeatId) => void // the plus: a new note in its own window
}

interface Shown {
  readonly key: string
  readonly label: string
  readonly character?: string // none for a note
  readonly a11y: string
  readonly onPress: () => void
}

export const ReminderPicker = ({ target, onClose, onWriteNote }: ReminderPickerProps) => {
  const e = useEdits()
  const p = palette
  // The sheet slides out after the target is cleared, so it keeps the last one it had.
  const [kept, setKept] = useState(target)
  if (target && target !== kept) setKept(target)
  const [gridWidth, setGridWidth] = useState(0)
  const columns = Math.max(1, Math.min(7, Math.floor((gridWidth + space.xs) / (48 + 3 * space.xs))))
  const tokenSize = gridWidth > 0 ? Math.max(44, Math.min(72, Math.floor((gridWidth - (columns - 1) * space.xs) / columns) - 2 * space.xs)) : 64
  const open = target !== undefined

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
    key: entry.key, label: entry.label, character: entry.character,
    a11y: `${entry.label}, ${entry.characterName}`, onPress: () => place(entry),
  }))
  const shown = [
    { key: 'inPlay', heading: e.t('board.inPlayGroup'), chips: reminderChips('inPlay') },
    { key: 'notes', heading: e.t('board.notesGroup'), chips: notes.map((text): Shown => ({
      key: `note/${text}`, label: text, a11y: e.t('board.placeWrittenNote', { note: text }), onPress: () => placeNote(text) })) },
    { key: 'notInPlay', heading: e.t('board.notInPlayGroup'), chips: reminderChips('notInPlay') },
  ].filter(group => group.key === 'notes' || group.chips.length > 0)

  return (
    <Sheet
      visible={open}
      title={e.t('board.reminderFor', { name: seat?.name ?? '' })}
      onClose={onClose}
      closeLabel={e.t('common.close')}
      width={640}
      contentPaddingHorizontal={space.md}
    >
      {shown.map(group => <View key={group.key} style={styles.group}>
        <View style={styles.groupHeading}>
          <span role="heading" aria-level={2} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontFamily: font.body.bold, fontSize: 13, lineHeight: '18px', color: p.inkMuted }}>
            {group.heading}
          </span>
        </View>
        <View style={styles.tokens} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
        {group.key === 'notes' ? <AddSlot size={tokenSize} label={e.t('board.writeNote')} onPress={() => { if (seatId !== undefined) onWriteNote(seatId) }} /> : null}
        {group.chips.map(chip => (
          <ReminderChip
            key={chip.key}
            size={tokenSize}
            label={chip.label}
            {...(chip.character !== undefined ? { character: chip.character } : {})}
            accessibilityLabel={chip.a11y}
            onPress={chip.onPress}
          />
        ))}
        </View>
      </View>)}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', gap: space.xs },
  groupHeading: { width: 28, minHeight: 80, alignItems: 'center', justifyContent: 'center', paddingVertical: space.xs, borderRightWidth: 1, borderRightColor: palette.parchmentShade },
  tokens: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
})
