// Immutable board edits shared by the manual reduction and the legacy one.
import type { Day, Grimoire, Seat, TokenInstance } from './grimoire'
import type { EventId, SeatId } from './ids'

export const patchSeat = (g: Grimoire, id: Seat['id'], patch: (seat: Seat) => Seat): Grimoire => ({
  ...g,
  seats: g.seats.map((s) => (s.id === id ? patch(s) : s)),
})

export const patchToday = (g: Grimoire, patch: (day: Day) => Day): Grimoire => {
  const last = g.days.length - 1
  if (last < 0) return g
  return { ...g, days: g.days.map((d, i) => (i === last ? patch(d) : d)) }
}

// A raised hand on today's nomination: the voter joins it and its total grows by the hand's weight.
export const raiseHand = (g: Grimoire, nomination: EventId, seat: SeatId, weight: number): Grimoire =>
  patchToday(g, (d) => ({
    ...d,
    nominations: d.nominations.map((n) =>
      n.opened === nomination ? { ...n, votes: [...n.votes, seat], weight: n.weight + weight } : n,
    ),
  }))

export const dropTokens = (g: Grimoire, keep: (t: TokenInstance) => boolean): Grimoire => ({
  ...g,
  seats: g.seats.map((s) => ({ ...s, tokens: s.tokens.filter(keep) })),
})
