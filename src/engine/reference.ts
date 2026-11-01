import type { Alignment, CharacterId, NightMarker, Script } from '../content'
import { character, characters, homebrewCharacter, isCustom, isEmptySeat, nightMarkers, scriptCharacters, scriptHomebrew, teamSide } from '../content'
import type { Grimoire, Seat } from './grimoire'
import type { SeatId } from './ids'

export interface PlayerIdentity {
  readonly character: CharacterId
  readonly alignment: Alignment
}

// A disguised player believes the side of what they were shown: a Lunatic shown the Imp thinks
// they are evil, so their true alignment would give the disguise away.
export const playerIdentity = (g: Grimoire, id: SeatId): PlayerIdentity | undefined => {
  const seat = g.seats.find(s => s.id === id)
  if (!seat || isEmptySeat(seat.shown ?? seat.character)) return undefined
  if (seat.shown) return { character: seat.shown, alignment: teamSide(character(seat.shown).team) ?? seat.alignment }
  // The same holds for a seat sitting as the token its player believes in, under the reminder of
  // who it really is: a Marionette sitting as the Chef thinks it is good. A side changed since
  // then is no longer that character's, and the player was told it.
  const disguised = markedCharacters(seat).some(real => real !== seat.character && teamSide(character(real).team) === seat.alignment)
  const believed = disguised ? teamSide(character(seat.character).team) : undefined
  return { character: seat.character, alignment: believed ?? seat.alignment }
}

// A global reminder such as Is The Drunk names who a seat really is while its token shows what
// the player believes, as in a paper grimoire. Only one that says so counts: Lil' Monsta's Is The
// Demon names its babysitter, but its Dead marks a victim.
export const markedCharacters = (seat: Seat): readonly CharacterId[] => seat.tokens.flatMap(({ def: [id, name] }) =>
  /^is the /i.test(name) && character(id as CharacterId).reminders.some(r => r.global && r.name === name) ? [id as CharacterId] : [])

export const inPlay = (g: Grimoire): readonly CharacterId[] => [...new Set([
  ...g.seats.flatMap(s => [s.character, ...markedCharacters(s), ...s.abilities.map(a => a.of)]),
  ...g.storyteller.abilities.map(a => a.of),
  ...g.loose,
].filter(id => !isEmptySeat(id)))]

export type SheetStep =
  | { readonly kind: 'marker'; readonly marker: NightMarker; readonly ordinal: number }
  | { readonly kind: 'character'; readonly character: CharacterId; readonly ordinal: number }

export const sheetOrder = (script: Script, night: 'first' | 'other'): readonly SheetStep[] => {
  const listed = isCustom(script) ? scriptCharacters(script) : [...characters.values()].filter(c => c.edition === script).map(c => c.id)
  const markers = Object.entries(nightMarkers[night]).map(([marker, ordinal]): SheetStep => ({ kind: 'marker', marker: marker as NightMarker, ordinal }))
  const own = new Map(scriptHomebrew(script).map((h) => [h.id, homebrewCharacter(h)]))
  const steps = [...new Set(listed)].flatMap((id): SheetStep[] => {
    const ordinal = (characters.get(id) ?? own.get(id) ?? character(id)).ordinals[night]
    return ordinal === undefined ? [] : [{ kind: 'character', character: id, ordinal }]
  })
  return [...markers, ...steps].sort((a, b) => a.ordinal - b.ordinal)
}
