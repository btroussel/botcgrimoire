import type { Event, EventId, Grimoire, Nomination, Payload, SeatId } from '../../engine'
import { recordedVoteWeight } from './votes'

// Restart an unconfirmed ballot without cancelling its nomination or spending ghost votes.
export const resetNominationVotes = (log: readonly Event[], nomination: Nomination): readonly Payload[] => [
  ...nomination.votes.map(seat => ({ kind: 'unvote' as const, nomination: nomination.opened, seat,
    weight: recordedVoteWeight(log, nomination.opened, seat) ?? 1 })),
  { kind: 'setVoteTotal', nomination: nomination.opened, total: 0 },
]

// Ending a vote records the final tally and ghost-token edits in one undo batch; Mark also puts
// the nominee on the block, Done leaves the marker where it is. An exile spends no ghost vote and
// marks no one. The tally identifies which nomination owns those edits after reload or replay.
export const nominationGhostVotes = (log: readonly Event[], nomination: EventId): ReadonlySet<SeatId> => {
  const confirmations = new Set(log.filter(e => e.kind === 'setVoteTotal' && e.nomination === nomination && e.batch !== undefined).map(e => e.batch))
  const spent = new Set<SeatId>()
  for (const event of log) {
    if (event.kind === 'setGhostVote') {
      if (!event.available && event.batch !== undefined && confirmations.has(event.batch)) spent.add(event.seat)
      else spent.delete(event.seat)
    } else if (event.kind === 'unvote' && event.restoreGhost) spent.delete(event.seat)
  }
  return spent
}

export const confirmNomination = (board: Grimoire, log: readonly Event[], nomination: Nomination,
  { mark = true }: { readonly mark?: boolean } = {}): readonly Payload[] => {
  const spent = nominationGhostVotes(log, nomination.opened)
  const ghostEdits: Payload[] = []
  for (const seat of board.seats) {
    if (spent.has(seat.id) && !nomination.votes.includes(seat.id)) ghostEdits.push({ kind: 'setGhostVote', seat: seat.id, available: true })
    else if (!nomination.exile && !seat.alive && seat.ghostVote && nomination.votes.includes(seat.id)) ghostEdits.push({ kind: 'setGhostVote', seat: seat.id, available: false })
  }
  return [
    { kind: 'setVoteTotal', nomination: nomination.opened, total: nomination.weight },
    ...ghostEdits,
    ...(!mark || nomination.exile || nomination.of === 'storyteller' ? [] : [{ kind: 'markForExecution' as const, seat: nomination.of }]),
  ]
}

export const cancelNomination = (log: readonly Event[], nomination: Nomination): readonly Payload[] => {
  const spent = nominationGhostVotes(log, nomination.opened)
  const marker = log.findLast(e => e.kind === 'markForExecution')
  const ownsMarker = marker?.batch !== undefined && log.some(e => e.batch === marker.batch && e.kind === 'setVoteTotal' && e.nomination === nomination.opened)
  return [
    ...[...spent].map(seat => ({ kind: 'setGhostVote' as const, seat, available: true })),
    ...(ownsMarker ? [{ kind: 'markForExecution' as const, seat: null }] : []),
    { kind: 'cancelNomination', nomination: nomination.opened },
  ]
}
