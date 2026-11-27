// Manual cards only need the choices that affect their display. They produce no game events.
// Only You are speaks about a side: the side its player believes, read from the board. Every other
// card leaves each token in its team's colours, as the printed token is, so no card tells one
// player another's side. The Storyteller may change any card's characters, since a poisoned
// player can be shown a false one.
import type { CharacterId, Team } from '../../content'
import type { Grimoire, SeatId } from '../../engine'
import { markedCharacters, playerIdentity, seatById } from '../../engine'
import type { CardKind, CardSpec } from '../../ui/BoardInteraction'
import { bluffChoices, byTeam, characterGroups, goodInPlay } from './seat'

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

// How many tokens a card takes: one for a card about one character, three bluffs, any number for
// the tokens alone, and none for a card of words. A written note keeps its own sheet for now.
export const takes = (kind: CardKind): number => {
  switch (kind) {
    case 'youAre':
    case 'thisPlayerIs':
    case 'selectedYou':
      return 1
    case 'notInPlay':
      return 3
    case 'tokenOnly':
      return Number.POSITIVE_INFINITY
    case 'thisIsTheDemon':
    case 'theseAreYourMinions':
    case 'custom':
      return 0
  }
}

export interface KeyGroup {
  readonly key: Team | 'inPlay'
  readonly ids: readonly CharacterId[]
}

// The keys a card is typed from, by team in the sheet's order with the Travellers last. The
// bluffs offer the good characters not in play, then those in play, since the night sheet shows
// a Lunatic any three good characters.
export const cardKeys = (g: Grimoire, kind: CardKind): readonly KeyGroup[] => {
  if (takes(kind) === 0) return []
  if (kind !== 'notInPlay') return characterGroups(g.script).map((group) => ({ key: group.team, ids: group.ids }))
  const playing = goodInPlay(g)
  return [...byTeam(bluffChoices(g)).map((group) => ({ key: group.team, ids: group.ids })),
    ...(playing.length > 0 ? [{ key: 'inPlay' as const, ids: playing }] : [])]
}

// A card before its tokens: the words, and for a seat card the side or the name it carries.
// Nothing comes back when a required seat is missing.
export const blank = (g: Grimoire, kind: ShowKind, seat: SeatId | undefined, words: string): CardSpec | undefined => {
  switch (kind) {
    case 'youAre': {
      const identity = seat !== undefined ? playerIdentity(g, seat) : undefined
      return identity ? { kind, words, characters: [], tint: identity.alignment } : undefined
    }
    case 'thisPlayerIs': {
      // The ability tells a character, never a side: an evil Nightwatchman shown in red would
      // give their alignment away to the player they woke.
      const record = seat !== undefined ? seatById(g, seat) : undefined
      return record && playerIdentity(g, record.id) ? { kind, words, characters: [], caption: record.name } : undefined
    }
    case 'thisIsTheDemon':
    case 'theseAreYourMinions':
      return { kind, words }
    case 'tokenOnly':
      // The tokens alone, as the night sheet shows a Washerwoman or an Undertaker their character.
      return { kind, words: '', characters: [] }
    case 'selectedYou':
      return { kind, words, characters: [] }
    case 'notInPlay':
      return { kind, words, characters: [], tint: 'good' }
  }
}

// The card with its tokens. Nothing comes back when a required seat or character is missing.
export const showing = (
  g: Grimoire,
  kind: ShowKind,
  choice: ShowChoice,
  words: string,
  name: (id: CharacterId) => string,
): CardSpec | undefined => {
  const base = blank(g, kind, choice.seat, words)
  if (!base || takes(kind) === 0) return base
  const ids = (choice.characters ?? []) as readonly CharacterId[]
  return ids.length > 0 ? { ...base, characters: ids.map((id) => ({ id, name: name(id) })) } : undefined
}

// How a card comes up: shown when its content is known, editing and empty when it is not.
export const opening = (
  g: Grimoire,
  kind: ShowKind,
  choice: ShowChoice,
  words: string,
  name: (id: CharacterId) => string,
): { readonly spec: CardSpec; readonly editing: boolean } | undefined => {
  const shown = showing(g, kind, choice, words, name)
  if (shown) return { spec: shown, editing: false }
  const empty = blank(g, kind, choice.seat, words)
  return empty ? { spec: empty, editing: true } : undefined
}
