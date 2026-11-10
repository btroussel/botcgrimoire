// The cursor over the log (docs/store.md): append, undo, redo, look back, and the derived
// board. Every operation returns a new Session; writing it is the React binding's job.
import type { Locale, Script } from '../content'
import { seatName } from '../content'
import type { Event, Grimoire, Payload } from '../engine'
import { apply, asEventId, emptyGrimoire, isBoardEdit } from '../engine'
import { changeDayTimer, dayTimerAfterEvents } from './dayTimer'
import type { DayTimerAction } from './dayTimer'
import type { Draw } from './draw'
import type { SavedGame } from './saved'
import { bluffsOf, sameBluffs } from './bluffs'

export interface Session {
  readonly game: SavedGame
  readonly redo: readonly Event[] // reversed removed events, next to restore last; emptied by append
  readonly lookingAt?: number // when set, the board shows reduce(log.slice(0, lookingAt))
  // The bag the deal emptied and the log length it was dealt at. Like redo, it is not saved.
  readonly dealt?: { readonly at: number; readonly draw: Draw }
}

export const openSession = (game: SavedGame): Session => ({ game, redo: [] })

const isLookingBack = (s: Session): boolean => s.lookingAt !== undefined

const withLog = (s: Session, log: readonly Event[], now: number): SavedGame => {
  const { dayTimer, ...game } = s.game
  const changed = log.length < s.game.log.length ? s.game.log.slice(log.length) : log.slice(s.game.log.length)
  const timer = log.length < s.game.log.length && !changed.some(e => e.kind === 'phase' || e.kind === 'endGame')
    ? dayTimer : dayTimerAfterEvents(dayTimer, changed, now)
  return { ...game, log, updatedAt: now, ...(timer ? { dayTimer: timer } : {}) }
}

export const updateDayTimer = (s: Session, action: DayTimerAction, now: number): Session => {
  if (isLookingBack(s) || boardOf(s).clock.phase !== 'day') return s
  const { dayTimer, ...game } = s.game
  const next = changeDayTimer(dayTimer, action, now)
  return { ...s, game: { ...game, ...(next ? { dayTimer: next } : {}) } }
}

// The bag is set aside until the deal, so filling it or taking a token records no event.
export const setDraw = (s: Session, draw: Draw | undefined): Session => {
  if (isLookingBack(s)) return s
  const { draw: _old, ...game } = s.game
  return { ...s, game: { ...game, ...(draw ? { draw } : {}) } }
}

// One gesture is one undo step, including a deal or a vote with its ghost-vote marker.
export const appendAll = (s: Session, payloads: readonly Payload[], now: number): Session => {
  if (isLookingBack(s)) throw new Error('return to the present before appending')
  if (!payloads.every(isBoardEdit)) return s
  const from = s.game.log.length
  const recordedAt = Math.max(now, s.game.log.at(-1)?.recordedAt ?? 0)
  const events: Event[] = []
  const record = (p: Payload) => events.push({ id: asEventId(from + events.length), audience: 'storyteller', recordedAt, ...p, manual: true } as Event)
  for (const payload of payloads) {
    if (payload.kind === 'setBluffs') {
      const log = [...s.game.log, ...events]
      if (sameBluffs(payload.characters, bluffsOf(events.reduce(apply, boardOf(s)), log))) continue
    }
    record(payload)
  }
  if (events.length === 0) return s
  // A table opened with one seat is a batch too, which tells it from a seat added right after.
  if (events.length > 1 || (from === 0 && events[0]!.kind === 'addSeat')) {
    for (let i = 0; i < events.length; i++) events[i] = { ...events[i]!, batch: asEventId(from) }
  }
  // An action recorded where the deal was undone replaces it, so its bag is no longer owed.
  return { game: withLog(s, [...s.game.log, ...events], now), redo: [], ...(s.dealt && s.dealt.at < from ? { dealt: s.dealt } : {}) }
}

export const append = (s: Session, payload: Payload, now: number): Session =>
  appendAll(s, [payload], now)

// The deal's edits and the bag they empty are one action, so undoing the deal puts the bag back.
export const deal = (s: Session, payloads: readonly Payload[], now: number): Session => {
  const next = appendAll(s, payloads, now)
  const { draw, ...game } = next.game
  if (!draw) return next
  return next === s ? { ...s, game } : { ...next, game, dealt: { at: s.game.log.length, draw } }
}

