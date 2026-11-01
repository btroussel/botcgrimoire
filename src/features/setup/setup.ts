import { character, emptySeat, isLoose, teamSide } from '../../content'
import type { Alignment, CharacterId, Team } from '../../content'
import { baseCounts, mintSeatId } from '../../engine'
import type { Payload, SeatId } from '../../engine'
import type { BagRole } from './randomBag'

// The Fabled and Loric a script lists, selected from the start since its author put them there.
export const scriptLoose = (roles: readonly BagRole[]): readonly CharacterId[] =>
  roles.filter(role => role.team === 'fabled' || role.team === 'loric').map(role => role.id)

export const seatedCharacters = (bag: readonly CharacterId[]): readonly CharacterId[] => bag.filter(id => !isLoose(id))

// Legion and Village Idiot are meant to repeat, so their count controls come with the first
// token. Any other seated character can repeat too, from a long press, and shows the controls
// once it has a second token, so a repeat is always seen and easy to undo.
const meantToRepeat: ReadonlySet<string> = new Set(['legion', 'villageidiot'])
export const showsCopies = (id: CharacterId, inBag: number): boolean =>
  inBag > 0 && !isLoose(id) && (inBag > 1 || meantToRepeat.has(id))

// The ordinary team counts the bag aims for, the same ones Shuffle deals: the base table up to
// fifteen, Travellers for each player past it. Below five no team has a target. Lil' Monsta
// sits outside the seats, so a selected one gives the Demon's seat to an extra Minion.
export const dealTarget = (count: number, bag: readonly CharacterId[] = []): Readonly<Partial<Record<Team, number>>> => {
  const base = baseCounts(Math.min(count, 15))
  if (!base) return {}
  const monsta = bag.some(id => id === 'lilmonsta') ? 1 : 0
  return { townsfolk: base.townsfolk, outsider: base.outsiders, minion: base.minions + monsta, demon: base.demon - monsta, ...(count > 15 ? { traveller: count - 15 } : {}) }
}

export const trimBag = (bag: readonly CharacterId[], count: number): readonly CharacterId[] => {
  let seats = 0
  return bag.filter(id => isLoose(id) || seats++ < count)
}

export const openingEvents = (names: readonly string[]): readonly Payload[] => names.map((name, at) => ({
  kind: 'addSeat', seat: mintSeatId(), name, at, character: emptySeat, alignment: 'good',
}))

// A loose character is never dealt to a seat, so it goes straight to the board, once.
export const looseEvents = (bag: readonly CharacterId[]): readonly Payload[] =>
  [...new Set(bag.filter(isLoose))].map((id): Payload => ({ kind: 'addLoose', character: id }))

// A dealt character starts on its team's side; a homebrew team comes from the script.
export const sideOf = (roles: readonly BagRole[] = []) => {
  const teams = new Map(roles.map(role => [role.id, role.team]))
  return (id: CharacterId): Alignment => teamSide(teams.get(id) ?? character(id).team) ?? 'good'
}

// A seat takes the side of the character it really is, which a disguise's token is not.
export const dealing = (roles: readonly BagRole[] = []) => {
  const side = sideOf(roles)
  return (seat: SeatId, to: CharacterId, really: CharacterId = to): Payload => ({ kind: 'setCharacter', seat, to, alignment: side(really) })
}
