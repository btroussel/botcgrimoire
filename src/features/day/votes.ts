import type { EventId, Payload, SeatId } from '../../engine'

// Correct the recorded hand, including weights saved by older versions, without
// recalculating what that player's character would contribute now.
export const recordedVoteWeight = (log: readonly Payload[], nomination: EventId, seat: SeatId): number | undefined => {
  for (let i = log.length - 1; i >= 0; i--) {
    const event = log[i]!
    if ((event.kind === 'vote' || event.kind === 'unvote') && event.nomination === nomination && event.seat === seat) {
      return event.kind === 'vote' ? event.weight : undefined
    }
  }
  return undefined
}

// How far round the count has come: the recorded hand furthest clockwise from the nominee, whose
// own hand closes the round. Taking back a hand to fix a mistake leaves the others where they are.
export const furthestHand = (seats: readonly string[], nominee: string, votes: readonly string[]): string | undefined => {
  const start = seats.indexOf(nominee)
  if (start < 0) return undefined
  const along = (seat: string) => (seats.indexOf(seat) - start + seats.length - 1) % seats.length
  return votes.filter(seat => seats.includes(seat)).reduce<string | undefined>(
    (best, seat) => best === undefined || along(seat) > along(best) ? seat : best, undefined)
}
