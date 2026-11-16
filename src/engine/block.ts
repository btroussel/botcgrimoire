import type { Day, Grimoire } from './grimoire'
import { today } from './grimoire'
import type { EventId, SeatId } from './ids'

// Half the living players rounded up, and at least one, so zero votes never reach it.
const halfAlive = (g: Grimoire): number => Math.max(1, Math.ceil(g.seats.filter(seat => seat.alive).length / 2))

// Exiles are their own count: they neither set nor reach the execution's target.
const executions = (day: Day | undefined) => day?.nominations.filter(nomination => !nomination.exile) ?? []

// The active nomination is excluded so its changing tally cannot raise its own target.
export const nominationThresholds = (g: Grimoire, excluding?: EventId): { readonly execute: number; readonly tie?: number } => {
  const minimum = halfAlive(g)
  const previous = executions(today(g)).filter(nomination => nomination.opened !== excluding)
  const highest = Math.max(0, ...previous.map(nomination => nomination.weight))
  return { execute: Math.max(minimum, highest + 1), ...(highest >= minimum ? { tie: highest } : {}) }
}

// Every hand counts toward an exile, the dead's too, against half the living.
export const exileThreshold = halfAlive

// A reference for ordinary voting, never an execution or a life-state edit.
export const onTheBlock = (g: Grimoire): SeatId | undefined => {
  const day = today(g)
  if (g.clock.phase !== 'day' || !day || day.closed) return undefined
  if (day.markedForExecution !== undefined) return g.seats.find(seat => seat.id === day.markedForExecution)?.id
  const nominations = executions(day)
  const highest = Math.max(0, ...nominations.map(nomination => nomination.weight))
  if (highest < halfAlive(g)) return undefined
  const leaders = nominations.filter(nomination => nomination.weight === highest)
  const nominee = leaders.length === 1 ? leaders[0]?.of : undefined
  return g.seats.find(seat => seat.id === nominee)?.id
}
