// The board builder every engine test uses. It produces events, not a board, and reduces them,
// so every scenario runs through the reducer. Seats are named, and every helper takes names so
// a test reads as the story of a night. Events are manual edits, as the app records them, unless
// the game is built as a legacy one to replay a log saved before manual edits.
import type { Alignment, CharacterId, Script, TokenRef } from '../../content'
import { asCharacterId, character, teamSide } from '../../content'
import type { Event, InfoValue, KillCause, Payload, Picked } from '../events'
import { unreachable } from '../events'
import type { Grimoire } from '../grimoire'
import type { EventId, SeatId } from '../ids'
import { asEventId, asSeatId } from '../ids'
import { reduce } from '../reduce'

// What a step may read while it is resolved: the payloads before it, so it can point at an
// earlier event by its index, and a way to name a seat it adds itself.
export interface StepContext {
  readonly log: readonly Payload[]
  readonly newSeat: (name: string) => SeatId
}

// A step in a scenario, resolved against the seats by name when the board is built.
export type Step = (id: (name: string) => SeatId, ctx: StepContext) => Payload

export interface Board {
  readonly g: Grimoire
  readonly log: readonly Event[]
  readonly id: (name: string) => SeatId
}

const envelope = (payloads: readonly Payload[], legacy: boolean): Event[] =>
  payloads.map((p, i) => ({ id: asEventId(i), audience: 'storyteller', ...(legacy ? {} : { manual: true }), ...p }))

class Builder {
  private readonly payloads: Payload[] = []
  private readonly seats = new Map<string, SeatId>()

  constructor(private readonly script: Script, private readonly legacy: boolean) {}

  readonly id = (name: string): SeatId => {
    const id = this.seats.get(name)
    if (!id) throw new Error(`no seat named ${name}`)
    return id
  }

  private readonly newSeat = (name: string): SeatId => {
    const seat = asSeatId(`seat-${name.toLowerCase()}`)
    this.seats.set(name, seat)
    return seat
  }

  // A seat at the end of the ring. Alignment follows the character's team unless given.
  seat(name: string, id: string, opts: { alignment?: Alignment; shown?: string } = {}): this {
    const seat = this.newSeat(name)
    const c = character(asCharacterId(id))
    this.payloads.push({
      kind: 'addSeat',
      seat,
      name,
      at: this.seats.size - 1,
      character: c.id,
      alignment: opts.alignment ?? teamSide(c.team) ?? 'good',
    })
    if (opts.shown) this.payloads.push({ kind: 'setShown', seat, to: asCharacterId(opts.shown) })
    return this
  }

  add(...steps: readonly Step[]): this {
    for (const s of steps) this.payloads.push(s(this.id, { log: this.payloads, newSeat: this.newSeat }))
    return this
  }

  night(n: number, steps: readonly Step[] = []): this {
    this.payloads.push({ kind: 'phase', to: 'night', night: n })
    return this.add(...steps)
  }

  day(steps: readonly Step[] = []): this {
    this.payloads.push({ kind: 'phase', to: 'day' })
    return this.add(...steps)
  }

  build(): Board {
    const log = envelope(this.payloads, this.legacy)
    return { g: reduce(this.script, log), log, id: this.id }
  }
}

export const game = (script: Script = 'tb', { legacy = false }: { legacy?: boolean } = {}) => new Builder(script, legacy)

// Steps. Each returns the payload for a name resolver.
export const choice = (who: string, ...targets: readonly string[]): Step => (id) => ({
  kind: 'choice',
  seat: id(who),
  picks: targets.map((t): Picked => ({ kind: 'seat', seat: id(t) })),
})

export const wake = (who: string, step: number): Step => (id) => ({ kind: 'wake', seat: id(who), step })

// A step the sheet lists and nobody is woken at: the night moves on with no wake recorded.
export const silentStep = (who: string, step: number): Step => (id) => ({ kind: 'nightProgress', marker: 'step', seat: id(who), step })

export const kill = (who: string, cause: KillCause = 'demon'): Step => (id) => ({ kind: 'kill', seat: id(who), cause })

export const execute = (who: string): Step => (id) => ({ kind: 'execute', seat: id(who), cause: 'vote' })

export const revive = (who: string): Step => (id) => ({ kind: 'revive', seat: id(who) })

// A reminder token: `token('Bob', 'poisoner/Poisoned', 'Cat')` is Bob's Poisoner poisoning Cat.
// 'storyteller' as the placer means no source, as for a global token dealt from the bag.
export const token = (by: string, def: string, on: string, note?: string): Step => (id) => ({
  kind: 'placeToken',
  seat: id(on),
  token: tokenRef(def),
  ...(by !== 'storyteller' ? { source: id(by) } : {}),
  ...(note !== undefined ? { note } : {}),
})

// Removes the last token of that kind placed on the seat.
export const removeToken = (on: string, def: string): Step => (id, ctx) => {
  const ref = tokenRef(def)
  const seat = id(on)
  const at = findLast(
    ctx.log,
    (p) => p.kind === 'placeToken' && p.seat === seat && p.token[0] === ref[0] && p.token[1] === ref[1],
  )
  if (at === undefined) throw new Error(`no ${def} token on ${on} to remove`)
  return { kind: 'removeToken', placedBy: at }
}

