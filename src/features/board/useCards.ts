// What brings a card up, and what the blank card offers. Manual cards ask only for content they
// display, and opening one never writes to the game log.
import { asCharacterId, scriptCards } from '../../content'
import type { CharacterId } from '../../content'
import type { SeatId } from '../../engine'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import type { CardPreset } from './Card'
import type { Phrase, SeatCard } from './show'
import { phrases, seatCard } from './show'
import { useEdits } from './useEdits'

// Each official card's name, sentence case, which is also its words.
const cardNameKey: Readonly<Record<SeatCard | Phrase, string>> = {
  youAre: 'board.youAre',
  thisPlayerIs: 'board.cardThisPlayerIs',
  selectedYou: 'board.cardSelectedYou',
  thisIsTheDemon: 'board.cardThisIsTheDemon',
  theseAreYourMinions: 'board.cardTheseAreYourMinions',
  notInPlay: 'board.notInPlayWords',
}

// An official card's words, in capitals as the printed info tokens are, so the Storyteller reads
// on the card what the player will.
export const useCardWords = () => {
  const e = useEdits()
  return (card: SeatCard | Phrase) => e.t(cardNameKey[card]).toLocaleUpperCase(e.locale)
}

// Brings up one of the two cards about a player, from that player's seat.
export const useOpenSeatCard = () => {
  const e = useEdits()
  const interaction = useBoardInteraction()
  const words = useCardWords()
  return (kind: SeatCard, seat: SeatId) => {
    const card = e.board ? seatCard(e.board, kind, seat, words(kind), e.name) : undefined
    if (card) interaction.showCard(card)
  }
}

// The answers a night asks for most, after tokens: a yes or a no, and a small count. A larger
// number is typed.
const counts = ['0', '1', '2', '3', '4', '5']

// What the blank card offers while it is empty: the one-tap answers in their rows, then the
// official phrases and the script's own character cards, one line each. Each is only written
// onto the card, where it can still be changed.
export const useCardOffers = (savedBluffs: readonly CharacterId[], onBluffs: () => void): { readonly answers: readonly (readonly CardPreset[])[]; readonly presets: readonly CardPreset[] } => {
  const e = useEdits()
  const interaction = useBoardInteraction()
  const words = useCardWords()
  const board = e.board
  if (!board) return { answers: [], presets: [] }
  const printed = (ids: readonly CharacterId[]) => ids.map((id) => ({ id, name: e.name(id) }))
  const answer = (label: string, written = label): CardPreset => ({ label, official: true, note: { words: written, characters: [] } })
  const answers = [
    ['board.cardYes', 'board.cardNo'].map((key) => answer(e.t(key), e.t(key).toLocaleUpperCase(e.locale))),
    counts.map((count) => answer(count)),
  ]
  const presets = [
    ...phrases.map((phrase): CardPreset => ({
      label: e.t(cardNameKey[phrase]),
      official: true,
      note: { words: words(phrase), characters: phrase === 'notInPlay' ? printed(savedBluffs) : [] },
      ...(phrase === 'selectedYou' ? { wantsToken: true } : {}),
      // One picker for one job: with no bluffs saved, the tray's drawer chooses them and saves
      // what it shows, so the grimoire never forgets what a Demon saw.
      ...(phrase === 'notInPlay' && savedBluffs.length === 0 ? { instead: () => { interaction.closeCard(); onBluffs() } } : {}),
    })),
    ...scriptCards(board.script).map((c): CardPreset => ({
      label: c.text, official: false, note: { words: c.text, characters: printed([asCharacterId(c.character)]) },
    })),
  ]
  return { answers, presets }
}
