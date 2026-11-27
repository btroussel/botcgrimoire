// Manual cards ask only for content they display. Opening one never writes to the game log.
import type { SeatId } from '../../engine'
import { useStore } from '../../store'
import { bluffsOf } from '../../store/bluffs'
import type { KeptNote } from '../../store/settings'
import { forgetNote, keepNote, sameNote } from '../../store/settings'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import type { CardNote, WrittenNote } from './Card'
import type { InfoTokenItem } from './InfoTokenList'
import { InfoTokenList } from './InfoTokenList'
import { Sheet } from '../../ui/Sheet'
import type { ShowChoice, ShowKind } from './show'
import { believed, notePresets, opening, seatStart, showTokens } from './show'
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

// Brings a card up as opening() decides, shown or ready to fill. The list and a seat's menu
// share it, so a card about a player comes up the same from either.
export const useOpenCard = () => {
  const e = useEdits()
  const interaction = useBoardInteraction()
  const open = (kind: ShowKind, choice: ShowChoice) => {
    if (!e.board) return
    const card = opening(e.board, kind, choice, e.t(labelKey[kind]), e.name)
    if (card) interaction.showCard(card.spec, card.editing)
  }
  const openSeat = (kind: ShowKind, seat: SeatId) => {
    if (e.board) open(kind, { seat, characters: seatStart(e.board, kind, seat) })
  }
  return { open, openSeat }
}

// A note's presets and its star. Kept notes live on this device beside the language, never in a
// game, so showing one still records nothing.
export const useCardNote = (): CardNote | undefined => {
  const store = useStore()
  const e = useEdits()
  const notes = store.settings.notes
  if (!e.board) return undefined
  const stored = (n: WrittenNote): KeptNote => ({ words: n.words, ...(n.character ? { character: n.character.id } : {}) })
  const kept = (n: WrittenNote) => notes.some((k) => sameNote(k, stored(n)))
  return {
    presets: notePresets(notes, e.board.script).map((n) => ({
      words: n.words, ...(n.character !== undefined ? { character: { id: n.character, name: e.name(n.character) } } : {}),
    })),
    kept,
    onKeep: (n) => store.setSettings({ notes: kept(n) ? forgetNote(notes, stored(n)) : keepNote(notes, stored(n)) }),
  }
}

export const ShowSheet = ({ visible, onClose, onBluffs }: ShowSheetProps) => {
  const e = useEdits()
  const interaction = useBoardInteraction()
  const { open, openSeat } = useOpenCard()
  const t = e.t
  const board = e.board

  // Always the same eight: a homebrew character's own card is offered on the note instead.
  const savedBluffs = board ? bluffsOf(board, e.log) : []
  const items: readonly InfoTokenItem[] = [...showTokens.map((x) => ({
    kind: x.kind,
    label: t(labelKey[x.kind]),
    ...(x.kind === 'notInPlay' ? { characters: savedBluffs } : {}),
  })), { kind: 'custom', label: t('board.customNote') }]

  const pickToken = (item: InfoTokenItem) => {
    if (item.kind === 'custom') {
      // The note is written on the card itself, where the player will read it.
      onClose()
      interaction.showCard({ kind: 'custom', words: '' }, true)
      return
    }
    const token = showTokens.find((x) => x.kind === item.kind)
    if (!token || !board) return
    onClose()
    if (token.about === 'seat') {
      // A seat without a token has nothing to start from, so it takes no tap. The seat's tap
      // brings the card up; the list has done its job. The toolbar names the card meanwhile.
      interaction.requestSeats({
        allowed: board.seats.filter(s => believed(board, s.id) !== undefined).map(s => s.id),
        title: t(labelKey[token.kind]),
        onDone: (seat) => openSeat(token.kind, seat as SeatId),
      })
    } else if (token.about === 'bluffs') {
      // One picker for one job: with none saved, the tray's picker chooses them and saves what
      // it shows, so the grimoire never forgets what a Demon saw.
      if (savedBluffs.length === 0) onBluffs()
      else open(token.kind, { characters: savedBluffs })
    } else open(token.kind, {})
  }
  return (
    <Sheet visible={visible} width={480} title={t('board.show')} onClose={onClose} closeLabel={t('common.close')} contentPaddingHorizontal={8}>
      <InfoTokenList items={items} onPick={pickToken} />
    </Sheet>
  )
}
