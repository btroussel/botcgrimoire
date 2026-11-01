import { asSeatId } from '../engine'
import { changeDayTimer, remainingDayTime } from './dayTimer'
import { deserialize, newGame, serialize } from './saved'
import { append, appendAll, lookAt, openSession, redo, undo, updateDayTimer } from './session'

const day = () => appendAll(openSession(newGame('tb', 0)), [
  { kind: 'phase', to: 'night', night: 1 }, { kind: 'phase', to: 'day' },
], 1000)
const running = () => updateDayTimer(updateDayTimer(day(), 'add', 1000), 'start', 2000)
// No control turns nomination pausing off, but a saved timer may hold it off.
const optedOut = () => {
  const s = running()
  return { ...s, game: { ...s.game, dayTimer: { ...s.game.dayTimer!, pauseOnNomination: false } } }
}
const nominate = { kind: 'nominate' as const, by: asSeatId('a'), of: asSeatId('b') }

test('adding a five-minute timer does not record a game action or clear redo', () => {
  const before = undo(append(day(), { kind: 'override', note: 'correction' }, 1001), 1002)
  const after = updateDayTimer(before, 'add', 1003)
  expect(after.game.dayTimer).toEqual({ durationMs: 300_000, remainingMs: 300_000, pauseOnNomination: true, nominationPaused: false })
  expect(after.game.log).toBe(before.game.log)
  expect(after.game.updatedAt).toBe(before.game.updatedAt)
  expect(after.redo).toBe(before.redo)
})

test('a running timer survives save and reload and accounts for time away', () => {
  const saved = running()
  const reopened = openSession(deserialize(serialize(saved.game)))
  expect(remainingDayTime(reopened.game.dayTimer!, 92_000)).toBe(210_000)
  expect(remainingDayTime(reopened.game.dayTimer!, 602_000)).toBe(0)
  expect(reopened.game.log).toEqual(saved.game.log)
})

test('pause freezes the remainder and resume uses a new deadline', () => {
  const paused = updateDayTimer(running(), 'pause', 62_000)
  expect(remainingDayTime(paused.game.dayTimer!, 500_000)).toBe(240_000)
  const resumed = updateDayTimer(paused, 'start', 500_000)
  expect(remainingDayTime(resumed.game.dayTimer!, 530_000)).toBe(210_000)
})

test('nominations pause by default, and votes do not pause manual resumption', () => {
  const nominated = append(running(), nominate, 32_000)
  expect(nominated.game.dayTimer?.nominationPaused).toBe(true)
  expect(nominated.game.dayTimer?.deadline).toBeUndefined()
  expect(nominated.game.dayTimer?.remainingMs).toBe(270_000)
  const resumed = updateDayTimer(nominated, 'start', 40_000)
  const voted = append(resumed, { kind: 'vote', nomination: nominated.game.log.at(-1)!.id, seat: asSeatId('a'), weight: 1 }, 50_000)
  expect(remainingDayTime(voted.game.dayTimer!, 50_000)).toBe(260_000)
  const another = append(voted, nominate, 60_000)
  expect(another.game.dayTimer?.remainingMs).toBe(250_000)
  expect(another.game.dayTimer?.deadline).toBeUndefined()
})

test('turning off pause on nomination leaves the countdown running', () => {
  const nominated = append(optedOut(), nominate, 32_000)
  expect(nominated.game.dayTimer?.deadline).toBe(302_000)
  expect(nominated.game.dayTimer?.nominationPaused).toBe(false)
})

test('reset uses the adjusted duration and adjustments respect bounds', () => {
  const longer = updateDayTimer(running(), 'addThirtySeconds', 62_000)
  expect(longer.game.dayTimer?.durationMs).toBe(330_000)
  expect(remainingDayTime(longer.game.dayTimer!, 62_000)).toBe(270_000)
  const shorter = updateDayTimer(longer, 'subtractThirtySeconds', 62_000)
  expect(shorter.game.dayTimer?.durationMs).toBe(300_000)
  expect(remainingDayTime(shorter.game.dayTimer!, 62_000)).toBe(240_000)
  const reset = updateDayTimer(longer, 'reset', 70_000)
  expect(reset.game.dayTimer?.remainingMs).toBe(330_000)
  expect(reset.game.dayTimer?.deadline).toBeUndefined()
  let timer = reset.game.dayTimer
  for (let i = 0; i < 70; i++) timer = changeDayTimer(timer, 'subtractThirtySeconds', 70_000)
  expect(timer?.durationMs).toBe(60_000)
  expect(timer?.remainingMs).toBe(60_000)
  for (let i = 0; i < 140; i++) timer = changeDayTimer(timer, 'addThirtySeconds', 70_000)
  expect(timer?.durationMs).toBe(3_600_000)
  expect(timer?.remainingMs).toBe(3_600_000)
})

test('expiry cannot become negative or alter the log and reset makes it usable again', () => {
  const session = running()
  expect(remainingDayTime(session.game.dayTimer!, 400_000)).toBe(0)
  const attempted = updateDayTimer(session, 'start', 400_000)
  expect(attempted.game.log).toBe(session.game.log)
  expect(remainingDayTime(attempted.game.dayTimer!, 400_000)).toBe(0)
  expect(updateDayTimer(attempted, 'reset', 400_000).game.dayTimer?.remainingMs).toBe(300_000)
})

test('execution pauses even with nomination pausing disabled, and phase changes remove the timer', () => {
  const ended = append(optedOut(), { kind: 'execute', cause: 'vote' }, 62_000)
  expect(ended.game.dayTimer?.remainingMs).toBe(240_000)
  expect(ended.game.dayTimer?.deadline).toBeUndefined()
  expect(append(ended, { kind: 'phase', to: 'night', night: 2 }, 70_000).game.dayTimer).toBeUndefined()
  expect(append(running(), { kind: 'phase', to: 'over' }, 70_000).game.dayTimer).toBeUndefined()
})

test('replay refuses timer changes, ordinary undo preserves it, phase undo and redo remove it', () => {
  const session = running()
  const replay = lookAt(session, 1)
  expect(updateDayTimer(replay, 'remove', 4000)).toBe(replay)
  const edit = append(session, { kind: 'override', note: 'note' }, 4000)
  expect(undo(edit, 5000).game.dayTimer).toEqual(session.game.dayTimer)
  const beforeDay = undo(session, 5000)
  expect(beforeDay.game.dayTimer).toBeUndefined()
  expect(redo(beforeDay, 6000).game.dayTimer).toBeUndefined()
  expect(updateDayTimer(beforeDay, 'add', 6000)).toBe(beforeDay)
})

test('removal and legacy games need no timer metadata, malformed imports are rejected', () => {
  expect(updateDayTimer(running(), 'remove', 3000).game.dayTimer).toBeUndefined()
  expect(deserialize(serialize(day().game)).dayTimer).toBeUndefined()
  const game = running().game
  for (const bad of [{ deadline: -1 }, { durationMs: 0 }, { remainingMs: -1 }, { pauseOnNomination: 'yes' }]) {
    expect(() => deserialize(JSON.stringify({ ...game, dayTimer: { ...game.dayTimer, ...bad } }))).toThrow('day timer')
  }
})
