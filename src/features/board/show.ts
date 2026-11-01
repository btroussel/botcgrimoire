// Manual cards only need the choices that affect their display. They produce no game events.
// A disguised seat carries what its player believes, so a card cannot leak the true token.
import type { CharacterId } from '../../content'
import { character, isEmptySeat, teamSide } from '../../content'
import type { Grimoire, SeatId } from '../../engine'
import { playerIdentity, seatById } from '../../engine'
import type { CardKind, CardSpec } from '../../ui/BoardInteraction'

export type ShowKind = Exclude<CardKind, 'custom'>

export type ShowAbout = 'seat' | 'character' | 'characters'

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
  { kind: 'thisCharacterIs', about: 'character' },
  { kind: 'selectedYou', about: 'character' },
  { kind: 'thisIsTheDemon' },
  { kind: 'theseAreYourMinions' },
  { kind: 'notInPlay', about: 'characters' },
]

// Nothing comes back when a required seat or character is missing.
export const showing = (
  g: Grimoire,
  kind: ShowKind,
  about: readonly string[],
  words: string,
  name: (id: CharacterId) => string,
): CardSpec | undefined => {
  const one = about[0]
  const aboutSeat = one !== undefined ? seatById(g, one as SeatId) : undefined
  const characterIds = about as readonly CharacterId[]
  const printed = (ids: readonly CharacterId[]) => ids.map((id) => ({ id, name: name(id) }))
  switch (kind) {
    case 'youAre':
    case 'thisPlayerIs': {
      if (!aboutSeat || isEmptySeat(aboutSeat.shown ?? aboutSeat.character)) return undefined
      const identity = playerIdentity(g, aboutSeat.id)
      if (!identity) return undefined
      return { kind, words, characters: printed([identity.character]), tint: identity.alignment, ...(kind === 'thisPlayerIs' ? { caption: aboutSeat.name } : {}) }
    }
    case 'youAreGood':
    case 'youAreEvil':
    case 'thisIsTheDemon':
    case 'theseAreYourMinions':
      return { kind, words }
    case 'thisCharacterIs':
    case 'selectedYou': {
      const id = characterIds[0]
      if (id === undefined) return undefined
      const tint = teamSide(character(id).team)
      return { kind, words, characters: printed([id]), ...(tint ? { tint } : {}) }
    }
    case 'notInPlay':
      if (characterIds.length === 0) return undefined
      return { kind, words, characters: printed(characterIds), tint: 'good' }
  }
}
