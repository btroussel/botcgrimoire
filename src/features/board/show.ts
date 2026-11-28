// Manual cards only need the choices that affect their display. They produce no game events.
// Every card is the one blank card with something written on it. Only You are speaks about a
// side: the side its player believes, read from the board. Every other card leaves each token in
// its team's colours, as the printed token is, so no card tells one player another's side. The
// Storyteller may change any card's characters, since a poisoned player can be shown a false one.
import type { CharacterId } from '../../content'
import type { Grimoire, SeatId } from '../../engine'
import { markedCharacters, playerIdentity, seatById } from '../../engine'
import type { CardSpec } from '../../ui/BoardInteraction'

// The two cards about one player, which start from that player's seat.
export type SeatCard = 'youAre' | 'thisPlayerIs'

// The info tokens the night sheet names that are about no seat, offered as phrases on the blank
// card in the order a first night uses them.
export const phrases = ['thisIsTheDemon', 'theseAreYourMinions', 'notInPlay', 'selectedYou'] as const
export type Phrase = typeof phrases[number]

// What a seat's player believes they are; none for a seat without a token, which takes no tap.
export const believed = (g: Grimoire, seat: SeatId): CharacterId | undefined => playerIdentity(g, seat)?.character

// What a seat card offers first. You are starts from what its player believes, so it cannot leak
// the true token. This player is tells someone else, and on a disguised seat neither token is a
// safe start: the Demon learns the real Marionette or Lunatic, but a Drunk's real token must never
// go out on a hasty tap. So it starts from nothing there.
export const seatStart = (g: Grimoire, kind: SeatCard, seat: SeatId): readonly CharacterId[] => {
  const shown = believed(g, seat)
  const record = seatById(g, seat)
  if (shown === undefined || !record) return []
  const real = markedCharacters(record)[0] ?? record.character
  return kind === 'thisPlayerIs' && real !== shown ? [] : [shown]
}

// A seat's card as it comes up: the words, the token it starts from, and what keeps it safe
// there, the side You are tells or the name under This player is. Nothing comes back for a seat
// without a token.
export const seatCard = (g: Grimoire, kind: SeatCard, seat: SeatId, words: string, name: (id: CharacterId) => string): CardSpec | undefined => {
  const identity = playerIdentity(g, seat)
  const record = seatById(g, seat)
  if (!identity || !record) return undefined
  const characters = seatStart(g, kind, seat).map((id) => ({ id, name: name(id) }))
  // This player is tells a character, never a side: an evil Nightwatchman shown in red would
  // give their alignment away to the player they woke.
  return kind === 'youAre' ? { words, characters, tint: identity.alignment } : { words, characters, caption: record.name }
}
