// Homebrew characters: records a custom script carries itself, and the Storyteller's own ones.
// The bundled lookups (`character`, `gameText().role`, a character's art) fall back to this
// registry, so a seat, a sheet row or a picker shows a homebrew token with its name, team, art
// and night positions without every call site finding the script it came from. The store fills
// it from what the device holds, the open game's script last so its copy wins. It is an external
// store for React: a piece that draws art subscribes, since the same id can change its image.
import { expandReminders } from './reminders'
import type { Character, Homebrew } from './types'
import { teamSide } from './types'
import { rawNightsheet } from './upstream'

let registered: ReadonlyMap<string, Homebrew> = new Map()
let version = 0
const listeners = new Set<() => void>()

// Later entries win. An unchanged list, entry for entry, notifies nobody.
export const registerHomebrew = (list: readonly Homebrew[]): void => {
  const next = new Map(list.map((h) => [h.id, h]))
  if (next.size === registered.size && [...next].every(([id, h]) => registered.get(id) === h)) return
  registered = next
  version++
  listeners.forEach((listener) => listener())
}

export const homebrew = (id: string): Homebrew | undefined => registered.get(id)

export const subscribeHomebrew = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const homebrewVersion = (): number => version

// The bundled sheet for a night: character ids and the dusk, minioninfo, demoninfo and dawn
// steps, in order, each at its ordinal.
export const nightSheet = (night: 'first' | 'other'): readonly string[] =>
  night === 'first' ? rawNightsheet.firstNight : rawNightsheet.otherNight

// The position just after a step, or nothing when this build's sheet has no such step.
export const wakeAfter = (night: 'first' | 'other', step: string): number | undefined => {
  const at = nightSheet(night).indexOf(step)
  return at === -1 ? undefined : at + 0.5
}

// The step a position wakes after: the last one before it, dusk for anything earlier.
export const stepBefore = (night: 'first' | 'other', position: number): string => {
  const sheet = nightSheet(night)
  return sheet[Math.min(Math.max(Math.ceil(position) - 1, 0), sheet.length - 1)]!
}

// Where a homebrew character wakes. The step it names fixes the gap it wakes in while the sheet
// has it, and its number fixes its place in that gap: a record is saved as the step's ordinal plus
// a fraction, and the fraction is what a sync leaves alone. Placing a character just after another
// homebrew character takes the place between that one and whatever wakes next rather than naming
// it, so moving or deleting the other never moves this one, there is no chain or loop to follow,
// and the file's own numbers carry the order. A whole number, from another tool's file, names a
// step's own slot and sits mid-gap as it always has. A wake position of zero or less is the
// schema's "does not wake".
export const homebrewWake = (h: Homebrew, night: 'first' | 'other'): number | undefined => {
  const step = night === 'first' ? h.firstNightAfter : h.otherNightAfter
  const n = night === 'first' ? h.firstNight : h.otherNight
  const at = step !== undefined ? nightSheet(night).indexOf(step) : -1
  if (at !== -1) return at + (n !== undefined && n > 0 && !Number.isInteger(n) ? n - Math.floor(n) : 0.5)
  return n !== undefined && n > 0 ? n : undefined
}

// The position just after a step or one of `others`, halfway to whatever wakes next among them or
// the next step, so the character sits directly under the row it was placed after. Nothing when
// neither has that id. `others` leaves out the character being placed.
export const wakeJustAfter = (night: 'first' | 'other', key: string, others: readonly Homebrew[]): number | undefined => {
  const step = nightSheet(night).indexOf(key)
  const other = step === -1 ? others.find((h) => h.id === key) : undefined
  const from = step !== -1 ? step : other ? homebrewWake(other, night) : undefined
  if (from === undefined) return undefined
  let to = Math.floor(from) + 1
  for (const h of others) {
    const at = homebrewWake(h, night)
    if (at !== undefined && at > from && at < to) to = at
  }
  return (from + to) / 2
}

const joined = new WeakMap<Homebrew, Character>()

export const homebrewCharacter = (h: Homebrew): Character => {
  const seen = joined.get(h)
  if (seen) return seen
  const first = homebrewWake(h, 'first')
  const other = homebrewWake(h, 'other')
  const c: Character = {
    id: h.id as Character['id'],
    team: h.team,
    edition: 'homebrew',
    name: h.name,
    ability: h.ability,
    ...(first !== undefined && h.firstNightReminder ? { firstNightReminder: h.firstNightReminder } : {}),
    ...(other !== undefined && h.otherNightReminder ? { otherNightReminder: h.otherNightReminder } : {}),
    setupFlag: h.setup === true,
    ordinals: { ...(first !== undefined ? { first } : {}), ...(other !== undefined ? { other } : {}) },
    reminders: expandReminders(h.reminders ?? [], h.remindersGlobal ?? []),
  }
  joined.set(h, c)
  return c
}

export interface HomebrewImage {
  readonly uri: string
}

export interface HomebrewArt {
  readonly single?: HomebrewImage
  readonly good?: HomebrewImage
  readonly evil?: HomebrewImage
}

// Only an image the record carries is drawn. A web address would need the network during a game
// and tell a stranger's server who is playing, so it stays in the file and the team icon shows.
const embedded = (uri: string | undefined): HomebrewImage | undefined =>
  uri !== undefined && /^data:image\/[a-z+.-]+[;,]/i.test(uri) ? { uri } : undefined

const drawn = new WeakMap<Homebrew, HomebrewArt | undefined>()

// The schema's set is the usual side then the flipped one, or for a Traveller unaligned, good
// and evil. A single icon serves both sides.
export const homebrewArt = (h: Homebrew): HomebrewArt | undefined => {
  if (drawn.has(h)) return drawn.get(h)
  const list = typeof h.image === 'string' ? [h.image] : (h.image ?? [])
  const [a, b, c] = list.map(embedded)
  const evilTeam = teamSide(h.team) === 'evil'
  const art: HomebrewArt | undefined = a === undefined && b === undefined && c === undefined ? undefined
    : h.team === 'traveller' ? { ...(a ? { single: a } : {}), ...(b ? { good: b } : {}), ...(c ? { evil: c } : {}) }
      : list.length === 1 ? (a ? { single: a } : undefined)
        : { ...(a ? (evilTeam ? { evil: a } : { good: a }) : {}), ...(b ? (evilTeam ? { good: b } : { evil: b }) : {}) }
  drawn.set(h, art)
  return art
}