export const setCharacter = (who: string, to: string, alignment?: Alignment): Step => (id) => ({
  kind: 'setCharacter',
  seat: id(who),
  to: asCharacterId(to),
  ...(alignment !== undefined ? { alignment } : {}),
})

// Clears what the seat believes when `to` is omitted.
export const setShown = (who: string, to?: string): Step => (id) => ({
  kind: 'setShown',
  seat: id(who),
  ...(to !== undefined ? { to: asCharacterId(to) } : {}),
})

export const setAlignment = (who: string, to: Alignment): Step => (id) => ({ kind: 'setAlignment', seat: id(who), to })

// An ability granted to a seat, or to 'storyteller'. The source is the seat it came from,
// 'self' when the holder's own character grants it (Philosopher), 'storyteller' otherwise.
export const grant = (to: string, of: string, source: string = 'self'): Step => (id) => ({
  kind: 'grant',
  seat: to === 'storyteller' ? 'storyteller' : id(to),
  of: asCharacterId(of),
  source: source === 'self' || source === 'storyteller' ? source : id(source),
})

export const nominate = (by: string, of: string): Step => (id) => ({ kind: 'nominate', by: id(by), of: id(of) })

// A vote on the last nomination of that nominee, or on the last nomination opened when no
// nominee is named. `free` is a hand that spends no ghost vote.
export const vote = (who: string, of?: string, weight = 1, free = false): Step => (id, ctx) => {
  const nominee = of === undefined ? undefined : id(of)
  const nomination = findLast(ctx.log, (p) => p.kind === 'nominate' && (nominee === undefined || p.of === nominee))
  if (nomination === undefined) throw new Error(`no nomination of ${of ?? 'anyone'} to vote on`)
  return { kind: 'vote', nomination, seat: id(who), weight, ...(free ? { free: true } : {}) }
}

// The Storyteller's nomination, with a Bishop at the table.
export const storytellerNominates = (of: string): Step => (id) => ({ kind: 'nominate', by: 'storyteller', of: id(of) })

// A nomination of the Storyteller, with an Atheist at the table.
export const nominateStoryteller = (by: string): Step => (id) => ({ kind: 'nominate', by: id(by), of: 'storyteller' })

// What a seat was told. `truth` defaults to what was told, so an honest info is one argument.
export const info = (
  to: string,
  told: NamedInfo,
  truth: NamedInfo = told,
  malfunctioned = false,
): Step => (id) => ({
  kind: 'info',
  to: [id(to)],
  told: resolveInfo(told, id),
  truth: resolveInfo(truth, id),
  malfunctioned,
})

// A traveller joining the ring at index `at`; its alignment is the Storyteller's to give.
export const addTraveller = (name: string, id: string, at: number, alignment: Alignment): Step => (_, ctx) => ({
  kind: 'addSeat',
  seat: ctx.newSeat(name),
  name,
  at,
  character: asCharacterId(id),
  alignment,
})

export const removeSeat = (who: string): Step => (id) => ({ kind: 'removeSeat', seat: id(who) })

// A character in play with no seat: a Fabled, a Loric, or Lil' Monsta.
export const addLoose = (of: string): Step => () => ({ kind: 'addLoose', character: asCharacterId(of) })

export const removeLoose = (of: string): Step => () => ({ kind: 'removeLoose', character: asCharacterId(of) })

// An InfoValue with plain strings where the event carries branded ids: seat names and character
// ids, so a test can write one inline.
type Named<T> = T extends SeatId | CharacterId ? string : T extends string ? T : T extends object ? { readonly [K in keyof T]: Named<T[K]> } : T
type NamedInfo = Named<InfoValue>

const resolveInfo = (v: NamedInfo, id: (name: string) => SeatId): InfoValue => {
  switch (v.kind) {
    case 'player':
      return { kind: 'player', seat: id(v.seat) }
    case 'players':
      return { kind: 'players', seats: v.seats.map(id) }
    case 'character':
      return { kind: 'character', character: asCharacterId(v.character) }
    case 'characters':
      return { kind: 'characters', characters: v.characters.map(asCharacterId) }
    case 'oneOfTwo':
      return { kind: 'oneOfTwo', seats: [id(v.seats[0]), id(v.seats[1])], character: asCharacterId(v.character) }
    case 'playerCharacter':
      return { kind: 'playerCharacter', seat: id(v.seat), character: asCharacterId(v.character) }
    case 'number':
    case 'yesNo':
    case 'alignment':
    case 'direction':
    case 'grimoire':
    case 'word':
    case 'text':
      return v
    default:
      return unreachable(v)
  }
}

// The id of the last payload so far that passes, which is its index in the log.
const findLast = (log: readonly Payload[], test: (p: Payload) => boolean): EventId | undefined => {
  for (let i = log.length - 1; i >= 0; i--) {
    const p = log[i]
    if (p && test(p)) return asEventId(i)
  }
  return undefined
}

const tokenRef = (def: string): TokenRef => {
  const slash = def.indexOf('/')
  if (slash === -1) throw new Error(`a token is written character/Name, got ${def}`)
  return [asCharacterId(def.slice(0, slash)), def.slice(slash + 1)]
}
