// What brings a card up. Manual cards ask only for content they display, and opening one never
// writes to the game log.
import type { SeatId } from '../../engine'
import { useStore } from '../../store'
import { bluffsOf } from '../../store/bluffs'
import type { KeptNote } from '../../store/settings'
import { forgetNote, keepNote, sameNote } from '../../store/settings'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import type { CardNote, WrittenNote } from './Card'
import type { ShowChoice, ShowKind } from './show'
import { notePresets, opening, seatStart, showTokens } from './show'
import { useEdits } from './useEdits'

// Each card's name, sentence case, which is also its words: the card writes them in capitals.
export const cardNameKey: Readonly<Record<ShowKind, string>> = {
  youAre: 'board.youAre',
  thisPlayerIs: 'board.cardThisPlayerIs',
  selectedYou: 'board.cardSelectedYou',
  thisIsTheDemon: 'board.cardThisIsTheDemon',
  theseAreYourMinions: 'board.cardTheseAreYourMinions',
  notInPlay: 'board.notInPlayWords',
}

// Brings a card up as opening() decides, shown or ready to fill: from a phrase on the blank card,
// or from a seat's menu for the two cards about its player.
export const useOpenCard = () => {
  const e = useEdits()
  const store = useStore()
  const interaction = useBoardInteraction()
  const open = (kind: ShowKind, choice: ShowChoice) => {
    if (!e.board) return
    // Written in capitals, as the printed info tokens are, so the editor shows what the player reads.
    const words = e.t(cardNameKey[kind]).toLocaleUpperCase(store.settings.locale)
    const card = opening(e.board, kind, choice, words, e.name)
    if (card) interaction.showCard(card.spec, card.editing)
  }
  const openSeat = (kind: ShowKind, seat: SeatId) => {
    if (e.board) open(kind, { seat, characters: seatStart(e.board, kind, seat) })
  }
  return { open, openSeat }
}

// What the blank card offers while it is empty, and its star. The official phrases each bring up
// their own card. Kept cards live on this device beside the language, never in a game, so showing
// one still records nothing.
export const useCardNote = (onBluffs: () => void): CardNote | undefined => {
  const store = useStore()
  const e = useEdits()
  const interaction = useBoardInteraction()
  const { open } = useOpenCard()
  const notes = store.settings.notes
  const board = e.board
  if (!board) return undefined
  const stored = (n: WrittenNote): KeptNote => ({ words: n.words, ...(n.characters.length > 0 ? { characters: n.characters.map((c) => c.id) } : {}) })
  const kept = (n: WrittenNote) => notes.some((k) => sameNote(k, stored(n)))
  const savedBluffs = bluffsOf(board, e.log)
  return {
    phrases: showTokens.map((token) => ({
      key: token.kind,
      label: e.t(cardNameKey[token.kind]),
      onPick: () => {
        // One picker for one job: with no bluffs saved, the tray's drawer chooses them and saves
        // what it shows, so the grimoire never forgets what a Demon saw.
        if (token.about === 'bluffs' && savedBluffs.length === 0) {
          interaction.closeCard()
          onBluffs()
        } else open(token.kind, token.about === 'bluffs' ? { characters: savedBluffs } : {})
      },
    })),
    presets: notePresets(notes, board.script).map((n) => ({
      words: n.words, characters: (n.characters ?? []).map((id) => ({ id, name: e.name(id) })),
    })),
    kept,
    onKeep: (n) => store.setSettings({ notes: kept(n) ? forgetNote(notes, stored(n)) : keepNote(notes, stored(n)) }),
  }
}
