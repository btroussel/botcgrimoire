// The closed event set (docs/engine.md). The log is the saved state and every event is
// self-contained: an `info` carries what was told rather than pointing at a board field.
import type { Alignment, CharacterId, TokenRef } from '../content'
import type { EventId, SeatId } from './ids'

export type Phase = 'setup' | 'night' | 'day' | 'over'

// Who may see the event. The only viewer today is the Storyteller and the engine ignores the
// field, but a shared-board product later filters the log by it instead of rewriting it.
export type Audience = 'storyteller' | 'all' | readonly SeatId[]

export interface Envelope {
  readonly id: EventId
  readonly audience: Audience
  readonly recordedAt?: number // epoch milliseconds, absent on events saved before timing was added
  readonly batch?: EventId // first event of one accepted action, for undo and redo
  readonly decisionsHandled?: true // migrated history has no record of which prompts were completed
  readonly manual?: true // every new edit; events without it replay with the legacy reduction
}

// What a woken seat picked in an older guided night, one entry per pick, in order.
export type Picked =
  | { readonly kind: 'seat'; readonly seat: SeatId }
  | { readonly kind: 'seats'; readonly seats: readonly SeatId[] }
  | { readonly kind: 'character'; readonly character: CharacterId }
  | { readonly kind: 'characters'; readonly characters: readonly CharacterId[] }
  | { readonly kind: 'alignment'; readonly alignment: Alignment }
  | { readonly kind: 'yesNo'; readonly value: boolean }

// What the Storyteller showed a seat.
export type InfoValue =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'yesNo'; readonly value: boolean }
  | { readonly kind: 'player'; readonly seat: SeatId }
  | { readonly kind: 'players'; readonly seats: readonly SeatId[] }
  | { readonly kind: 'character'; readonly character: CharacterId }
  | { readonly kind: 'characters'; readonly characters: readonly CharacterId[] }
  | { readonly kind: 'alignment'; readonly alignment: Alignment }
  | { readonly kind: 'direction'; readonly value: 'clockwise' | 'counterclockwise' }
  | { readonly kind: 'oneOfTwo'; readonly seats: readonly [SeatId, SeatId]; readonly character: CharacterId }
  | { readonly kind: 'playerCharacter'; readonly seat: SeatId; readonly character: CharacterId }
  | { readonly kind: 'grimoire' }
  | { readonly kind: 'word'; readonly value: string }
  | { readonly kind: 'text'; readonly value: string }

// New deaths are the Storyteller's edits. The other causes are kept so older logs still read.
export type KillCause =
  | 'demon'
  | 'ability'
  | 'execution'
  | 'storyteller'
  | { readonly kind: 'character'; readonly of: CharacterId }
export type ExecuteCause = 'vote' | 'virgin' | 'vizier' | 'riot' | 'cerenovus' | 'mutant'

