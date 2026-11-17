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

// The recorded hands in the order the count reaches them: clockwise from the seat after the
// nominee, whose own hand closes the round. The Storyteller, who sits at no seat when an Atheist
// is nominated, starts the count at the first seat. A hand taken back drops out and the rest close up.
export const votingOrder = (seats: readonly string[], nominee: string, votes: readonly string[]): readonly string[] => {
  const start = seats.indexOf(nominee)
  const along = (seat: string) => (seats.indexOf(seat) - start + seats.length - 1) % seats.length
  return votes.filter(seat => seats.includes(seat)).sort((a, b) => along(a) - along(b))
}
