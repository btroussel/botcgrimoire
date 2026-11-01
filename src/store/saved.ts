// SavedGame, its version, and the migrations between versions (docs/store.md). The log is the
// game; everything around it is what is needed to open the log again with the same meaning.
import type { Script } from '../content'
import { contentPin } from '../content'
import type { Event } from '../engine'
import { isBoardEdit, randomId } from '../engine'
import type { DayTimer } from './dayTimer'
import { isDayTimer } from './dayTimer'
import type { Draw } from './draw'
import { isDraw } from './draw'

export type GameId = string & { readonly __brand: 'GameId' }

// Increments whenever the shape of SavedGame or of any event changes in a way an older app
// would misread. Each step from n to n+1 is one function in `migrations`.
export const SAVED_VERSION = 15

export type GameMode = 'storyteller' | 'free'

// The upstream commits a game was played with.
export interface ContentPin {
  readonly release: string
  readonly translations: string
}

export interface SavedGame {
  readonly version: number
  readonly id: GameId
  readonly createdAt: number
  readonly updatedAt: number
  readonly content: ContentPin
  readonly script: Script
  readonly mode: GameMode
  readonly log: readonly Event[]
  readonly playTime: readonly { readonly start: number; readonly end: number }[]
  readonly dayTimer?: DayTimer
  readonly draw?: Draw // the bag still to deal, outside the log
  readonly deletedAt?: number // set by an older version's delete; the row stays hidden until purged
}

export const mintGameId = (): GameId => randomId('g', 10) as GameId

export const newGame = (script: Script, now: number, mode: GameMode = 'free'): SavedGame => ({
  version: SAVED_VERSION,
  id: mintGameId(),
  createdAt: now,
  updatedAt: now,
  content: { ...contentPin },
  script,
  mode,
  log: [],
  playTime: [],
})

// A game played on other content may show a renamed token or a changed character; the load path
// reports the two pins once so the Storyteller knows why, and nothing else changes.
export interface ContentMismatch {
  readonly saved: ContentPin
  readonly current: ContentPin
}

export const contentMismatch = (game: SavedGame): ContentMismatch | undefined =>
  game.content.release === contentPin.release && game.content.translations === contentPin.translations
    ? undefined
    : { saved: game.content, current: contentPin }

