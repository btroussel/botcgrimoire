import type { Payload } from '../engine'

export interface DayTimer {
  readonly durationMs: number
  readonly remainingMs: number
  readonly deadline?: number
  readonly pauseOnNomination: boolean
  readonly nominationPaused: boolean
}

export type DayTimerAction = 'add' | 'remove' | 'start' | 'pause' | 'reset' | 'addThirtySeconds' | 'subtractThirtySeconds'

export const remainingDayTime = (timer: DayTimer, now: number): number =>
  timer.deadline === undefined ? timer.remainingMs : Math.max(0, Math.min(timer.remainingMs, timer.deadline - now))

const pauseDayTimer = (timer: DayTimer, now: number, nominationPaused = false): DayTimer => {
  const { deadline: _deadline, ...rest } = timer
  return { ...rest, remainingMs: remainingDayTime(timer, now), nominationPaused }
}

export const changeDayTimer = (timer: DayTimer | undefined, action: DayTimerAction, now: number): DayTimer | undefined => {
  if (action === 'remove') return undefined
  if (action === 'add') return timer ?? { durationMs: 300_000, remainingMs: 300_000, pauseOnNomination: true, nominationPaused: false }
  if (!timer) return timer
  switch (action) {
    case 'start': {
      const remainingMs = remainingDayTime(timer, now)
      return remainingMs > 0 ? { ...timer, remainingMs, deadline: now + remainingMs, nominationPaused: false } : timer
    }
    case 'pause': return pauseDayTimer(timer, now)
    case 'reset': return { ...pauseDayTimer(timer, now), remainingMs: timer.durationMs }
    case 'addThirtySeconds':
    case 'subtractThirtySeconds': {
      const delta = action === 'addThirtySeconds' ? 30_000 : -30_000
      const durationMs = Math.max(60_000, Math.min(3_600_000, timer.durationMs + delta))
      const remainingMs = Math.max(0, Math.min(3_600_000, remainingDayTime(timer, now) + durationMs - timer.durationMs))
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
  return typeof timer.durationMs === 'number' && Number.isFinite(timer.durationMs) && timer.durationMs >= 60_000 && timer.durationMs <= 3_600_000 &&
    typeof timer.remainingMs === 'number' && Number.isFinite(timer.remainingMs) && timer.remainingMs >= 0 && timer.remainingMs <= 3_600_000 &&
    (timer.deadline === undefined || (typeof timer.deadline === 'number' && Number.isFinite(timer.deadline) && timer.deadline >= 0)) &&
    typeof timer.pauseOnNomination === 'boolean' && typeof timer.nominationPaused === 'boolean'
}