// The redo stack stores a removed batch backwards. Contiguous equal ids identify its
// boundary in either direction, without grouping older events that have no batch id.
const lastGroupStart = (events: readonly Event[]): number => {
  let at = events.length - 1
  const batch = events[at]?.batch
  if (batch !== undefined) while (at > 0 && events[at - 1]?.batch === batch) at--
  return Math.max(0, at)
}

// Creating the table is a baseline, not a gameplay action. Older unbatched saves
// retain their opening run of seats; newer saves retain the whole initial deal batch.
export const canUndo = (s: Session): boolean => {
  const log = s.game.log
  if (isLookingBack(s) || log.length === 0) return false
  let floor = 0
  if (log[0]?.kind === 'addSeat') {
    const batch = log[0].batch
    while (floor < log.length && (batch === undefined ? log[floor]?.kind === 'addSeat' && log[floor]?.batch === undefined : log[floor]?.batch === batch)) floor++
  }
  return lastGroupStart(log) >= floor
}

// Refused while looking back or at the initial table.
export const undo = (s: Session, now: number): Session => {
  if (!canUndo(s)) return s
  const from = lastGroupStart(s.game.log)
  const removed = s.game.log.slice(from)
  const game = withLog(s, s.game.log.slice(0, from), now)
  const bag = s.dealt?.at === from ? { draw: s.dealt.draw } : {}
  return { ...s, game: { ...game, ...bag }, redo: [...s.redo, ...removed.reverse()] }
}

export const redo = (s: Session, now: number): Session => {
  if (isLookingBack(s) || s.redo.length === 0) return s
  const from = lastGroupStart(s.redo)
  const restored = s.redo.slice(from).reverse()
  const { draw, ...game } = withLog(s, [...s.game.log, ...restored], now)
  // Redoing the deal empties the bag again.
  const bag = draw && s.dealt?.at !== s.game.log.length ? { draw } : {}
  return { ...s, game: { ...game, ...bag }, redo: s.redo.slice(0, from) }
}

export const lookAt = (s: Session, n: number): Session => ({
  ...s,
  lookingAt: Math.max(0, Math.min(n, s.game.log.length)),
})

export const returnToPresent = (s: Session): Session => {
  const { lookingAt: _now, ...rest } = s
  return rest
}

// The board, derived from the log and the cursor, so no two screens can disagree. Reducing is a
// left fold, so a board already reduced over the same leading events is continued rather than
// recomputed: an append applies one event, and stepping a replay forward applies the step. A
// whole log keeps its board while the log lives; only the last cursor looked at keeps one, so
// scrubbing a replay holds one board rather than one per position.
interface Reduced {
  readonly script: Script
  readonly log: readonly Event[]
  readonly upTo: number
  readonly board: Grimoire
}
const whole = new WeakMap<readonly Event[], Reduced>()
let latest: Reduced | undefined // the last whole log reduced: the next append extends it
let looked: Reduced | undefined // the last cursor reduced

// Events are immutable, so a log holding the same objects in the same places has the same prefix.
const continues = (from: Reduced | undefined, script: Script, log: readonly Event[], upTo: number): from is Reduced => {
  if (!from || from.script !== script || from.upTo > upTo) return false
  if (from.log === log) return true
  for (let i = 0; i < from.upTo; i++) if (from.log[i] !== log[i]) return false
  return true
}

export const boardOf = (s: Session): Grimoire => {
  const { script, log } = s.game
  const upTo = s.lookingAt ?? log.length
  const atEnd = upTo === log.length
  const known = atEnd ? whole.get(log) : looked?.log === log && looked.upTo === upTo ? looked : undefined
  if (known) return known.board
  let from: Reduced | undefined
  for (const candidate of [latest, looked]) {
    if (continues(candidate, script, log, upTo) && candidate.upTo > (from?.upTo ?? -1)) from = candidate
  }
  let board = from?.board ?? emptyGrimoire(script)
  for (let i = from?.upTo ?? 0; i < upTo; i++) board = apply(board, log[i]!)
  const reduced = { script, log, upTo, board }
  if (atEnd) {
    whole.set(log, reduced)
    latest = reduced
  } else looked = reduced
  return board
}

// The board as a screen shows it, with default seat names in the UI locale.
export const inLocale = (board: Grimoire, locale: Locale): Grimoire => {
  const seats = board.seats.map((seat) => {
    const name = seatName(locale, seat.name)
    return name === seat.name ? seat : { ...seat, name }
  })
  return seats.every((seat, i) => seat === board.seats[i]) ? board : { ...board, seats }
}