// One entry per step, keyed by the version it migrates from. A migration takes the raw object
// of the older version and returns the next; it never reads the grimoire, only the raw log.
type Migration = (raw: Record<string, unknown>) => Record<string, unknown>
// Old logs contain no event times. Preserve that absence instead of inventing a start.
const migrate1to2: Migration = (raw) => ({ ...raw, version: 2 })
// Preserve the previously saved wall-clock span. Older versions did not record breaks,
// so these cannot be recovered; never extend that span to the time of migration.
const migrate2to3: Migration = (raw) => ({ ...raw, version: 3, playTime: [{ start: raw.createdAt, end: raw.updatedAt }] })
// Older logs need no changes; version 4 adds the renameSeat event.
const migrate3to4: Migration = (raw) => ({ ...raw, version: 4 })
// Reminders now belong to players. Preserve ability markers on their source, and keep
// retired board-only reminders as log entries without renumbering any event references.
const migrate4to5: Migration = (raw) => {
  if (!Array.isArray(raw.log)) return { ...raw, version: 5 }
  const seats = new Set<string>()
  const retired = new Map<unknown, string>()
  const archive = (event: Record<string, unknown>, note: string) => ({
    id: event.id,
    audience: event.audience,
    ...(event.recordedAt !== undefined ? { recordedAt: event.recordedAt } : {}),
    kind: 'override',
    note,
  })
  const log = raw.log.map((event: unknown) => {
    if (!isRecord(event)) return event
    if (event.kind === 'addSeat' && typeof event.seat === 'string') seats.add(event.seat)
    if (event.kind === 'removeSeat' && typeof event.seat === 'string') seats.delete(event.seat)
    if (event.kind === 'removeToken' && retired.has(event.placedBy)) return archive(event, `Removed board reminder: ${retired.get(event.placedBy)}`)
    if (event.kind !== 'placeToken' || event.seat !== undefined) return event
    const token = event.token
    if (Array.isArray(token) && typeof token[0] === 'string' && typeof event.source === 'string' && seats.has(event.source)) {
      // Version 4 placed these self-markers off the ring. Their meaning is fixed by that format.
      const ownMarkers: Readonly<Record<string, readonly string[]>> = { minstrel: ['Everyone Is Drunk'], banshee: ['Has Ability'], hatter: ['Tea Party Tonight'], plaguedoctor: ['Storyteller Ability'], poppygrower: ['Evil Wakes'], fanggu: ['Once'], scarletwoman: ['Is The Demon'] }
      const ownMarker = ownMarkers[String(token[0])]?.includes(String(token[1]))
      if (ownMarker) return { ...event, seat: event.source }
    }
    const reminder = Array.isArray(token) ? token.filter((part) => typeof part === 'string' && part !== '').join(' / ') : 'Unknown reminder'
    const label = typeof event.note === 'string' ? `${reminder}: ${event.note}` : reminder
    retired.set(event.id, label)
    return archive(event, `Retired board reminder: ${label}`)
  })
  return { ...raw, version: 5, log }
}
const migrate5to6: Migration = (raw) => ({ ...raw, version: 6 })
// Older prompts only existed for the last event. Keep that prompt, without reopening the
// entire game's historical decisions or changing event ids and token references.
const migrate6to7: Migration = (raw) => ({
  ...raw, version: 7,
  log: Array.isArray(raw.log) ? raw.log.map((e: unknown, i: number) =>
    isRecord(e) && i < (raw.log as unknown[]).length - 1 ? { ...e, decisionsHandled: true } : e) : raw.log,
})
// Marker navigation was not saved before version 8; preserve the log without inventing it.
const migrate7to8: Migration = (raw) => ({ ...raw, version: 8 })
const migrate8to9: Migration = (raw) => ({ ...raw, version: 9 })
const migrate9to10: Migration = (raw) => ({ ...raw, version: 10 })
// Older logs need no changes; version 11 adds addLoose, removeLoose and the characters pick.
const migrate10to11: Migration = (raw) => ({ ...raw, version: 11 })
// Old free boards used a custom-script marker. Their historical events keep their meaning;
// only new edits carry the manual flag, so migration cannot resurrect removed reminders.
const migrate11to12: Migration = (raw) => ({
  ...raw, version: 12,
  mode: isRecord(raw.script) && Array.isArray(raw.script.items) && raw.script.items.some((item: unknown) =>
    isRecord(item) && item.id === '_meta' && item.author === 'botc-grimoire:free-board') ? 'free' : 'storyteller',
})
// Manual controls add event kinds without rewriting the historical log or its references.
const migrate12to13: Migration = (raw) => ({ ...raw, version: 13 })
// Explicit execution markers opt in per day; older vote-derived markers retain their meaning.
const migrate13to14: Migration = (raw) => ({ ...raw, version: 14 })
// Older logs need no changes; version 15 adds setNote, rewriting a placed note's text.
const migrate14to15: Migration = (raw) => ({ ...raw, version: 15 })
const migrations: Readonly<Record<number, Migration>> = { 1: migrate1to2, 2: migrate2to3, 3: migrate3to4, 4: migrate4to5, 5: migrate5to6, 6: migrate6to7, 7: migrate7to8, 8: migrate8to9, 9: migrate9to10, 10: migrate10to11, 11: migrate11to12, 12: migrate12to13, 13: migrate13to14, 14: migrate14to15 }

export class InvalidSavedGame extends Error {}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null

