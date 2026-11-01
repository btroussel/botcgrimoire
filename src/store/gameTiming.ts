import type { Locale, Translate } from '../content'
import type { Event } from '../engine'
import type { SavedGame } from './saved'

export interface GameClock {
  readonly state: 'setup' | 'running' | 'over' | 'unknown'
  readonly startedAt?: number
  readonly endedAt?: number
}

// Corrections after the recorded ending must not extend its duration.
// Keeping times on the events also makes undo and redo restore the original clock.
export const gameClock = (log: readonly Event[]): GameClock => {
  let start: Event | undefined
  let end: Event | undefined
  for (const event of log) {
    if (event.kind === 'endGame') { end ??= event; continue }
    if (event.kind !== 'phase') continue
    if (event.to === 'setup') {
      start = undefined
      end = undefined
    } else if (event.to === 'over') {
      end ??= event
    } else {
      start ??= event
      end = undefined
    }
  }
  if (!start && !end) return { state: 'setup' }
  if ((start && start.recordedAt === undefined) || (end && end.recordedAt === undefined)) return { state: 'unknown' }
  return {
    state: end ? 'over' : 'running',
    ...(start?.recordedAt !== undefined ? { startedAt: start.recordedAt } : {}),
    ...(end?.recordedAt !== undefined ? { endedAt: end.recordedAt } : {}),
  }
}

// Only closed, checkpointed spans are saved. Reopening a tab cannot count time while
// the app was closed, even if its last shutdown never delivered a lifecycle event.
export const recordPlayTime = (game: SavedGame, start: number, end: number): SavedGame => {
  const last = game.playTime.at(-1)
  if (end <= start || (last && end <= last.end)) return game
  const playTime = last && start <= last.end
    ? [...game.playTime.slice(0, -1), { start: last.start, end }]
    : [...game.playTime, { start, end }]
  return { ...game, playTime }
}

// Existing guided records measured play from the first night. Preserve that historical
// origin; manual boards measure all active time from their creation, including setup.
const playClock = (game: SavedGame, log: readonly Event[]): GameClock => {
  const clock = gameClock(log)
  if (game.mode === 'storyteller') return clock
  return { state: clock.state === 'setup' ? 'running' : clock.state, startedAt: game.createdAt,
    ...(clock.endedAt !== undefined ? { endedAt: clock.endedAt } : {}) }
}

export const elapsedPlayTime = (game: SavedGame, log = game.log, until = Infinity): number | undefined => {
  const clock = playClock(game, log)
  if (clock.state === 'unknown') return undefined
  if (clock.startedAt === undefined) return 0
  const end = Math.min(clock.endedAt ?? Infinity, until)
  return game.playTime.reduce((total, span) => total + Math.max(0,
    Math.min(span.end, end) - Math.max(span.start, clock.startedAt!)), 0)
}

// A display-only origin lets the clock tick between saves. Subtract the recorded total
// from the unrecorded interval's start, so checkpoints never count the same time twice.
export const elapsedClockStart = (game: SavedGame, activeStart: number | undefined): number | undefined => {
  const clock = playClock(game, game.log)
  if (activeStart === undefined || clock.state !== 'running' || clock.startedAt === undefined) return undefined
  const since = Math.max(activeStart, clock.startedAt, game.playTime.at(-1)?.end ?? activeStart)
  return since - (elapsedPlayTime(game) ?? 0)
}

// Building a formatter costs far more than formatting with one, and History dates every game.
const dateFormats = new Map<Locale, Intl.DateTimeFormat>()
const dateFormat = (locale: Locale): Intl.DateTimeFormat => {
  let format = dateFormats.get(locale)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
    dateFormats.set(locale, format)
  }
  return format
}

export const gameTiming = (game: SavedGame, t: Translate, locale: Locale) => {
  const clock = gameClock(game.log)
  const totalMinutes = Math.floor((elapsedPlayTime(game) ?? 0) / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return {
    date: dateFormat(locale).format(game.createdAt),
    duration: clock.state === 'unknown' ? t('history.durationUnknown')
      : hours > 0 ? t('history.durationHours', { hours, minutes })
        : t('history.durationMinutes', { minutes }),
  }
}
