import type { Event, Phase } from '../engine'

// A place on the slider the Storyteller aims for: the cursor value that shows the board as the
// phase opened, and what that phase is. Setup begins with the initial roles dealt.
export interface PhaseMark {
  readonly cursor: number
  readonly phase: Phase
  readonly night: number
}

export const phaseMarks = (log: readonly Event[]): readonly PhaseMark[] => {
  const marks: PhaseMark[] = [{ cursor: setupStart(log), phase: 'setup', night: 0 }]
  let night = 0
  log.forEach((e, i) => {
    if (e.kind === 'endGame') { marks.push({ cursor: i + 1, phase: 'over', night }); return }
    if (e.kind !== 'phase') return
    if (e.to === 'night') night = e.night ?? night + 1
    marks.push({ cursor: i + 1, phase: e.to, night })
  })
  return marks
}

// Keep the initial deal visible, before preparation reminders, information and bluffs.
export const setupStart = (log: readonly Event[]): number => {
  const initial = new Set(['addSeat', 'setCharacter', 'setAlignment', 'setShown', 'renameSeat', 'moveSeat'])
  const firstChoice = log.findIndex(event => !initial.has(event.kind))
  if (firstChoice < 0) return log.length
  const batch = log[firstChoice - 1]?.batch
  let cursor = firstChoice
  // The deal can also place disguise tokens; keep that initial action intact.
  if (batch !== undefined) while (cursor < log.length && log[cursor]?.batch === batch) cursor++
  return cursor
}

// The phase in effect once `cursor` events have been applied: the last mark at or before it.
export const phaseAt = (marks: readonly PhaseMark[], cursor: number): PhaseMark => {
  let found: PhaseMark = marks[0] ?? { cursor: 0, phase: 'setup', night: 0 }
  for (const m of marks) {
    if (m.cursor <= cursor) found = m
    else break
  }
  return found
}
// Begin after all setup placements, at the first night. Setup-only games show their latest state.
export const replayStart = (log: readonly Event[]): number => {
  const firstNight = log.findIndex(event => event.kind === 'phase' && event.to === 'night')
  return firstNight >= 0 ? firstNight + 1 : log.length
}
