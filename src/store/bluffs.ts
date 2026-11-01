import type { CharacterId } from '../content'
import { character } from '../content'
import type { Event, Grimoire } from '../engine'

// The order of the three bluffs does not change the selection.
export const sameBluffs = (a: readonly CharacterId[], b: readonly CharacterId[]): boolean =>
  a.length === b.length && new Set(a).size === new Set(b).size && a.every(id => b.includes(id))

export const bluffsOf = (g: Grimoire, log: readonly Event[]): readonly CharacterId[] => {
  const demon = g.seats.find((s) => character(s.character).team === 'demon')
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!
    if (e.kind === 'setBluffs') return e.characters
  }
  // Older games saved selection as a showing to the Demon.
  if (!demon) return []
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!
    if (e.kind !== 'info' || e.to.length !== 1 || e.to[0] !== demon.id) continue
    if (e.told.kind === 'characters') return e.told.characters
  }
  return []
}