export type Payload =
  | { readonly kind: 'markForExecution'; readonly seat: SeatId | null }
  | { readonly kind: 'setVoteTotal'; readonly nomination: EventId; readonly total: number }
  | { readonly kind: 'cancelNomination'; readonly nomination: EventId }
  | { readonly kind: 'setGhostVote'; readonly seat: SeatId; readonly available: boolean }
  | { readonly kind: 'moveSeat'; readonly seat: SeatId; readonly to: number }
  | { readonly kind: 'endGame'; readonly winner?: Alignment; readonly note?: string }
  | { readonly kind: 'nightChecklist'; readonly entry: string; readonly status: 'done' | 'skipped' | 'pending'; readonly label?: string }
  | { readonly kind: 'resolveDecision'; readonly key: string; readonly note?: string }
  | { readonly kind: 'setBluffs'; readonly characters: readonly CharacterId[] }
  | { readonly kind: 'prepareInfo'; readonly seat: SeatId; readonly of: CharacterId; readonly value: InfoValue }
  | { readonly kind: 'phase'; readonly to: Phase; readonly night?: number }
  // Panel progress is undoable, but does not mean anyone woke or learned information. The
  // `step` marker carries the silent step it passed, which moves the cursor as a wake does.
  | {
      readonly kind: 'nightProgress'
      readonly marker: 'dusk' | 'minionInfo' | 'demonInfo' | 'dawn' | 'step'
      readonly seat?: SeatId
      readonly step?: number
    }
  | { readonly kind: 'wake'; readonly seat: SeatId; readonly step: number }
  // `of` names the ability the pick was made for, so a seat holding two picks, a Boffin's Monk
  // beside the Demon's own, keeps them apart. Absent on older ledgers, where the seat has to do.
  | { readonly kind: 'choice'; readonly seat: SeatId; readonly picks: readonly Picked[]; readonly of?: CharacterId }
  | {
      readonly kind: 'info'
      readonly to: readonly SeatId[]
      readonly told: InfoValue
      readonly truth: InfoValue
      readonly malfunctioned: boolean
    }
  | { readonly kind: 'dayAction'; readonly seat: SeatId; readonly of: CharacterId; readonly note?: string }
  | { readonly kind: 'kill'; readonly seat: SeatId; readonly cause: KillCause; readonly unstoppable?: boolean }
  | { readonly kind: 'execute'; readonly seat?: SeatId; readonly cause: ExecuteCause }
  | { readonly kind: 'exile'; readonly seat: SeatId }
  | { readonly kind: 'revive'; readonly seat: SeatId }
  // The Storyteller, who is not a seat, may nominate or be nominated. An exile is a Traveller's
  // ballot that anyone may call, so it names no caller and its `by` is the Storyteller.
  | { readonly kind: 'nominate'; readonly by: SeatId | 'storyteller'; readonly of: SeatId | 'storyteller'; readonly secret?: boolean; readonly exile?: true }
  // `free` is a hand that spent no ghost vote. Every new vote carries it, since a ghost vote is
  // spent by its own edit; in an older log, a dead hand without it spent one.
  | { readonly kind: 'vote'; readonly nomination: EventId; readonly seat: SeatId; readonly weight: number; readonly free?: boolean }
  | { readonly kind: 'unvote'; readonly nomination: EventId; readonly seat: SeatId; readonly weight: number; readonly restoreGhost?: true }
  | {
      readonly kind: 'placeToken'
      readonly seat: SeatId
      readonly token: TokenRef
      readonly source?: SeatId
      readonly note?: string
    }
  | { readonly kind: 'removeToken'; readonly placedBy: EventId }
  | { readonly kind: 'setNote'; readonly placedBy: EventId; readonly note: string }
  | {
      readonly kind: 'addSeat'
      readonly seat: SeatId
      readonly name: string
      readonly at: number
      readonly character: CharacterId
      readonly alignment: Alignment
    }
  | { readonly kind: 'removeSeat'; readonly seat: SeatId }
  | { readonly kind: 'renameSeat'; readonly seat: SeatId; readonly name: string }
  | { readonly kind: 'setCharacter'; readonly seat: SeatId; readonly to: CharacterId; readonly alignment?: Alignment }
  | { readonly kind: 'setShown'; readonly seat: SeatId; readonly to?: CharacterId }
  | { readonly kind: 'setAlignment'; readonly seat: SeatId; readonly to: Alignment }
  // In play and held by no seat: a Fabled, a Loric, or Lil' Monsta.
  | { readonly kind: 'addLoose'; readonly character: CharacterId }
  | { readonly kind: 'removeLoose'; readonly character: CharacterId }
  | { readonly kind: 'grant'; readonly seat: SeatId | 'storyteller'; readonly of: CharacterId; readonly source: SeatId | 'self' | 'storyteller' }
  | { readonly kind: 'revoke'; readonly grantedBy: EventId }
  | { readonly kind: 'override'; readonly note: string }

export type EventKind = Payload['kind']
export type Event = Envelope & Payload

// These explicit edits may be appended to any game, including older saved games.
export const isBoardEdit = (payload: { readonly kind: string }): boolean =>
  ['addSeat', 'removeSeat', 'renameSeat', 'setCharacter', 'setAlignment', 'kill', 'revive', 'placeToken', 'removeToken', 'setNote', 'setBluffs', 'setGhostVote', 'moveSeat', 'endGame', 'nightChecklist', 'phase', 'nightProgress', 'wake', 'nominate', 'cancelNomination', 'vote', 'unvote', 'setVoteTotal', 'markForExecution', 'execute', 'exile', 'setShown', 'addLoose', 'removeLoose', 'grant', 'revoke', 'override', 'info'].includes(payload.kind)

// The exhaustiveness check every fold over a closed set ends with.
export const unreachable = (x: never): never => {
  throw new Error(`unhandled ${JSON.stringify(x)}`)
}
