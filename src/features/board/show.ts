// Manual cards only need the choices that affect their display. They produce no game events.
// Only You are speaks about a side: the side its player believes, read from the board. Every other
// card leaves each token in its team's colours, as the printed token is, so no card tells one
// player another's side. The Storyteller may change any card's characters, since a poisoned
// player can be shown a false one.
import type { CharacterId } from '../../content'
import type { Grimoire, SeatId } from '../../engine'
import { markedCharacters, playerIdentity, seatById } from '../../engine'
import type { CardKind, CardSpec } from '../../ui/BoardInteraction'

export type ShowKind = Exclude<CardKind, 'custom'>

export type ShowAbout = 'seat' | 'characters' | 'bluffs'

export interface ShowToken {
  readonly kind: ShowKind
  readonly about?: ShowAbout // omitted for fixed-text cards that open immediately
}

// The six info tokens the night sheet names, and the character tokens alone, which it asks for
// more often than any of them. The list shows them two by two, in this order.
export const showTokens: readonly ShowToken[] = [
  { kind: 'youAre', about: 'seat' },
  { kind: 'thisPlayerIs', about: 'seat' },
  { kind: 'tokenOnly', about: 'characters' },
  { kind: 'selectedYou', about: 'characters' },
  { kind: 'thisIsTheDemon' },
  { kind: 'theseAreYourMinions' },
  { kind: 'notInPlay', about: 'bluffs' },
]

// What the Storyteller picked: the seat a seat card is about, then the characters to print.
export interface ShowChoice {
  readonly seat?: SeatId | undefined
  readonly characters?: readonly string[]
}

// What a seat's player believes they are; none for a seat without a token, which takes no tap.
export const believed = (g: Grimoire, seat: SeatId): CharacterId | undefined => playerIdentity(g, seat)?.character

// What a seat card offers first. You are starts from what its player believes, so it cannot leak
// the true token. This player is tells someone else, and on a disguised seat neither token is a
// safe start: the Demon learns the real Marionette or Lunatic, but a Drunk's real token must never
// go out on a hasty tap. So it starts from nothing there.
export const seatStart = (g: Grimoire, kind: ShowKind, seat: SeatId): readonly CharacterId[] => {
  const shown = believed(g, seat)
  const record = seatById(g, seat)
  if (shown === undefined || !record) return []
  const real = markedCharacters(record)[0] ?? record.character
  return kind === 'thisPlayerIs' && real !== shown ? [] : [shown]
}

// Nothing comes back when a required seat or character is missing.
export const showing = (
  g: Grimoire,
  kind: ShowKind,
  choice: ShowChoice,
  words: string,
  name: (id: CharacterId) => string,
): CardSpec | undefined => {
  const ids = (choice.characters ?? []) as readonly CharacterId[]
  const characters = ids.map((id) => ({ id, name: name(id) }))
  switch (kind) {
    case 'youAre': {
      const identity = choice.seat !== undefined ? playerIdentity(g, choice.seat) : undefined
      if (!identity || ids.length === 0) return undefined
      return { kind, words, characters, tint: identity.alignment }
    }
    case 'thisPlayerIs': {
      // The ability tells a character, never a side: an evil Nightwatchman shown in red would
      // give their alignment away to the player they woke.
      const seat = choice.seat !== undefined ? seatById(g, choice.seat) : undefined
      if (!seat || !playerIdentity(g, seat.id) || ids.length === 0) return undefined
      return { kind, words, characters, caption: seat.name }
    }
    case 'thisIsTheDemon':
    case 'theseAreYourMinions':
      return { kind, words }
    case 'tokenOnly':
      // The tokens alone, as the night sheet shows a Washerwoman or an Undertaker their character.
      if (ids.length === 0) return undefined
      return { kind, words: '', characters }
    case 'selectedYou':
      if (ids.length === 0) return undefined
      return { kind, words, characters }
    case 'notInPlay':
      if (ids.length === 0) return undefined
      return { kind, words, characters, tint: 'good' }
  }
}
