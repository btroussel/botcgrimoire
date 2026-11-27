// Manual cards ask only for content they display. Opening one never writes to the game log.
import { useState } from 'react'

import type { CharacterId } from '../../content'
import { scriptCards } from '../../content'
import type { SeatId } from '../../engine'
import { bluffsOf } from '../../store/bluffs'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import type { InfoTokenItem } from './InfoTokenList'
import { InfoTokenList } from './InfoTokenList'
import { Sheet } from '../../ui/Sheet'
import type { ShowChoice, ShowKind } from './show'
import { believed, opening, seatStart, showTokens } from './show'
import { useEdits } from './useEdits'

export interface ShowSheetProps {
  readonly visible: boolean
  readonly onClose: () => void
  readonly onBluffs: () => void // the tray's own bluffs picker, for a not-in-play card with none saved
}

// Each card's name in the list, sentence case here, which is also the words the card sets
// uppercase. The tokens alone have a name and no words.
const labelKey: Readonly<Record<ShowKind, string>> = {
  youAre: 'board.youAre',
  thisPlayerIs: 'board.cardThisPlayerIs',
  tokenOnly: 'board.cardTokenOnly',
  selectedYou: 'board.cardSelectedYou',
  thisIsTheDemon: 'board.cardThisIsTheDemon',
  theseAreYourMinions: 'board.cardTheseAreYourMinions',
  notInPlay: 'board.notInPlayWords',
}

export const ShowSheet = ({ visible, onClose, onBluffs }: ShowSheetProps) => {
  const e = useEdits()
  const interaction = useBoardInteraction()
  const t = e.t
  const board = e.board
  const [note, setNote] = useState<string | undefined>(undefined) // the note step while set
  // The list comes back each time the sheet opens; the edge is read during render.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setNote(undefined)
  }

  const savedBluffs = board ? bluffsOf(board, e.log) : []
  const items: readonly InfoTokenItem[] = [...showTokens.map((x) => ({
    kind: x.kind,
    label: t(labelKey[x.kind]),
    ...(x.kind === 'notInPlay' ? { characters: savedBluffs } : {}),
  })), { kind: 'custom', label: t('board.customNote') },
  // A homebrew character's own card, written in its script, comes after the note and shows at once.
  ...(board ? scriptCards(board.script) : []).map((c): InfoTokenItem => ({
    kind: 'custom', key: `card/${c.character}/${c.text}`, label: c.text, characters: [c.character],
  }))]

  const open = (kind: ShowKind, choice: ShowChoice) => {
    if (!board) return
    const card = opening(board, kind, choice, t(labelKey[kind]), e.name)
    if (card) interaction.showCard(card.spec, card.editing)
  }
  const pickToken = (item: InfoTokenItem) => {
    if (item.kind === 'custom') {
      const own = item.characters?.[0] as CharacterId | undefined
      if (own === undefined) {
        setNote('')
        return
      }
      onClose()
      interaction.showCard({ kind: 'custom', words: item.label, characters: [{ id: own, name: e.name(own) }] })
      return
    }
    const token = showTokens.find((x) => x.kind === item.kind)
    if (!token || !board) return
    onClose()
    if (token.about === 'seat') {
      // A seat without a token has nothing to start from, so it takes no tap. The seat's tap
      // brings the card up; the list has done its job.
      interaction.requestSeats({
        allowed: board.seats.filter(s => believed(board, s.id) !== undefined).map(s => s.id),
        onDone: (seat) => open(token.kind, { seat: seat as SeatId, characters: seatStart(board, token.kind, seat as SeatId) }),
      })
    } else if (token.about === 'bluffs') {
      // One picker for one job: with none saved, the tray's picker chooses them and saves what
      // it shows, so the grimoire never forgets what a Demon saw.
      if (savedBluffs.length === 0) onBluffs()
      else open(token.kind, { characters: savedBluffs })
    } else open(token.kind, {})
  }
  const showNote = () => {
    if (!note?.trim()) return
    onClose()
    interaction.showCard({ kind: 'custom', words: note.trim() })
  }

  if (note !== undefined) return (
      <Sheet visible={visible} width={560} title={t('board.customNote')} onClose={onClose} closeLabel={t('common.close')}
        onBack={() => setNote(undefined)} backLabel={t('common.back')}
        footer={<Button label={t('board.showNote')} onPress={showNote} disabled={!note.trim()} variant="primary" surface="paper" />}>
        <Field label={t('board.noteMessage')} value={note} onChange={setNote} multiline autoFocus />
      </Sheet>
  )
  return (
    <Sheet visible={visible} width={480} title={t('board.show')} onClose={onClose} closeLabel={t('common.close')} contentPaddingHorizontal={8}>
      <InfoTokenList items={items} onPick={pickToken} />
    </Sheet>
  )
}
