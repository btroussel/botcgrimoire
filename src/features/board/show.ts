// Manual cards only need the choices that affect their display. They produce no game events.
// A card about a seat starts from what its player believes, so it cannot leak the true token, and
// the Storyteller may change it, since a poisoned player can be shown a false character.
import type { CharacterId } from '../../content'
import type { Grimoire, SeatId } from '../../engine'
import { playerIdentity, seatById } from '../../engine'
import type { CardKind, CardSpec } from '../../ui/BoardInteraction'

export type ShowKind = Exclude<CardKind, 'custom'>

export type ShowAbout = 'seat' | 'characters' | 'bluffs'

export interface ShowToken {
  readonly kind: ShowKind
  readonly about?: ShowAbout // omitted for fixed-text cards that open immediately
}

// The official set in the order the list shows it.
export const showTokens: readonly ShowToken[] = [
  { kind: 'youAre', about: 'seat' },
  { kind: 'thisPlayerIs', about: 'seat' },
  { kind: 'youAreGood' },
  { kind: 'youAreEvil' },
  { kind: 'thisCharacterIs', about: 'characters' },
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

// The character a seat card offers first; none for a seat without a token.
export const believed = (g: Grimoire, seat: SeatId): CharacterId | undefined => playerIdentity(g, seat)?.character

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
    case 'youAre':
    case 'thisPlayerIs': {
      const seat = choice.seat !== undefined ? seatById(g, choice.seat) : undefined
      const identity = seat ? playerIdentity(g, seat.id) : undefined
      if (!seat || !identity || ids.length === 0) return undefined
      // YOU ARE tells the player their side too. THIS PLAYER IS keeps the seat's side only on the
      // seat's own character, since a false one in that colour would give the real side away.
      const own = kind === 'youAre' || (ids.length === 1 && ids[0] === identity.character)
      return { kind, words, characters, ...(own ? { tint: identity.alignment } : {}), ...(kind === 'thisPlayerIs' ? { caption: seat.name } : {}) }
    }
    case 'youAreGood':
    case 'youAreEvil':
    case 'thisIsTheDemon':
    case 'theseAreYourMinions':
      return { kind, words }
    case 'thisCharacterIs':
    case 'selectedYou':
      // No tint: each token keeps its own team's side, which several characters need not share.
      if (ids.length === 0) return undefined
      return { kind, words, characters }
    case 'notInPlay':
      if (ids.length === 0) return undefined
      return { kind, words, characters, tint: 'good' }
  }
}