// The structural check after migration: the shape the current app writes, and every event an
// object with a kind and its index as id. What each event means is the engine's business.
const validate = (raw: Record<string, unknown>): SavedGame => {
  // The declared type lets TypeScript narrow after each call, as it does after a throw.
  const fail: (what: string) => never = (what) => {
    throw new InvalidSavedGame(what)
  }
  if (raw.version !== SAVED_VERSION) fail(`version ${String(raw.version)} is not ${SAVED_VERSION}`)
  if (raw.mode !== 'storyteller' && raw.mode !== 'free') fail('mode')
  if (typeof raw.id !== 'string' || raw.id === '') fail('id')
  if (typeof raw.createdAt !== 'number' || typeof raw.updatedAt !== 'number') fail('timestamps')
  if (!isRecord(raw.content) || typeof raw.content.release !== 'string' || typeof raw.content.translations !== 'string') fail('content pin')
  const script = raw.script
  const custom = isRecord(script) && script.kind === 'custom' && typeof script.name === 'string' && Array.isArray(script.items)
  if (!(typeof script === 'string' || custom)) fail('script')
  const log: unknown = raw.log
  if (!Array.isArray(log)) fail('log')
  log.forEach((e: unknown, i) => {
    if (!isRecord(e) || typeof e.kind !== 'string' || e.id !== i) fail(`event ${i}`)
    if (e.manual !== undefined && (e.manual !== true ||
      !isBoardEdit({ kind: String(e.kind) }))) fail(`event ${i} manual edit`)
    if (e.kind === 'setGhostVote' && (typeof e.seat !== 'string' || !e.seat || typeof e.available !== 'boolean')) fail(`event ${i} ghost vote`)
    if (e.kind === 'markForExecution' && e.seat !== null && (typeof e.seat !== 'string' || !e.seat || e.seat === 'storyteller')) fail(`event ${i} execution marker`)
    if (e.kind === 'cancelNomination' && (!Number.isInteger(e.nomination) || Number(e.nomination) < 0 || Number(e.nomination) >= i || !isRecord(log[Number(e.nomination)]) || log[Number(e.nomination)].kind !== 'nominate')) fail(`event ${i} nomination cancellation`)
    if (e.kind === 'setVoteTotal' && (!Number.isInteger(e.nomination) || Number(e.nomination) < 0 || Number(e.nomination) >= i || !Number.isInteger(e.total) || Number(e.total) < 0)) fail(`event ${i} vote total`)
    if (e.kind === 'moveSeat' && (typeof e.seat !== 'string' || !e.seat || !Number.isInteger(e.to) || Number(e.to) < 0)) fail(`event ${i} seat position`)
    if (e.kind === 'endGame' && ((e.winner !== undefined && e.winner !== 'good' && e.winner !== 'evil') || (e.note !== undefined && typeof e.note !== 'string'))) fail(`event ${i} result`)
    if (e.kind === 'nightChecklist' && (typeof e.entry !== 'string' || !e.entry || !['done', 'skipped', 'pending'].includes(String(e.status)) || (e.label !== undefined && typeof e.label !== 'string'))) fail(`event ${i} night checklist`)
    if (e.kind === 'unvote' &&
      (!Number.isInteger(e.nomination) || Number(e.nomination) < 0 || Number(e.nomination) >= i ||
        typeof e.seat !== 'string' || e.seat === '' || typeof e.weight !== 'number' || !Number.isFinite(e.weight) ||
        (e.restoreGhost !== undefined && e.restoreGhost !== true))) fail(`event ${i} vote correction`)
    if (e.kind === 'nightProgress' &&
      (typeof e.marker !== 'string' || !['dusk', 'minionInfo', 'demonInfo', 'dawn', 'step'].includes(e.marker) ||
        (e.seat !== undefined && (typeof e.seat !== 'string' || e.seat === '')) ||
        (e.step !== undefined && (typeof e.step !== 'number' || !Number.isFinite(e.step))))) fail(`event ${i} night progress`)
    if (e.kind === 'resolveDecision' &&
      (typeof e.key !== 'string' || e.key === '' || (e.note !== undefined && typeof e.note !== 'string'))) fail(`event ${i} decision`)
    if (e.batch !== undefined && (!Number.isInteger(e.batch) || Number(e.batch) < 0 || Number(e.batch) > i)) fail(`event ${i} batch`)
    if (e.decisionsHandled !== undefined && e.decisionsHandled !== true) fail(`event ${i} decision history`)
    if (e.kind === 'setBluffs' &&
      (!Array.isArray(e.characters) || e.characters.length > 3 || new Set(e.characters).size !== e.characters.length || e.characters.some((id) => typeof id !== 'string' || id === ''))) fail(`event ${i} bluffs`)
    if (e.kind === 'prepareInfo') {
      const value = e.value
      const zero = isRecord(value) && value.kind === 'number' && value.value === 0
      const pair = isRecord(value) && value.kind === 'oneOfTwo' && Array.isArray(value.seats) && value.seats.length === 2 &&
        value.seats[0] !== value.seats[1] && value.seats.every((id) => typeof id === 'string' && id !== '') && typeof value.character === 'string' && value.character !== ''
      const fakeTeam = e.of === 'lunatic' && isRecord(value) && (
        (value.kind === 'players' && Array.isArray(value.seats) && new Set(value.seats).size === value.seats.length && value.seats.every(id => typeof id === 'string' && id !== '')) ||
        (value.kind === 'characters' && Array.isArray(value.characters) && value.characters.length === 3 && new Set(value.characters).size === 3 && value.characters.every(id => typeof id === 'string' && id !== '')))
      if (typeof e.seat !== 'string' || e.seat === '' || typeof e.of !== 'string' || e.of === '' || (!zero && !pair && !fakeTeam)) fail(`event ${i} prepared information`)
    }
    if (e.kind === 'setNote' && (!Number.isInteger(e.placedBy) || Number(e.placedBy) < 0 || Number(e.placedBy) >= i ||
      typeof e.note !== 'string' || e.note.trim() === '')) fail(`event ${i} note`)
    if (e.kind === 'placeToken' && (typeof e.seat !== 'string' || e.seat === '' || e.seat === 'storyteller')) fail(`event ${i} reminder seat`)
    if (e.recordedAt !== undefined &&
      (typeof e.recordedAt !== 'number' || !Number.isFinite(e.recordedAt) || e.recordedAt < 0)) fail(`event ${i} timestamp`)
  })
  if (!Array.isArray(raw.playTime)) fail('play time')
  let previousEnd = 0
  for (const span of raw.playTime as unknown[]) {
    if (!isRecord(span) || typeof span.start !== 'number' || typeof span.end !== 'number' ||
      !Number.isFinite(span.start) || !Number.isFinite(span.end) || span.start < previousEnd || span.end < span.start) fail('play time span')
    previousEnd = span.end
  }
  if (raw.dayTimer !== undefined && !isDayTimer(raw.dayTimer)) fail('day timer')
  if (raw.draw !== undefined && !isDraw(raw.draw)) fail('bag')
  return raw as unknown as SavedGame
}

// Loading and import share this path: run the chain from the saved version to the current one,
// then validate. A game from a newer app is refused rather than misread.
export const migrate = (input: unknown): SavedGame => {
  if (!isRecord(input)) throw new InvalidSavedGame('not an object')
  let raw = input
  let version = typeof raw.version === 'number' ? raw.version : 0
  if (version > SAVED_VERSION) throw new InvalidSavedGame(`version ${version} is newer than this app`)
  while (version < SAVED_VERSION) {
    const step = migrations[version]
    if (!step) throw new InvalidSavedGame(`no migration from version ${version}`)
    raw = step(raw)
    version++
  }
  return validate(raw)
}

// A game as text in the file shape earlier versions exported, without the deletion flag, which
// belongs to a database row. Import compares a file with the game already under its id this way.
export const serialize = (game: SavedGame): string => {
  const { deletedAt: _gone, ...rest } = game
  return JSON.stringify(rest, null, 2)
}

export const deserialize = (text: string): SavedGame => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new InvalidSavedGame('not JSON')
  }
  return migrate(parsed)
}
