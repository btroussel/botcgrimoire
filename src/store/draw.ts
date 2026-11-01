// The bag the players draw from (docs/store.md): its tokens face down in the order they lie,
// each with the seat that took it. It sits beside the log, not in it, because nothing reaches
// the board until the Storyteller deals.
import type { CharacterId } from '../content'
import type { SeatId } from '../engine'

export interface DrawToken {
  readonly character: CharacterId
  readonly shown?: CharacterId // what a Drunk, Lunatic or Marionette sees when they draw it
  readonly chosen?: true // the Storyteller chose `shown`, rather than the bag at random
  readonly seat?: SeatId // the player who took it
}

export interface Draw {
  readonly tokens: readonly DrawToken[]
}

export const isDraw = (value: unknown): value is Draw => {
  if (!value || typeof value !== 'object') return false
  const tokens = (value as Record<string, unknown>).tokens
  if (!Array.isArray(tokens) || tokens.length < 1 || tokens.length > 20) return false
  const seats = new Set<unknown>()
  return tokens.every((token: unknown) => {
    if (!token || typeof token !== 'object') return false
    const { character, shown, chosen, seat } = token as Record<string, unknown>
    if (typeof character !== 'string' || character === '') return false
    if (shown !== undefined && (typeof shown !== 'string' || shown === '')) return false
    if (chosen !== undefined && (chosen !== true || shown === undefined)) return false
    if (seat === undefined) return true
    if (typeof seat !== 'string' || seat === '' || seats.has(seat)) return false
    seats.add(seat)
    return true
  })
}
