import type { Payload } from '../engine'

export interface DayTimer {
  readonly durationMs: number
  readonly remainingMs: number
  readonly deadline?: number
  readonly pauseOnNomination: boolean
  readonly nominationPaused: boolean
}

export type DayTimerAction = 'start' | 'pause' | 'reset' | 'addTime' | 'subtractTime'

const shortest = 15_000
const longest = 3_600_000

// Every day has a timer before anyone touches it: 30 seconds for each living player. It is saved
// only once the Storyteller starts or adjusts it, so until then it follows the count of the living.
export const defaultDayTimer = (alive: number): DayTimer => {
  const durationMs = Math.max(shortest, Math.min(longest, alive * 30_000))
  return { durationMs, remainingMs: durationMs, pauseOnNomination: true, nominationPaused: false }
}

export const dayTimerBounds = { shortest, longest } as const

// A discussion is set by the half minute. Under a minute the steps are 15 seconds, for a last
// call: the step follows the time left, so the next tap from 1:00 goes to 0:45 or to 1:30.
export const dayTimerStep = (remainingMs: number, direction: 'add' | 'subtract'): number =>
  (direction === 'add' ? remainingMs < 60_000 : remainingMs <= 60_000) ? 15_000 : 30_000

export const remainingDayTime = (timer: DayTimer, now: number): number =>
  timer.deadline === undefined ? timer.remainingMs : Math.max(0, Math.min(timer.remainingMs, timer.deadline - now))

const pauseDayTimer = (timer: DayTimer, now: number, nominationPaused = false): DayTimer => {
  const { deadline: _deadline, ...rest } = timer
  return { ...rest, remainingMs: remainingDayTime(timer, now), nominationPaused }
}

export const changeDayTimer = (timer: DayTimer, action: DayTimerAction, now: number): DayTimer => {
  switch (action) {
    case 'start': {
      const remainingMs = remainingDayTime(timer, now)
      return remainingMs > 0 ? { ...timer, remainingMs, deadline: now + remainingMs, nominationPaused: false } : timer
    }
    case 'pause': return pauseDayTimer(timer, now)
    case 'reset': return { ...pauseDayTimer(timer, now), remainingMs: timer.durationMs }
    case 'addTime':
    case 'subtractTime': {
      const left = remainingDayTime(timer, now)
      const delta = action === 'addTime' ? dayTimerStep(left, 'add') : -dayTimerStep(left, 'subtract')
      const durationMs = Math.max(shortest, Math.min(longest, timer.durationMs + delta))
      const remainingMs = Math.max(0, Math.min(longest, left + durationMs - timer.durationMs))
      return { ...timer, durationMs, remainingMs, ...(timer.deadline === undefined ? {} : { deadline: now + remainingMs }) }
    }
  }
}

// Pause when a nomination is recorded, not for every vote on the still-open nomination.
// There is no end-of-vote event; the Storyteller resumes discussion explicitly.
export const dayTimerAfterEvents = (timer: DayTimer | undefined, events: readonly Payload[], now: number): DayTimer | undefined => {
  if (events.some(e => e.kind === 'phase' || e.kind === 'endGame')) return undefined
  if (!timer) return timer
  if (events.some(e => e.kind === 'execute')) return pauseDayTimer(timer, now)
  if (timer.pauseOnNomination && timer.deadline !== undefined && events.some(e => e.kind === 'nominate')) return pauseDayTimer(timer, now, true)
  return timer
}

export const isDayTimer = (value: unknown): value is DayTimer => {
  if (!value || typeof value !== 'object') return false
  const timer = value as Record<string, unknown>
  return typeof timer.durationMs === 'number' && Number.isFinite(timer.durationMs) && timer.durationMs >= shortest && timer.durationMs <= longest &&
    typeof timer.remainingMs === 'number' && Number.isFinite(timer.remainingMs) && timer.remainingMs >= 0 && timer.remainingMs <= longest &&
    (timer.deadline === undefined || (typeof timer.deadline === 'number' && Number.isFinite(timer.deadline) && timer.deadline >= 0)) &&
    typeof timer.pauseOnNomination === 'boolean' && typeof timer.nominationPaused === 'boolean'
}
