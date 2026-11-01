// What is shown: the board rebuilt from the log (docs/model.md). None of it is ever saved.
import type { Alignment, CharacterId, Script, TokenRef } from '../content'
import type { Phase } from './events'
import type { EventId, SeatId } from './ids'

export interface Grant {
  readonly of: CharacterId
  readonly source: SeatId | 'self' | 'storyteller'
  readonly grantedBy: EventId
}

export interface TokenInstance {
  readonly def: TokenRef
  readonly source?: SeatId
  readonly note?: string
  readonly placedBy: EventId
}

// A Storyteller's note is a token with no character behind it and its text in `note`; either
// 'note' or an empty id marks it. A reminder carrying text, such as the Cerenovus's character,
// keeps its character and is no note.
export const noteToken: TokenRef = ['note', '']
export const isNote = (def: TokenRef, note: string | undefined): boolean =>
  note !== undefined && (def[0] === 'note' || def[0] === '')

export interface Seat {
  readonly id: SeatId
  readonly name: string
  readonly character: CharacterId // the token actually in the grimoire
  readonly shown?: CharacterId // Drunk, Lunatic, Marionette: what the player believes
  readonly abilities: readonly Grant[] // Philosopher, Alchemist, Cannibal, Hermit, Boffin
  readonly alignment: Alignment // may diverge from the character's team
  readonly alive: boolean
  readonly ghostVote: boolean
  readonly tokens: readonly TokenInstance[]
}

export interface Nomination {
  readonly opened: EventId
  readonly by: SeatId | 'storyteller' // the Storyteller with a Bishop at the table
  readonly of: SeatId | 'storyteller' // the Storyteller with an Atheist at the table
  readonly votes: readonly SeatId[] // clockwise from the nominee, as raised
  readonly weight: number
}

export interface Day {
  readonly nominations: readonly Nomination[]
  readonly markedForExecution?: SeatId | null // absent retains the historical vote-derived marker
  readonly closed: boolean
}

export interface Clock {
  readonly night: number
  readonly phase: Phase
}

export interface Grimoire {
  readonly result?: { readonly winner?: Alignment; readonly note?: string }
  readonly script: Script
  readonly seats: readonly Seat[] // clockwise, index is position
  readonly loose: readonly CharacterId[] // in play but held by no seat: Fabled, Loric, Lil' Monsta
  readonly storyteller: { readonly abilities: readonly Grant[] }
  readonly clock: Clock
  readonly days: readonly Day[] // one per day, never cleared; today is the last
}

export const seatById = (g: Grimoire, id: SeatId): Seat | undefined => g.seats.find((s) => s.id === id)

export const today = (g: Grimoire): Day | undefined => g.days[g.days.length - 1]
