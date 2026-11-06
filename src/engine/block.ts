import type { Grimoire } from './grimoire'
import { today } from './grimoire'
import type { EventId, SeatId } from './ids'

// Half the living players rounded up, and at least one, so zero votes never reach it.
const halfAlive = (g: Grimoire): number => Math.max(1, Math.ceil(g.seats.filter(seat => seat.alive).length / 2))

// The active nomination is excluded so its changing tally cannot raise its own target.
export const nominationThresholds = (g: Grimoire, excluding?: EventId): { readonly execute: number; readonly tie?: number } => {
  const minimum = halfAlive(g)
  const previous = today(g)?.nominations.filter(nomination => nomination.opened !== excluding) ?? []
  const highest = Math.max(0, ...previous.map(nomination => nomination.weight))
  return { execute: Math.max(minimum, highest + 1), ...(highest >= minimum ? { tie: highest } : {}) }
}

// A reference for ordinary voting, never an execution or a life-state edit.
export const onTheBlock = (g: Grimoire): SeatId | undefined => {
  const day = today(g)
  if (g.clock.phase !== 'day' || !day || day.closed) return undefined
  if (day.markedForExecution !== undefined) return g.seats.find(seat => seat.id === day.markedForExecution)?.id
  const highest = Math.max(0, ...day.nominations.map(nomination => nomination.weight))
  if (highest < halfAlive(g)) return undefined
  const leaders = day.nominations.filter(nomination => nomination.weight === highest)
  const nominee = leaders.length === 1 ? leaders[0]?.of : undefined
  return g.seats.find(seat => seat.id === nominee)?.id
}
